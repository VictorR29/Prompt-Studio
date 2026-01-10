
import { GoogleGenAI } from "@google/genai";

export const getAiClient = () => {
    const apiKey = localStorage.getItem('userGeminiKey') || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

export const trackApiRequest = () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const usageData = localStorage.getItem('gemini_api_usage');
        let count = 0;
        if (usageData) {
            const parsed = JSON.parse(usageData);
            if (parsed.date === today) {
                count = parsed.count;
            }
        }
        localStorage.setItem('gemini_api_usage', JSON.stringify({ date: today, count: count + 1 }));
    } catch (e) {
        console.warn("Analytics error", e);
    }
};
