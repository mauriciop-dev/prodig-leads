import { NextResponse } from 'next/server';
import { findLeadsInstructions } from '@/lib/finder';
import { analyzeLead } from '@/lib/analyzer';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with Service Role for background processing
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[Cron] Starting daily workflow...');
    
    // 1. Get leads (using default query or simulated findings)
    const leadsFound = await findLeadsInstructions();
    
    // 2. Process found leads (simulated for now)
    console.log(`[Cron] Found ${leadsFound.length} potential leads.`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Daily workflow triggered and leads processed',
      leads_count: leadsFound.length
    });
  } catch (error: any) {
    console.error('[Cron Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
