import { NextResponse } from 'next/server';
import { analyzeUrl } from '@/lib/analyzer';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, id } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // 1. Run Analysis
        const analysis = await analyzeUrl(url);

        // 2. Update Supabase (if id is provided, we update the existing lead)
        if (id) {
            const { error } = await supabase
                .from('leads')
                .update({
                    status: 'analyzed',
                    scraped_data: { techStack: analysis.techStack },
                    ai_analysis: { opportunities: analysis.opportunities },
                    email_draft: analysis.emailDraft,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (error) {
                console.error('Supabase update error:', error);
                return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
            }
        } else {
            // Create new if strictly needed, but usually we ingest first then analyze
            // For simplicity, let's allow creating:
            const { error } = await supabase.from('leads').insert({
                url,
                status: 'analyzed',
                scraped_data: { techStack: analysis.techStack },
                ai_analysis: { opportunities: analysis.opportunities },
                email_draft: analysis.emailDraft,
            });
            if (error) return NextResponse.json({ error: 'Failed to insert' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: analysis });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
