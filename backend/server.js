const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

// --- 1. SETUP & CONFIGURATION ---
dotenv.config();
const app = express();
const PORT = 5001; // Same port as Python so React keeps working

// Middleware
app.use(cors());
app.use(express.json());

// Database Configuration
const dbConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'calander_project_try1'
};

// Create a connection pool (More efficient than single connections)
const pool = mysql.createPool(dbConfig);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- 2. HELPER FUNCTIONS ---

// Helper to get all valid table names
async function getValidatedTables() {
    const [rows] = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ?", 
        [dbConfig.database]
    );
    return rows.map(row => row.TABLE_NAME || row.table_name);
}

// Helper to get a default User ID
async function getDefaultUserId() {
    try {
        const [rows] = await pool.query("SELECT id FROM users LIMIT 1");
        return rows.length > 0 ? rows[0].id : "00000000-0000-0000-0000-000000000000";
    } catch (error) {
        return "00000000-0000-0000-0000-000000000000";
    }
}

// Helper to link items to goals
async function linkItemToGoal(connection, goalId, itemType, itemId) {
    try {
        const linkId = uuidv4();
        await connection.query(
            "INSERT INTO goal_links (id, goal_id, item_type, item_id) VALUES (?, ?, ?, ?)",
            [linkId, goalId, itemType, itemId]
        );
        console.log(`--- LINKED: ${itemType} ${itemId} -> Goal ${goalId} ---`);
    } catch (error) {
        console.error("Failed to link goal:", error);
    }
}

// --- 3. AI TOOLS (Defined as Functions) ---

const toolsMap = {
    create_goal_tool: async ({ title, end_date, description }) => {
        console.log(`--- AI TOOL: Creating Goal '${title}' ---`);
        const userId = await getDefaultUserId();
        const newId = uuidv4();
        const startDate = new Date().toISOString().split('T')[0];
        
        await pool.query(
            `INSERT INTO goals (id, user_id, title, description, start_date, end_date, status, progress_type) 
             VALUES (?, ?, ?, ?, ?, ?, 'active', 'manual')`,
            [newId, userId, title, description, startDate, end_date]
        );
        return newId; // Return ID as string
    },

    create_event_tool: async ({ title, start_time, end_time, description, goal_id }) => {
        console.log(`--- AI TOOL: Creating Event '${title}' ---`);
        const userId = await getDefaultUserId();
        const newId = uuidv4();
        
        await pool.query(
            `INSERT INTO events (id, user_id, title, start_time, end_time, description) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [newId, userId, title, start_time, end_time, description]
        );

        if (goal_id) await linkItemToGoal(pool, goal_id, 'event', newId);
        return "Success! Event created.";
    },

    create_task_tool: async ({ title, due_date, description, goal_id }) => {
        console.log(`--- AI TOOL: Creating Task '${title}' ---`);
        const userId = await getDefaultUserId();
        const newId = uuidv4();
        
        await pool.query(
            `INSERT INTO tasks (id, user_id, title, due_date, description, status) 
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [newId, userId, title, due_date, description]
        );

        if (goal_id) await linkItemToGoal(pool, goal_id, 'task', newId);
        return "Success! Task created.";
    },

    batch_create_tasks_tool: async ({ goal_id, tasks_json }) => {
        console.log(`--- AI TOOL: Batch Creating Tasks ---`);
        const userId = await getDefaultUserId();
        // Gemini sends the JSON string, we need to parse it
        let tasks = [];
        try {
            tasks = JSON.parse(tasks_json);
        } catch (e) {
            return "Error: Invalid JSON format provided.";
        }

        const connection = await pool.getConnection(); // Use transaction for batch
        try {
            await connection.beginTransaction();
            let count = 0;
            
            for (const task of tasks) {
                const newId = uuidv4();
                const title = task.title || 'Untitled';
                const dueDate = task.due_date || new Date().toISOString().split('T')[0];
                const desc = task.description || '';

                await connection.query(
                    `INSERT INTO tasks (id, user_id, title, due_date, description, status) 
                     VALUES (?, ?, ?, ?, ?, 'pending')`,
                    [newId, userId, title, dueDate, desc]
                );

                if (goal_id) {
                    const linkId = uuidv4();
                    await connection.query(
                        "INSERT INTO goal_links (id, goal_id, item_type, item_id) VALUES (?, ?, 'task', ?)",
                        [linkId, goal_id, newId]
                    );
                }
                count++;
            }
            await connection.commit();
            return `Success! Created ${count} tasks.`;
        } catch (err) {
            await connection.rollback();
            return `Error in batch creation: ${err.message}`;
        } finally {
            connection.release();
        }
    }
};

// --- 4. API ROUTES ---

// Root Check
app.get('/', (req, res) => {
    res.json({ message: "Node.js Server is Online!", status: "Online" });
});

// Get Tables
app.get('/api/tables', async (req, res) => {
    try {
        const tables = await getValidatedTables();
        res.json(tables);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get Data / Create Data (Dynamic Route)
app.use('/api/data/:table_name', async (req, res, next) => {
    // Middleware for table validation
    const tableName = req.params.table_name;
    try {
        const tables = await getValidatedTables();
        if (!tables.includes(tableName)) {
            return res.status(400).json({ error: "Invalid or unauthorized table name" });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: "Validation error" });
    }
});

app.get('/api/data/:table_name', async (req, res) => {
    const tableName = req.params.table_name;
    try {
        // Check for created_at column to sort
        const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE 'created_at'`);
        const orderBy = columns.length > 0 ? "ORDER BY created_at DESC" : "";
        
        const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` ${orderBy} LIMIT 100`);
        const [fields] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
        const colNames = fields.map(f => f.Field);

        res.json({ columns: colNames, rows: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/data/:table_name', async (req, res) => {
    const tableName = req.params.table_name;
    const data = req.body;
    
    if (!data || Object.keys(data).length === 0) return res.status(400).json({ error: "No data" });

    try {
        data.id = uuidv4(); // Generate ID
        
        // Clean empty strings to NULL
        Object.keys(data).forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        const keys = Object.keys(data).map(k => `\`${k}\``).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);

        await pool.query(`INSERT INTO \`${tableName}\` (${keys}) VALUES (${placeholders})`, values);
        
        console.log(`--- SUCCESS: Inserted into ${tableName} ---`);
        res.json({ success: true, message: "Inserted successfully", id: data.id });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Update / Delete Items
app.delete('/api/data/:table_name/:item_id', async (req, res) => {
    const { table_name, item_id } = req.params;
    try {
        const [result] = await pool.query(`DELETE FROM \`${table_name}\` WHERE id = ?`, [item_id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Item not found" });
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/data/:table_name/:item_id', async (req, res) => {
    const { table_name, item_id } = req.params;
    const data = req.body;
    try {
        delete data.id; // Protect ID
        // Clean empty strings
        Object.keys(data).forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        const setClause = Object.keys(data).map(k => `\`${k}\` = ?`).join(', ');
        const values = [...Object.values(data), item_id];

        const [result] = await pool.query(`UPDATE \`${table_name}\` SET ${setClause} WHERE id = ?`, values);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Item not found" });
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- 5. AI CHAT ROUTE ---

// Store history globally (simple memory)
let chatSession = null;

// Tool Definitions for Gemini (JSON Schema)
const toolsDef = [
    {
        function_declarations: [
            {
                name: "create_goal_tool",
                description: "Creates a high-level Goal.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING" },
                        end_date: { type: "STRING", description: "YYYY-MM-DD" },
                        description: { type: "STRING" }
                    },
                    required: ["title", "end_date", "description"]
                }
            },
            {
                name: "create_event_tool",
                description: "Creates a calendar event.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING" },
                        start_time: { type: "STRING", description: "YYYY-MM-DD HH:MM:SS" },
                        end_time: { type: "STRING", description: "YYYY-MM-DD HH:MM:SS" },
                        description: { type: "STRING" },
                        goal_id: { type: "STRING" }
                    },
                    required: ["title", "start_time", "end_time", "description"]
                }
            },
            {
                name: "create_task_tool",
                description: "Creates a task.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING" },
                        due_date: { type: "STRING", description: "YYYY-MM-DD" },
                        description: { type: "STRING" },
                        goal_id: { type: "STRING" }
                    },
                    required: ["title", "due_date", "description"]
                }
            },
            {
                name: "batch_create_tasks_tool",
                description: "Creates multiple tasks at once.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        goal_id: { type: "STRING" },
                        tasks_json: { type: "STRING", description: "JSON string of tasks list" }
                    },
                    required: ["tasks_json"]
                }
            }
        ]
    }
];

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", tools: toolsDef });

        if (!chatSession) {
            chatSession = model.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: `
                            You are an expert Personal Coach and Curriculum Designer.
                            YOUR RULES:
                            1. **No Summaries:** Do NOT create single "Week 1-4" tasks. User wants DETAILED schedule.
                            2. **Granularity:** If user asks "4 times a week for 3 months", generate ~48 UNIQUE tasks.
                            3. **Progression:** Don't repeat "Piano Practice". Be specific: "Session 1: Middle C", "Session 2: Scales".
                            4. **Batching:** Generate full JSON list and send to 'batch_create_tasks_tool'.
                            
                            PROCESS:
                            1. Ask clarifying questions if needed.
                            2. Design curriculum.
                            3. Call 'create_goal_tool'.
                            4. Call 'batch_create_tasks_tool' with full detailed list (JSON string).
                        ` }]
                    },
                    {
                        role: "model",
                        parts: [{ text: "Understood. I am ready to act as your Personal Coach." }]
                    }
                ]
            });
        }

        // Send message with context
        const todayStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }); // Adjust TZ if needed
        const result = await chatSession.sendMessage(`[SYSTEM: Current Time is ${todayStr}]\nUser: ${userMessage}`);
        const response = await result.response;
        
        // Handle Function Calls
        const calls = response.functionCalls();
        if (calls) {
            const toolParts = [];
            for (const call of calls) {
                const fn = toolsMap[call.name];
                if (fn) {
                    const toolResult = await fn(call.args);
                    toolParts.push({
                        functionResponse: {
                            name: call.name,
                            response: { result: toolResult }
                        }
                    });
                }
            }
            // Send tool results back to AI
            const finalResult = await chatSession.sendMessage(toolParts);
            return res.json({ response: finalResult.response.text() });
        }

        return res.json({ response: response.text() });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- 6. START SERVER ---
app.listen(PORT, () => {
    console.log(`--- Node.js Server running on http://127.0.0.1:${PORT} ---`);
});