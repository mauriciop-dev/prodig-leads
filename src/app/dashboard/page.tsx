'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Plus, RefreshCw, Send, Trash2 } from 'lucide-react';

export default function Dashboard() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUrl, setNewUrl] = useState('');

    const fetchLeads = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        else setLeads(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const addLead = async () => {
        console.log('Attempting to add lead:', newUrl);
        if (!newUrl) {
            console.warn('Add Lead: URL is empty');
            return;
        }
        
        const { data, error } = await supabase.from('leads').insert({
            url: newUrl,
            status: 'new'
        }).select();

        if (error) {
            console.error('Supabase error adding lead:', error);
            alert(`Error adding lead: ${error.message}`);
        } else {
            console.log('Lead added successfully:', data);
            setNewUrl('');
            fetchLeads();
        }
    };

    const deleteLead = async (id: string) => {
        await supabase.from('leads').delete().eq('id', id);
        fetchLeads();
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            AIProDig Leads
                        </h1>
                        <p className="text-gray-400">Daily automation & outreach dashboard</p>
                    </div>
                    <button onClick={fetchLeads} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition">
                        <RefreshCw size={20} />
                    </button>
                </header>

                {/* Input Section */}
                <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-2xl mb-8 flex gap-4 backdrop-blur-sm">
                    <input
                        type="text"
                        placeholder="Enter potential client URL (e.g. https://example.com)"
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                    />
                    <button
                        onClick={addLead}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition shadow-lg shadow-blue-900/20"
                    >
                        <Plus size={18} /> Add Lead
                    </button>
                </div>

                {/* Kanban / List Grid */}
                {loading ? (
                    <div className="text-center py-20 text-gray-500 animate-pulse">Loading workspace...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {leads.map((lead) => (
                            <div key={lead.id} className="group bg-gray-900 border border-gray-800 hover:border-blue-500/50 rounded-2xl p-5 transition-all hover:shadow-2xl hover:shadow-blue-900/10 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`px-2 py-1 rounded-md text-xs font-mono uppercase tracking-wide ${lead.status === 'analyzed' ? 'bg-green-900/30 text-green-400' :
                                                lead.status === 'contacted' ? 'bg-purple-900/30 text-purple-400' :
                                                    'bg-gray-800 text-gray-400'
                                            }`}>
                                            {lead.status}
                                        </span>
                                        <button onClick={() => deleteLead(lead.id)} className="text-gray-600 hover:text-red-400 transition">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <h3 className="font-semibold text-lg truncate mb-1">{lead.company_name || lead.url}</h3>
                                    <a href={lead.url} target="_blank" className="text-sm text-gray-500 hover:text-blue-400 flex items-center gap-1 mb-4 truncate">
                                        {lead.url}
                                    </a>

                                    {lead.ai_analysis?.opportunities ? (
                                        <div className="space-y-2 mb-4">
                                            {lead.ai_analysis.opportunities.slice(0, 2).map((opp: string, i: number) => (
                                                <div key={i} className="text-xs bg-gray-800/50 px-2 py-1 rounded border-l-2 border-blue-500 text-gray-300">
                                                    {opp}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-600 italic mb-4">Waiting for analysis...</p>
                                    )}
                                </div>

                                <Link
                                    href={`/dashboard/lead/${lead.id}`}
                                    className="block w-full text-center bg-gray-800 hover:bg-gray-700 py-3 rounded-xl text-sm font-medium transition"
                                >
                                    Open Workstation
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
