import { NextResponse } from 'next/server';
import { findLeadsInstructions } from '@/lib/finder';
import { analyzeUrl } from '@/lib/analyzer';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
    // CRON Jobs are usually GET requests
    console.log("Starting Daily Workflow...");

    try {
        // 1. Discover New Leads
        // Ideally the query rotates or is smart. For now, hardcoded.
        const results = await findLeadsInstructions("empresas de manufactura en colombia sitio web");

        const newLeadsIds: string[] = [];

        // 2. Insert into DB
        for (const result of results) {
            const { data: existing } = await supabase.from('leads').select('id').eq('url', result.url).single();
            if (!existing) {
                const { data, error } = await supabase.from('leads').insert({
                    url: result.url,
                    company_name: result.title,
                    status: 'new',
                    scraped_data: { description: result.description }
                }).select();

                if (data) newLeadsIds.push(data[0].id);
            }
        }

        // 3. Analyze the new leads immediately
        for (const id of newLeadsIds) {
            // Fetch to get URL
            const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single();
            if (lead) {
                const analysis = await analyzeUrl(lead.url);
                await supabase.from('leads').update({
                    status: 'analyzed',
                    scraped_data: { ...lead.scraped_data, techStack: analysis.techStack },
                    ai_analysis: { opportunities: analysis.opportunities },
                    email_draft: analysis.emailDraft
                }).eq('id', id);
            }
        }

        return NextResponse.json({ success: true, processed: newLeadsIds.length });

    } catch (error) {
        console.error("Daily Workflow Error:", error);
        return NextResponse.json({ error: 'Workflow Failed' }, { status: 500 });
    }
}
