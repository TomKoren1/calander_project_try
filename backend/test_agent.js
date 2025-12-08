const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

// --- 1. SETUP DB ---
const dbConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'calander_project_try1'
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- 2. HELPERS ---
async function getRealUserId(conn) {
    // Try to find an existing user
    const [rows] = await conn.execute("SELECT id FROM users LIMIT 1");
    if (rows.length > 0) {
        return rows[0].id;
    }
    // If table is empty, create a dummy user
    console.log("   -> No users found. Creating a test user...");
    const newId = uuidv4();
    await conn.execute("INSERT INTO users (id, email, name) VALUES (?, 'test_agent@example.com', 'Test Agent')", [newId]);
    return newId;
}

// --- 3. MOCK TOOLS ---
async function search_tool(query) {
    console.log(`   [TOOL] Searching DB for: "${query}"...`);
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute("SELECT id, title, start_time FROM events WHERE title LIKE ? LIMIT 3", [`%${query}%`]);
    await conn.end();
    if (rows.length === 0) return "No events found.";
    // Important: Return JSON so AI can parse the ID
    return JSON.stringify(rows);
}

async function update_tool(id, start_time) {
    console.log(`   [TOOL] Updating Event ID: ${id} to ${start_time}...`);
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute("UPDATE events SET start_time = ? WHERE id = ?", [start_time, id]);
    await conn.end();
    return "Success: Event updated in DB.";
}

// --- 4. THE TEST ---
async function runTest() {
    console.log("--- 🧪 STARTING AI AGENT TEST ---");

    const tools = [
        {
            functionDeclarations: [
                {
                    name: "search_items_tool",
                    description: "Finds the ID of an event. Use this FIRST.",
                    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] }
                },
                {
                    name: "update_event_tool",
                    description: "Updates an event time. Requires ID found by search.",
                    parameters: { 
                        type: "OBJECT", 
                        properties: { 
                            id: { type: "STRING" }, 
                            start_time: { type: "STRING" } 
                        }, 
                        required: ["id", "start_time"] 
                    }
                }
            ]
        }
    ];

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash", 
        tools: tools,
        systemInstruction: { parts: [{ text: "You are a database admin. You MUST use tools to answer. If asked to change an event, SEARCH for it first, then UPDATE it using the ID." }] }
    });

    const chat = model.startChat();

    // --- STEP A: Create a Dummy Event to modify ---
    console.log("\n1️⃣  Creating a test event 'Meeting with Yuval' manually in DB...");
    const conn = await mysql.createConnection(dbConfig);
    
    // ⭐️ FIX: Get a REAL User ID so DB doesn't crash ⭐️
    const realUserId = await getRealUserId(conn);
    
    const testId = uuidv4();
    await conn.execute("INSERT INTO events (id, user_id, title, start_time, end_time) VALUES (?, ?, ?, ?, ?)", 
        [testId, realUserId, 'Meeting with Yuval', '2025-11-20 10:00:00', '2025-11-20 11:00:00']);
    await conn.end();
    console.log("   -> Created successfully.");

    // --- STEP B: Ask AI to move it ---
    const userPrompt = "Change my 'Meeting with Yuval' to 2025-11-23 10:00:00";
    console.log(`\n2️⃣  Sending Prompt: "${userPrompt}"`);
    
    let result = await chat.sendMessage(userPrompt);
    let calls = result.response.functionCalls();

    // --- STEP C: Handle Tool Loop ---
    // If calls is undefined, the AI refused to use tools.
    if (!calls) {
        console.log("\n❌ FAILURE: AI replied with text instead of using a tool.");
        console.log(`AI Response: ${result.response.text()}`);
        return;
    }

    while (calls) {
        const parts = [];
        for (const call of calls) {
            console.log(`\n🤖 AI REQUESTS TOOL: ${call.name}`);
            
            let toolResult = "";
            if (call.name === "search_items_tool") {
                toolResult = await search_tool(call.args.query);
            } else if (call.name === "update_event_tool") {
                toolResult = await update_tool(call.args.id, call.args.start_time);
            }
            
            console.log(`   -> Result: ${toolResult}`);
            parts.push({ functionResponse: { name: call.name, response: { result: toolResult } } });
        }
        
        // Send tool result back to AI
        result = await chat.sendMessage(parts);
        calls = result.response.functionCalls(); // Check if it wants to call MORE tools
    }

    console.log(`\n✅ FINAL AI RESPONSE: ${result.response.text()}`);
    console.log("\n--- TEST COMPLETE ---");
}

runTest();