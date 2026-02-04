import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Analyzes a lead's website using Groq AI plus external search for deep personalization.
 */
export async function analyzeLead(url: string) {
    const groqKey = process.env.GROQ_API_KEY || '';
    const braveKey = process.env.BRAVE_API_KEY || '';
    
    console.log(`[Analyzer] Deep Research started for: ${url}`);
    
    if (!groqKey) {
        return { success: false, error: "GROQ_API_KEY is missing." };
    }

    try {
        // 1. SCALING WEB SCRAPING: Get Main Page + Look for Social Links
        let html = '';
        let socialLinks: string[] = [];
        try {
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(15000),
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            if (response.ok) {
                html = await response.text();
                const $ = cheerio.load(html);
                // Search for social links in the HTML
                $('a[href]').each((_, el) => {
                    const href = $(el).attr('href') || '';
                    if (href.includes('linkedin.com/company') || href.includes('facebook.com') || href.includes('instagram.com')) {
                        socialLinks.push(href);
                    }
                });
            }
        } catch (e) {
            console.warn(`[Analyzer] Primary scrape failed:`, e);
        }

        // 2. EXTERNAL SEARCH: Search for recent news and info (Brave Search)
        let externalContext = "";
        if (braveKey) {
            try {
                const domain = new URL(url).hostname.replace('www.', '');
                const query = `${domain} news projects achievements linkedin facebook`;
                console.log(`[Analyzer] Searching Brave for: ${query}`);
                
                const searchRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
                    headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey }
                });
                
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    externalContext = searchData.web?.results?.map((r: any) => `${r.title}: ${r.description}`).join("\n") || "";
                }
            } catch (e) {
                console.warn(`[Analyzer] External search failed:`, e);
            }
        }

        const $ = cheerio.load(html || '<html></html>');
        const title = $('title').text().trim() || url;
        const bodyContent = $('body').text().substring(0, 6000).replace(/\s+/g, ' ');

        // 3. GROQ ANALYSIS WITH DEEP CONTEXT
        const prompt = `
            Eres Mauricio Pineda, consultor experto en IA de ProDig. Tu misión es redactar un correo de prospección ULTRA-PERSONALIZADO.
            
            FUENTES DE INVESTIGACIÓN:
            - Sitio Web: ${title} | ${url}
            - Redes detectadas: ${socialLinks.join(', ')}
            - Contexto Externo (Noticias/Logros): ${externalContext}
            - Contenido Web Extraído: ${bodyContent}

            INSTRUCCIONES DE CORREO (ESTILO N8N HUMANO):
            1. PRIMER PÁRRAFO (CRÍTICO): Empieza elogiando un logro real, un proyecto reciente o un detalle específico que encontraste en la investigación (especialmente si viene del "Contexto Externo" o redes sociales). NO uses frases genéricas como "he revisado su web". Di algo como "Me encantó ver su reciente participación en..." o "Felicidades por el nuevo proyecto de vivienda en...".
            2. CONEXIÓN: Conecta ese logro con una oportunidad técnica. Ejemplo: "Para soportar ese crecimiento, un asistente de IA especializado en [tema] podría...".
            3. TONO: Mauricio Pineda, cercano, experto, cero "robot".
            4. FORMATO: Texto plano. Sin encabezados Markdown (###). Sin negritas innecesarias.

            Devuelve UNICAMENTE un objeto JSON:
            {
              "company_name": "Nombre real",
              "tech_stack": ["tech1", "tech2"],
              "opportunities": ["oportunidad1", "oportunidad2"],
              "email_draft": "Cuerpo del correo (Español)",
              "research_notes": "Breve resumen de qué lograste encontrar en redes o noticias"
            }
        `;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.8
            })
        });

        if (!groqResponse.ok) throw new Error("Groq analysis failed");

        const completion = await groqResponse.json();
        const analysis = JSON.parse(completion.choices[0].message.content);

        // 4. Update Supabase
        const { data, error: dbError } = await supabase
            .from('leads')
            .update({
                company_name: analysis.company_name || title,
                status: 'analizado',
                ai_analysis: analysis,
                email_draft: analysis.email_draft,
                scraped_data: { 
                    social_links: socialLinks, 
                    research_found: analysis.research_notes,
                    external_context: externalContext.substring(0, 500)
                },
                updated_at: new Date().toISOString()
            })
            .eq('url', url)
            .select();

        if (dbError) throw new Error(`Database Error: ${dbError.message}`);

        return { success: true, lead: data?.[0] };

    } catch (error: any) {
        console.error(`[Analyzer] Failure:`, error.message);
        return { success: false, error: error.message };
    }
}
