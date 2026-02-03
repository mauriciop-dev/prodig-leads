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
    
    console.log(`[Analyzer] Start processing: ${url}`);
    
    if (!apiKey) {
        return { success: false, error: "API Key (DeepSeek) is missing. Please add DEEPSEEK_API_KEY to your Vercel Environment Variables." };
    }

    try {
        // 1. Scrape Website Content slowly and carefully
        let html = '';
        let scrapeSuccess = false;
        
        try {
            console.log(`[Analyzer] Scraping ${url}...`);
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(15000), // Increased to 15s
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                }
            });
            
            if (response.ok) {
                html = await response.text();
                scrapeSuccess = true;
                console.log(`[Analyzer] Successfully scraped ${html.length} bytes.`);
            } else {
                console.warn(`[Analyzer] Fetch failed with status ${response.status} for ${url}`);
            }
        } catch (fetchError: any) {
            console.warn(`[Analyzer] Scraping error for ${url}: ${fetchError.message}`);
        }

        const $ = cheerio.load(html || '<html></html>');
        const title = $('title').text().trim() || url;
        const metaDesc = $('meta[name="description"]').attr('content') || '';
        // Extract links and headers to get more context even if body text is blocked
        const h1s = $('h1').map((i, el) => $(el).text()).get().join(' ');
        const bodyText = $('body').text().substring(0, 5000).replace(/\s+/g, ' ');

        // 2. Prepare DeepSeek Prompt
        const prompt = `
            Analyze the following website for an AI/Automation potential analysis.
            URL: ${url}
            Title: ${title}
            Description: ${metaDesc}
            Headings: ${h1s}
            Content Snippet: ${bodyText}

            Provide a professional analysis in Spanish.
            Return ONLY a valid JSON object with this structure:
            {
              "company_name": "Name of the company",
              "tech_stack": ["detected tech 1", "tech 2"],
              "opportunities": ["opportunity 1 in Spanish", "opportunity 2 in Spanish"],
              "email_draft": "A professional and personalized outreach email in Spanish (Markdown formatted)"
            }
        `;

        // 3. Call DeepSeek
        console.log(`[Analyzer] Requesting DeepSeek analysis...`);
        const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are a professional business analyst specializing in AI and automation. You output only pure JSON." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            console.error(`[Analyzer] DeepSeek API Error: ${deepseekResponse.status}`, errorText);
            throw new Error(`AI Provider Error: ${deepseekResponse.statusText}`);
        }

        const completion = await deepseekResponse.json();
        const responseText = completion.choices[0].message.content;
        
        let analysis;
        try {
            analysis = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Analyzer] Failed to parse AI response:', responseText);
            throw new Error("The AI returned an invalid format.");
        }

        // 4. Update Supabase
        console.log(`[Analyzer] Saving results for ${url}...`);
        const { data, error: dbError } = await supabase
            .from('leads')
            .update({
                company_name: analysis.company_name || title,
                status: 'analizado',
                scraped_data: { 
                    title, 
                    description: metaDesc, 
                    tech_stack: analysis.tech_stack || [],
                    scraped_at: new Date().toISOString()
                },
                ai_analysis: analysis,
                email_draft: analysis.email_draft,
                updated_at: new Date().toISOString()
            })
            .eq('url', url)
            .select();

        if (dbError) {
            console.error('[Analyzer] Database Error:', dbError);
            throw new Error(`Database Update Failed: ${dbError.message}`);
        }

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
