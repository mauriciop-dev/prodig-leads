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
    const apiKey = process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || '';
    
    console.log(`[Analyzer] Start processing with Groq: ${url}`);
    
    if (!apiKey) {
        return { success: false, error: "GROQ_API_KEY is missing. Please add it to your Vercel Environment Variables." };
    }

    try {
        // 1. Scrape Website Content
        let html = '';
        try {
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

        // 2. Prepare Prompt (Improved to match User's n8n style)
        const prompt = `
            Actúa como Mauricio Pineda, consultor experto en IA de ProDig. 
            Analiza el sitio web para identificar procesos manuales que puedan ser mejorados con IA (chatbots, automatización, visión artificial, etc.).

            DATOS DEL SITIO:
            URL: ${url}
            Título: ${title}
            Descripción: ${metaDesc}
            Encabezados: ${h1s}
            Contenido: ${bodyText}

            INSTRUCCIONES PARA EL CORREO:
            1. Tono: Cálido, profesional, humano y consultivo.
            2. Estructura: 
               - Gancho personalizado: Menciona algo específico del negocio basado en los datos proporcionados.
               - Valor: Explica brevemente cómo la IA (ej. un chatbot entrenado con su información técnica) puede resolver un problema específico que detectaste.
               - CTA: Pide agendar una llamada de 15 minutos para mostrar ejemplos.
            3. REGLA CRÍTICA: NO uses encabezados de Markdown (###) ni un formato de "reporte". El correo debe fluir como un mensaje directo y personal. NO uses "Estimado equipo", usa "Estimados amigos de [Nombre Empresa]" o un saludo profesional similar.

            Devuelve UNICAMENTE un objeto JSON válido con esta estructura:
            {
              "company_name": "Nombre real de la empresa",
              "tech_stack": ["tecnología detectada 1", "2"],
              "opportunities": ["oportunidad específica 1", "2"],
              "email_draft": "Cuerpo del correo listo para copiar y pegar (en Español)"
            }
        `;

        // 3. Call Groq
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "Eres un analista de negocios experto. Solo respondes en formato JSON puro." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        if (!groqResponse.ok) throw new Error(`Groq API Error: ${groqResponse.statusText}`);

        const completion = await groqResponse.json();
        const responseText = completion.choices[0].message.content;
        const analysis = JSON.parse(responseText);

        // 4. Update Supabase
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

        return { success: true, lead: data?.[0] };

    } catch (error: any) {
        console.error(`[Analyzer] Failure:`, error.message);
        return { success: false, error: error.message };
    }
}
