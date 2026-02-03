'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Sparkles, Send, Copy, Loader2, Save } from 'lucide-react';
import Link from 'next/link';

export default function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
    // In Next.js 15, params is a promise that must be unwrapped
    const { id } = use(params);
    
    const [lead, setLead] = useState<any>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [emailBody, setEmailBody] = useState('');

    useEffect(() => {
        fetchLead();
    }, [id]);

    const fetchLead = async () => {
        const { data } = await supabase.from('leads').select('*').eq('id', id).single();
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
        <div className="flex min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500/30">
            {/* Left Sidebar - Meta */}
            <div className="w-1/3 border-r border-gray-800 p-8 h-screen overflow-y-auto bg-gray-900/50 backdrop-blur-xl">
                <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition group">
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                </Link>

                <div className="space-y-8">
                    <header>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">{lead.company_name || (lead.url ? new URL(lead.url).hostname : 'Lead')}</h1>
                        <a href={lead.url} target="_blank" className="text-blue-400 hover:text-blue-300 transition break-all">{lead.url}</a>
                    </header>

                    <button 
                        onClick={runAnalysis}
                        disabled={analyzing}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl flex items-center justify-center gap-3 font-semibold shadow-lg shadow-blue-900/20 transition disabled:opacity-50"
                    >
                        {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />} 
                        {analyzing ? 'Analyzing Website...' : 'Analyze with Intelligence'}
                    </button>

                    <div className="space-y-6">
                        <div className="p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">AI Intelligence</h3>
                            <div className="mb-4">
                                <p className="text-sm text-gray-400 mb-1">Tech Stack</p>
                                <div className="flex flex-wrap gap-2">
                                    {lead.scraped_data?.tech_stack?.map((tech: string) => (
                                        <span key={tech} className="px-2 py-1 bg-gray-700 rounded-md text-xs font-medium">{tech}</span>
                                    )) || <span className="text-gray-600 italic">No tech stack data yet</span>}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Detected Opportunities</p>
                                <ul className="space-y-2">
                                    {lead.ai_analysis?.opportunities?.map((opp: string) => (
                                        <li key={opp} className="text-sm flex gap-2">
                                            <span className="text-blue-500">•</span> {opp}
                                        </li>
                                    )) || <span className="text-gray-600 italic">Analyze to see opportunities</span>}
                                </ul>
                            </div>
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
