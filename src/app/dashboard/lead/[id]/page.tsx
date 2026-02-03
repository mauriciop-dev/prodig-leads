'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation'; // Correct hook for Nextjs 14 App Router params (actually useParams doesn't exist in page props? It's {params})
// Correct way for Page params in App Router:
// export default function Page({ params }: { params: { id: string } })

import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Sparkles, Send, Copy, Loader2, Save } from 'lucide-react';
import Link from 'next/link';

export default function LeadDetail({ params }: { params: { id: string } }) {
    const [lead, setLead] = useState<any>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [emailBody, setEmailBody] = useState('');

    useEffect(() => {
        fetchLead();
    }, [params.id]);

    const fetchLead = async () => {
        const { data } = await supabase.from('leads').select('*').eq('id', params.id).single();
        if (data) {
            setLead(data);
            if (data.email_draft) setEmailBody(data.email_draft);
        }
    };

    const runAnalysis = async () => {
        setAnalyzing(true);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                body: JSON.stringify({ url: lead.url, id: lead.id }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                await fetchLead(); // Reload to get new data
            }
        } catch (e) {
            console.error(e);
        }
        setAnalyzing(false);
    };

    const saveDraft = async () => {
        await supabase.from('leads').update({ email_draft: emailBody }).eq('id', lead.id);
        alert('Draft saved!');
    };

    if (!lead) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-white font-sans flex">
            {/* Left Sidebar - Context */}
            <div className="w-1/3 border-r border-gray-800 p-6 flex flex-col h-screen overflow-y-auto">
                <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition">
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>

                <div className="mb-8">
                    <h1 className="text-2xl font-bold mb-2 break-all">{lead.company_name || new URL(lead.url).hostname}</h1>
                    <a href={lead.url} target="_blank" className="text-blue-400 hover:underline text-sm">{lead.url}</a>
                </div>

                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-gray-300">AI Intelligence</h2>
                        <button
                            onClick={runAnalysis}
                            disabled={analyzing}
                            className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-full flex items-center gap-1 transition disabled:opacity-50"
                        >
                            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {analyzing ? 'Analyzing...' : 'Run Analysis'}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                            <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Tech Stack</h3>
                            <div className="flex flex-wrap gap-2">
                                {lead.scraped_data?.techStack?.map((t: string) => (
                                    <span key={t} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">{t}</span>
                                ))}
                                {!lead.scraped_data?.techStack && <span className="text-gray-600 text-xs text-center block w-full">- No data -</span>}
                            </div>
                        </div>

                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                            <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Detected Opportunities</h3>
                            <ul className="list-disc list-inside space-y-2">
                                {lead.ai_analysis?.opportunities?.map((opp: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-300 leading-snug">{opp}</li>
                                ))}
                                {!lead.ai_analysis?.opportunities && <span className="text-gray-600 text-xs text-center block w-full">- No opportunities detected yet -</span>}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Content - Action */}
            <div className="w-2/3 p-8 h-screen flex flex-col">
                <header className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Outreach Draft</h2>
                    <div className="flex gap-3">
                        <button onClick={saveDraft} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition">
                            <Save size={16} /> Save Draft
                        </button>
                        <a
                            href={`mailto:?subject=${encodeURIComponent("Proposal from AIProdig")}&body=${encodeURIComponent(emailBody)}`}
                            className="px-6 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 transition shadow-lg shadow-green-900/20"
                        >
                            <Send size={16} /> Send Email
                        </a>
                    </div>
                </header>

                <div className="flex-1 bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-inner flex flex-col">
                    <textarea
                        className="flex-1 bg-transparent outline-none resize-none text-gray-300 leading-relaxed font-mono text-sm"
                        placeholder="Generative AI will write the email here..."
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                    />
                    <div className="mt-4 flex justify-end text-xs text-gray-600">
                        {emailBody.length} characters
                    </div>
                </div>
            </div>
        </div>
    );
}
