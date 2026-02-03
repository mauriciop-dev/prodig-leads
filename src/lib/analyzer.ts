import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Analyzes a lead's website using DeepSeek AI and saves the results to Supabase.
 */
export async function analyzeLead(url: string) {
    // We check for DEEPSEEK_API_KEY, but fallback to GEMINI_API_KEY in case the user just swapped the value
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || '';
    
    console.log(`[Analyzer] Processing with DeepSeek: ${url}`);
    
    if (!apiKey) {
        return { success: false, error: "API Key (DeepSeek/Gemini) is not configured in environment variables." };
    }

    try {
        // 1. Scrape Website Content
        let html = '';
        try {
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(10000),
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' 
                }
            });
            if (response.ok) html = await response.text();
        } catch (fetchError) {
            console.warn(`[Analyzer] Fetch error for ${url}:`, fetchError);
        }

        const $ = cheerio.load(html || '<html></html>');
        const title = $('title').text().trim() || url;
        const metaDesc = $('meta[name="description"]').attr('content') || '';
        const bodyText = $('body').text().substring(0, 4000).replace(/\s+/g, ' ');

        // 2. Prepare DeepSeek Prompt
        const prompt = `
            Analyze the following website for an AI/Automation Agency:
            URL: ${url}
            Title: ${title}
            Description: ${metaDesc}
            Content: ${bodyText}
            
            Return ONLY a valid JSON object in this format (nothing else):
            {
                "company_name": "Standardized company name",
                "tech_stack": ["tech1", "tech2"],
                "opportunities": ["AI opportunity 1", "AI opportunity 2"],
                "hooks": ["Outreach hook"],
                "email_draft": "Personalized cold email in Spanish"
            }
        `;

        // 3. Call DeepSeek API (OpenAI Compatible)
        console.log(`[Analyzer] Calling DeepSeek API...`);
        const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are a professional business analyst. Output only valid JSON objects." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        if (!deepseekResponse.ok) {
            const errorData = await deepseekResponse.json().catch(() => ({}));
            throw new Error(`DeepSeek API Error: ${errorData.error?.message || deepseekResponse.statusText}`);
        }

        const completion = await deepseekResponse.json();
        const responseText = completion.choices[0].message.content;
        const analysis = JSON.parse(responseText);

        // 4. Store in Supabase
        console.log(`[Analyzer] Storing results for ${analysis.company_name}...`);
        const { data, error: dbError } = await supabase
            .from('leads')
            .upsert({
                url,
                company_name: analysis.company_name || title,
                status: 'analizado',
                scraped_data: { title, description: metaDesc },
                ai_analysis: analysis,
                email_draft: analysis.email_draft,
                updated_at: new Date().toISOString()
            }, { onConflict: 'url' })
            .select();

        if (dbError) throw new Error(`Database Error: ${dbError.message}`);

        return { 
            success: true, 
            lead: data?.[0],
            message: "Lead successfully analyzed with DeepSeek."
        };

    } catch (error: any) {
        console.error(`[Analyzer] Critical Error:`, error.message);
        return { success: false, error: error.message };
    }
}
