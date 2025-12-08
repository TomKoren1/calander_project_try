const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

// --- 1. SETUP ---
dotenv.config();
const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// --- 2. DATABASE CONNECTION ---
const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'calander_project_try1'
});

// --- 3. HELPER FUNCTIONS ---

// We need a valid User ID because the database requires it (NOT NULL)
async function getDefaultUserId() {
    try {
        const [rows] = await pool.query("SELECT id FROM users LIMIT 1");
        if (rows.length === 0) {
            console.error("❌ ERROR: No users found in DB. Please create a user manually first.");
            return "00000000-0000-0000-0000-000000000000"; // Fallback (might fail in DB)
        }
        return rows[0].id;
    } catch (error) {
        console.error("DB Error:", error);
        return null;
    }
}

// --- 4. TOOL IMPLEMENTATIONS (The actual SQL Logic) ---
const toolsMap = {
    // Tool 1: Create a Task
    create_task: async ({ title, due_datetime, description, priority }) => {
        console.log(`Executing: Create Task "${title}"`);
        const userId = await getDefaultUserId();
        const newId = uuidv4();
        
        await pool.query(
            `INSERT INTO tasks 
            (id, user_id, title, description, due_datetime, status, priority, is_flagged) 
            VALUES (?, ?, ?, ?, ?, 'pending', ?, FALSE)`,
            [newId, userId, title, description || '', due_datetime, priority || 1]
        );
        return `Success! Task created with ID: ${newId}`;
    },

    // Tool 2: Create an Event
    create_event: async ({ title, start_time, end_time, description, location }) => {
        console.log(`Executing: Create Event "${title}"`);
        const userId = await getDefaultUserId();
        const newId = uuidv4();

        await pool.query(
            `INSERT INTO events 
            (id, user_id, title, description, start_time, end_time, location, status, all_day) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', FALSE)`,
            [newId, userId, title, description || '', start_time, end_time, location || '']
        );
        return `Success! Event created with ID: ${newId}`;
    }
};

// --- 5. AI TOOL DEFINITIONS (What Gemini sees) ---
const toolsDef = [
    {
        name: "create_task",
        description: "Add a new item to the to-do list.",
        parameters: {
            type: "OBJECT",
            properties: {
                title: { type: "STRING" },
                due_datetime: { type: "STRING", description: "ISO format YYYY-MM-DD HH:MM:SS" },
                description: { type: "STRING" },
                priority: { type: "NUMBER", description: "1 (Low) to 5 (High)" }
            },
            required: ["title", "due_datetime"]
        }
    },
    {
        name: "create_event",
        description: "Schedule an event on the calendar.",
        parameters: {
            type: "OBJECT",
            properties: {
                title: { type: "STRING" },
                start_time: { type: "STRING", description: "ISO format YYYY-MM-DD HH:MM:SS" },
                end_time: { type: "STRING", description: "ISO format YYYY-MM-DD HH:MM:SS" },
                description: { type: "STRING" },
                location: { type: "STRING" }
            },
            required: ["title", "start_time", "end_time"]
        }
    }
];

// --- 6. API ROUTE ---
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // A. Setup Model
        // We use "gemini-flash-latest" as confirmed by your check_models.js
        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest",
            tools: [{ functionDeclarations: toolsDef }] 
        });

        // B. Start Chat (Fresh session every time = No crashes)
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: `
                        You are a helpful Calendar Assistant.
                        Current Date/Time: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })}
                        
                        RULES:
                        1. If the user wants to do something at a specific time, use 'create_event'.
                        2. If the user just has a to-do item or deadline, use 'create_task'.
                        3. Always confirm back to the user what you created.
                    `}]
                },
                {
                    role: "model",
                    parts: [{ text: "I am ready to help you manage your schedule." }]
                }
            ]
        });

        console.log("1. Sending message to AI...");
        const result = await chat.sendMessage(userMessage);
        const response = await result.response;
        
        // C. Handle Function Calls (The loop is built-in logic usually, but here is manual handling)
        const calls = response.functionCalls();
        
        if (calls && calls.length > 0) {
            console.log("2. AI requested tools:", calls.length);
            const toolParts = [];

            // Execute the SQL tools
            for (const call of calls) {
                const fn = toolsMap[call.name];
                if (fn) {
                    try {
                        const apiResult = await fn(call.args);
                        toolParts.push({
                            functionResponse: {
                                name: call.name,
                                response: { result: apiResult }
                            }
                        });
                    } catch (sqlError) {
                        toolParts.push({
                            functionResponse: {
                                name: call.name,
                                response: { error: sqlError.message }
                            }
                        });
                    }
                }
            }

            // Send tool outputs back to Gemini so it can generate the final confirmation text
            console.log("3. Sending tool results back to AI...");
            const finalResult = await chat.sendMessage(toolParts);
            const finalResponse = await finalResult.response;
            
            return res.json({ response: finalResponse.text() });
        }

        // D. Normal Text Response (No tools used)
        console.log("2. No tools needed, sending text response.");
        return res.json({ response: response.text() });

    } catch (error) {
        console.error("CRASH:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- 7. OTHER ROUTES (Keep your React fetching working) ---
app.get('/api/data/events', async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM events ORDER BY start_time ASC");
    res.json(rows);
});

app.get('/api/data/tasks', async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM tasks ORDER BY due_datetime ASC");
    res.json(rows);
});

// Start
app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});