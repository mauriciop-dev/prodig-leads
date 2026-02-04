import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Analyzes a lead's website using Groq AI and saves the results to Supabase.
 */
export async function analyzeLead(url: string) {
    // Look for GROQ_API_KEY first, then fallbacks in case the user reused old variables
    const apiKey = process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || '';
    
    console.log(`[Analyzer] Start processing with Groq: ${url}`);
    
    if (!apiKey) {
        return { success: false, error: "GROQ_API_KEY is missing. Please add it to your Vercel Environment Variables." };
    }

    try {
        // 1. Scrape Website Content
        let html = '';
        try {
            console.log(`[Analyzer] Scraping ${url}...`);
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(15000),
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
                }
            });
            
            if (response.ok) {
                html = await response.text();
            }
        } catch (fetchError: any) {
            console.warn(`[Analyzer] Scraping warn for ${url}: ${fetchError.message}`);
        }

        const $ = cheerio.load(html || '<html></html>');
        const title = $('title').text().trim() || url;
        const metaDesc = $('meta[name="description"]').attr('content') || '';
        const h1s = $('h1').map((i, el) => $(el).text()).get().join(' ');
        const bodyText = $('body').text().substring(0, 5000).replace(/\s+/g, ' ');

        // 2. Prepare Prompt
        const prompt = `
            Analyze the following website for an AI/Automation potential analysis.
            URL: ${url}
            Title: ${title}
            Description: ${metaDesc}
            Headings: ${h1s}
            Content Snippet: ${bodyText}

            Provide a professional analysis in Spanish. 
            Focus on identifying manual processes that can be improved with AI or automation.
            Return ONLY a valid JSON object with this structure:
            {
              "company_name": "Name of the company",
              "tech_stack": ["detected tech 1", "tech 2"],
              "opportunities": ["opportunity 1 in Spanish", "opportunity 2 in Spanish"],
              "email_draft": "A professional and personalized outreach email in Spanish (Markdown formatted)"
            }
        `;

        // 3. Call Groq (OpenAI Compatible API)
        console.log(`[Analyzer] Requesting Groq analysis (llama-3.3-70b)...`);
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a professional business analyst specializing in AI. You output ONLY JSON." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error(`[Analyzer] Groq API Error: ${groqResponse.status}`, errorText);
            throw new Error(`Groq API Error: ${groqResponse.statusText}`);
        }

        const completion = await groqResponse.json();
        const responseText = completion.choices[0].message.content;
        const analysis = JSON.parse(responseText);

        // 4. Update Supabase
        console.log(`[Analyzer] Saving Groq results for ${url}...`);
        const { data, error: dbError } = await supabase
            .from('leads')
            .update({
                company_name: analysis.company_name || title,
                status: 'analizado',
                scraped_data: { 
                    title, 
                    description: metaDesc, 
                    tech_stack: analysis.tech_stack || [],
                    provider: 'groq'
                },
                ai_analysis: analysis,
                email_draft: analysis.email_draft,
                updated_at: new Date().toISOString()
            })
            .eq('url', url)
            .select();

        if (dbError) throw new Error(`Database Error: ${dbError.message}`);

        return { 
            success: true, 
            lead: data?.[0],
            message: "Success"
        };

    } catch (error: any) {
        console.error(`[Analyzer] Critical Failure:`, error.message);
        return { success: false, error: error.message };
    }
}
