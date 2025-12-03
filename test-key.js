import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyAMCaXxZqZDmif_tvUGLjJdUj-mbYnkWg4";

async function test() {
    console.log("Testing API Key...");
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello");
        console.log("Success!");
        console.log(result.response.text());
    } catch (error) {
        console.error("Error Details:");
        console.error(error);
    }
}

test();
