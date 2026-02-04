import { NextResponse } from 'next/server';
import { findLeadsInstructions } from '@/lib/finder';
import { analyzeLead } from '@/lib/analyzer';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with Service Role for background processing
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

const NICHES = [
  "empresas constructoras colombia proyectos nuevos",
  "empresas de logistica y transporte bogota",
  "exportadoras agricolas colombia",
  "agencias de marketing digital bogota",
  "software factories colombia"
];

export async function GET(request: Request) {
  try {
    // Basic security check for CRON_SECRET if provided
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[Cron] Starting daily workflow...');
    
    // Choose a random niche for today
    const randomNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
    console.log(`[Cron] Hunting for leads in: ${randomNiche}`);

    // 1. Find leads (Brave Search)
    const leadsFound = await findLeadsInstructions(randomNiche);
    
    // 2. Select 3-6 leads (let's go with 4 for stability)
    const candidates = leadsFound.slice(0, 4);
    const results = [];

    for (const item of candidates) {
        try {
            console.log(`[Cron] Processing potential lead: ${item.url}`);
            
            // Check if already exists
            const { data: existing } = await supabase
                .from('leads')
                .select('id, status')
                .eq('url', item.url)
                .single();

            if (existing && existing.status === 'analizado') {
                console.log(`[Cron] Skiping ${item.url} (Already analyzed)`);
                continue;
            }

            // Save to DB first
            const { data: newLead, error: saveError } = await supabase
                .from('leads')
                .upsert({
                    url: item.url,
                    company_name: item.title,
                    status: 'nuevo',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'url' })
                .select()
                .single();

            if (saveError) throw saveError;

            // Trigger Analysis
            console.log(`[Cron] Analyzing ${item.url}...`);
            const analysisResult = await analyzeLead(item.url);
            
            results.push({
                url: item.url,
                success: analysisResult.success,
                error: analysisResult.error || null
            });

        } catch (itemError: any) {
            console.error(`[Cron] Failed to process ${item.url}:`, itemError.message);
        }
    }

    console.log(`[Cron] Workflow finished. Processed ${results.length} leads.`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Daily workflow completed',
      leads_processed: results
    });

  } catch (error: any) {
    console.error('[Cron Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
