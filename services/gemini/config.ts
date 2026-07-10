
import { GoogleGenAI } from "@google/genai";

export interface TrackApiCallParams {
  model: string;
  promptTokens: number;
  responseTokens: number;
  latencyMs: number;
}

export type ModelRole = 'creative' | 'extraction';

export function trackApiCall(params: TrackApiCallParams): void {
  try {
    console.group(`[Gemini API] ${params.model}`);
    console.log(`Prompt Tokens: ${params.promptTokens ?? 'N/A'}`);
    console.log(`Response Tokens: ${params.responseTokens ?? 'N/A'}`);
    console.log(`Total Tokens: ${(params.promptTokens ?? 0) + (params.responseTokens ?? 0)}`);
    console.log(`Latency: ${params.latencyMs}ms`);
    console.groupEnd();
  } catch {
    // NFR14 — must never throw
  }
}

export function defaultModelConfig(role: ModelRole): { temperature: number; topP: number } {
    switch (role) {
        case 'creative':
            return { temperature: 0.7, topP: 0.95 };
        case 'extraction':
            return { temperature: 0.2, topP: 0.5 };
    }
}

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
