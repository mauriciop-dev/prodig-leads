import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
// Ensure GEMINI_API_KEY is in .env.local
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface LeadAnalysis {
    techStack: string[];
    opportunities: string[];
    emailDraft: string;
}

export async function analyzeUrl(url: string): Promise<LeadAnalysis> {
    console.log(`Analyzing URL: ${url}`);

    try {
        // 1. Fetch the HTML
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        // 2. Extract basic info
        const title = $('title').text();
        const description = $('meta[name="description"]').attr('content') || '';
        const h1s = $('h1').map((i, el) => $(el).text()).get().join('; ');
        const bodyText = $('body').text().slice(0, 8000); // Larger context window for Gemini

        // 3. Prompt
        const prompt = `
      You are an expert Sales Engineer for AIProdig (aiprodig.com).
      AIProdig offers: Business Intelligence (Power BI), Enterprise Apps (Power Apps), Automation (n8n/Power Automate), and Local AI/Chatbots.
      
      Analyze this website context:
      Title: ${title}
      Description: ${description}
      Headers: ${h1s}
      Content Snippet: ${bodyText}

      Task:
      1. Identify Tech Stack.
      2. Identify 2-3 Opportunities for AIProdig services.
      3. Draft a cold email snippet (Subject + Body).

      Return ONLY valid JSON:
      {
        "techStack": ["Tool1"],
        "opportunities": ["Opp1"],
        "emailDraft": "Subject: ... Body: ..."
      }
    `;

        // 4. Call Gemini Flash (Fast & Cheap)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const data = JSON.parse(responseText);

        return {
            techStack: data.techStack || [],
            opportunities: data.opportunities || [],
            emailDraft: data.emailDraft || "Could not generate draft.",
        };

    } catch (error) {
        console.error("Analysis failed:", error);
        return {
            techStack: [],
            opportunities: ["Error in analysis"],
            emailDraft: "Error generating draft.",
        };
    }
}
