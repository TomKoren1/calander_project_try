require('dotenv').config();

async function checkAvailableModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ No API Key found in .env");
        return;
    }

    console.log("... Asking Google which models are available for this Key ...");

    try {
        // We use the direct REST API to list models
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", data.error);
            return;
        }

        console.log("\n✅ SUCCESS! Here are the models you can use:\n");
        
        // Filter for "generateContent" models only (the ones for chat)
        const chatModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
        
        chatModels.forEach(m => {
            console.log(`- ${m.name.replace('models/', '')}`);
        });

    } catch (error) {
        console.error("❌ Network/Script Error:", error);
    }
}

checkAvailableModels();