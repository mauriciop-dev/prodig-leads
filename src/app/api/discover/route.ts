import { NextResponse } from 'next/server';
import { findLeadsInstructions } from '@/lib/finder';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
    try {
        const { query } = await request.json();
        const results = await findLeadsInstructions(query || "pymes en colombia que necesiten automatizacion");

        let addedCount = 0;

        for (const result of results) {
            // Check availability
            const { data: existing } = await supabase.from('leads').select('id').eq('url', result.url).single();
            if (!existing) {
                await supabase.from('leads').insert({
                    url: result.url,
                    company_name: result.title,
                    status: 'new', // Ready for analysis
                    scraped_data: { description: result.description }
                });
                addedCount++;
            }
        }

        return NextResponse.json({ success: true, added: addedCount, results });
    } catch (error) {
        return NextResponse.json({ error: 'Discovery failed' }, { status: 500 });
    }
}
