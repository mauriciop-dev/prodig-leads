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
        const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
        if (error) {
            console.error('Error fetching lead:', error);
        }
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
                alert('Analysis complete! Data has been updated.');
                await fetchLead(); // Reload to get new data
            } else {
                alert('Error in analysis: ' + (data.error || 'Unknown error'));
            }
        } catch (e: any) {
            console.error('Analysis request failed:', e);
            alert('Failure: Could not communicate with the analysis server.');
        } finally {
            setAnalyzing(false);
        }
    };

    const saveDraft = async () => {
        const { error } = await supabase.from('leads').update({ email_draft: emailBody }).eq('id', lead.id);
        if (error) {
            alert('Error saving draft: ' + error.message);
        } else {
            alert('Draft saved successfully!');
        }
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
                        <h1 className="text-3xl font-bold tracking-tight mb-2 truncate" title={lead.company_name || (lead.url ? new URL(lead.url).hostname : 'Lead')}>
                            {lead.company_name || (lead.url ? new URL(lead.url).hostname : 'Lead')}
                        </h1>
                        <a href={lead.url} target="_blank" className="text-blue-400 hover:text-blue-300 transition break-all text-sm">{lead.url}</a>
                    </header>

                    <button 
                        onClick={runAnalysis}
                        disabled={analyzing}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl flex items-center justify-center gap-3 font-semibold shadow-lg shadow-blue-900/20 transition disabled:opacity-50"
                    >
                        {analyzing ? <Loader2 className="animate-spin text-white" /> : <Sparkles size={20} />} 
                        {analyzing ? 'Analyzing Website...' : 'Analyze with Intelligence'}
                    </button>

                    <div className="space-y-6">
                        <div className="p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">AI Intelligence</h3>
                            
                            <div className="mb-6">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Tech Stack</p>
                                <div className="flex flex-wrap gap-2">
                                    {lead.scraped_data?.tech_stack?.length > 0 ? (
                                        lead.scraped_data.tech_stack.map((tech: string) => (
                                            <span key={tech} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md text-[10px] font-bold border border-blue-500/20">{tech}</span>
                                        ))
                                    ) : (
                                        <span className="text-gray-600 text-xs italic">Run analysis to identify technologies</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Detected Opportunities</p>
                                <ul className="space-y-3">
                                    {lead.ai_analysis?.opportunities?.length > 0 ? (
                                        lead.ai_analysis.opportunities.map((opp: string, idx: number) => (
                                            <li key={idx} className="text-sm text-gray-300 flex gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                                {opp}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-gray-600 text-xs italic">Opportunities will appear after analysis</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Status/Dates */}
                        <div className="flex justify-between items-center px-2">
                             <span className="text-[10px] text-gray-600 uppercase font-bold tracking-tighter">Status: {lead.status}</span>
                             <span className="text-[10px] text-gray-600">Updated: {new Date(lead.updated_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Content - Action */}
            <div className="w-2/3 p-8 h-screen flex flex-col">
                <header className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        Outreach Draft
                        {analyzing && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full animate-pulse uppercase tracking-widest">Generating...</span>}
                    </h2>
                    <div className="flex gap-3">
                        <button onClick={() => {
                            navigator.clipboard.writeText(emailBody);
                            alert('Copied to clipboard!');
                        }} className="p-2 text-gray-400 hover:text-white transition">
                            <Copy size={18} />
                        </button>
                        <button onClick={saveDraft} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition border border-gray-700">
                            <Save size={16} /> Save Draft
                        </button>
                        <a
                            href={`mailto:?subject=${encodeURIComponent("Proposal from AIProdig")}&body=${encodeURIComponent(emailBody)}`}
                            className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 transition shadow-lg shadow-blue-900/40 font-bold"
                        >
                            <Send size={16} /> Send Email
                        </a>
                    </div>
                </header>

                <div className="flex-1 bg-gray-900/50 rounded-3xl p-8 border border-gray-800 shadow-2xl flex flex-col overflow-hidden">
                    <textarea
                        className="flex-1 bg-transparent outline-none resize-none text-gray-300 leading-relaxed font-mono text-base placeholder:text-gray-700"
                        placeholder="DeepSeek AI will write the personalized email draft here once the website is analyzed..."
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                    />
                    <div className="mt-6 pt-6 border-t border-gray-800 flex justify-between items-center transition">
                        <div className="flex gap-4">
                             <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">AI Mode: Analysis</span>
                             </div>
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono">
                            {emailBody.length} characters
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
