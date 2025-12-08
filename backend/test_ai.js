require('dotenv').config(); // Load your .env file
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function runTest() {
  try {
    console.log("1. Starting connection...");

    // Initialize
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Make sure this matches your .env variable name
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    console.log("2. Sending simple message...");
    
    // Send a single prompt (no chat history)
    const result = await model.generateContent("Hello Gemini, are you online?");
    
    console.log("3. Waiting for response...");
    const response = await result.response;
    const text = response.text();

    console.log("--- SUCCESS ---");
    console.log("Gemini says:", text);

  } catch (error) {
    console.error("--- ERROR ---");
    console.error(error);
  }
}

runTest();