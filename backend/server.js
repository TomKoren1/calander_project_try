const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

// --- 1. SETUP ---
dotenv.config();
const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// --- NEW: IN-MEMORY CHAT STORAGE ---
// This will hold the chat history while the server is running.
// If you restart the server, the memory is wiped (which is fine for testing).
const activeChats = {}; 

// --- 2. DATABASE CONNECTION ---
const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'calander_project_try1'
});

// --- 3. HELPER FUNCTIONS ---
async function getDefaultUserId() {
    try {
        const [rows] = await pool.query("SELECT id FROM users LIMIT 1");
        if (rows.length === 0) {
            console.error("❌ ERROR: No users found. Create a user first.");
            return "00000000-0000-0000-0000-000000000000";
        }
        return rows[0].id;
    } catch (error) {
        console.error("DB Error:", error);
        return null;
    }
}

// --- 4. TOOL IMPLEMENTATIONS ---
const toolsMap = {
    create_task: async ({ title, due_datetime, description, priority }) => {
        console.log(`Executing: Create Task "${title}"`);
        const userId = await getDefaultUserId();
        const newId = uuidv4();
        
        await pool.query(
            `INSERT INTO tasks (id, user_id, title, description, due_date, status, priority, is_flagged) VALUES (?, ?, ?, ?, ?, 'pending', ?, FALSE)`,
            [newId, userId, title, description || '', due_datetime, priority || 1]
        );
        return `Success! Task created with ID: ${newId}`;
    },
    create_event: async ({ title, start_time, end_time, description, location }) => {
        console.log(`Executing: Create Event "${title}"`);
        const userId = await getDefaultUserId();
        const newId = uuidv4();

        await pool.query(
            `INSERT INTO events (id, user_id, title, description, start_time, end_time, location, status, all_day) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', FALSE)`,
            [newId, userId, title, description || '', start_time, end_time, location || '']
        );
        return `Success! Event created with ID: ${newId}`;
    }
};

// --- 5. AI TOOL DEFINITIONS ---
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
        const sessionId = req.body.sessionId || 'default-session';

        // 1. Setup Groq Client (Using OpenAI compatibility)
        const client = new OpenAI({
            apiKey: process.env.GROQ_API_KEY, // Get this from console.groq.com
            baseURL: "https://api.groq.com/openai/v1" // <--- IMPORTANT: Points to Groq
        });

        // 2. Define Tools (OpenAI format is slightly different than Gemini's)
        const tools = [
            {
                type: "function",
                function: {
                    name: "create_task",
                    description: "Add a new item to the to-do list.",
                    parameters: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            due_datetime: { type: "string", description: "ISO format YYYY-MM-DD HH:MM:SS" },
                            description: { type: "string" },
                            priority: { type: "number", description: "1 (Low) to 5 (High)" }
                        },
                        required: ["title", "due_datetime"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "create_event",
                    description: "Schedule an event on the calendar.",
                    parameters: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            start_time: { type: "string", description: "ISO format YYYY-MM-DD HH:MM:SS" },
                            end_time: { type: "string", description: "ISO format YYYY-MM-DD HH:MM:SS" },
                            description: { type: "string" },
                            location: { type: "string" }
                        },
                        required: ["title", "start_time", "end_time"]
                    }
                }
            }
        ];

        // 3. Manage History (We need to convert your history format to OpenAI's)
        if (!activeChats[sessionId]) {
            activeChats[sessionId] = [
                { role: "system", content: `You are a helpful Calendar Assistant. Current Date: ${new Date().toLocaleString()}` }
            ];
        }
        
        // Add user message to history
        activeChats[sessionId].push({ role: "user", content: userMessage });

        console.log("1. Sending message to Groq...");
        
        // 4. Call the API
        const response = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile", // <--- THE BEST MODEL
            messages: activeChats[sessionId],
            tools: tools,
            tool_choice: "auto"
        });

        const msg = response.choices[0].message;
        
        // Add AI response to history
        activeChats[sessionId].push(msg);

        // 5. Handle Tool Calls
        if (msg.tool_calls) {
            console.log("2. AI requested tools:", msg.tool_calls.length);
            
            for (const toolCall of msg.tool_calls) {
                const fnName = toolCall.function.name;
                const fnArgs = JSON.parse(toolCall.function.arguments);
                const fn = toolsMap[fnName];

                if (fn) {
                    try {
                        const toolResult = await fn(fnArgs);
                        // Add tool result to history
                        activeChats[sessionId].push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ result: toolResult })
                        });
                    } catch (err) {
                        activeChats[sessionId].push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: err.message })
                        });
                    }
                }
            }

            // 6. Final follow-up request to AI with tool results
            const secondResponse = await client.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: activeChats[sessionId]
            });

            const finalMsg = secondResponse.choices[0].message;
            activeChats[sessionId].push(finalMsg);
            return res.json({ response: finalMsg.content });
        }

        return res.json({ response: msg.content });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});
// --- 7. OTHER ROUTES ---
app.get('/api/data/events', async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM events ORDER BY start_time ASC");
    res.json(rows);
});

app.get('/api/data/tasks', async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM tasks ORDER BY due_datetime ASC");
    res.json(rows);
});

app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});