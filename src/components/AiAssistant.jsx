import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, MessageSquare } from 'lucide-react';
import { askDatabaseQuestion, parseUserQuery } from '../lib/ai';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sendTelegramAlert, TelegramAlerts } from '../lib/telegram';

export default function AiAssistant() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'നമസ്കാരം! വോട്ടർ പട്ടികയെക്കുറിച്ചോ ആപ്ലിക്കേഷനെക്കുറിച്ചോ നിങ്ങൾക്ക് എന്തും ചോദിക്കാം.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const [wardBoothIds, setWardBoothIds] = useState([]);

    const isWardMember = user?.role === 'ward_member';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch Booth IDs for Ward Member
    useEffect(() => {
        if (isWardMember && user?.ward_id) {
            const fetchBooths = async () => {
                const { data } = await supabase
                    .from('booths')
                    .select('id')
                    .eq('ward_id', user.ward_id);
                if (data) {
                    setWardBoothIds(data.map(b => b.id));
                }
            };
            fetchBooths();
        }
    }, [isWardMember, user]);

    async function handleSend(e) {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {


            // 1. Parse User Query Intent
            const queryIntent = await parseUserQuery(userMsg.text);
            console.log('Query Intent:', queryIntent);

            let context = {};

            // 2. Execute Database Query if needed
            if (queryIntent.type === 'count' || queryIntent.type === 'list') {
                if (queryIntent.table) {
                    let query = supabase.from(queryIntent.table);

                    if (queryIntent.type === 'count') {
                        query = query.select('*', { count: 'exact', head: true });
                    } else {
                        // Enhanced Select with Joins for better context
                        if (queryIntent.table === 'voters') {
                            query = query.select('*, booths(name, booth_no), wards(name, ward_no, panchayats(name))').limit(queryIntent.limit || 5);
                        } else if (queryIntent.table === 'booths') {
                            query = query.select('*, wards(name, ward_no, panchayats(name))').limit(queryIntent.limit || 5);
                        } else if (queryIntent.table === 'wards') {
                            query = query.select('*, panchayats(name)').limit(queryIntent.limit || 5);
                        } else if (queryIntent.table === 'candidates') {
                            query = query.select('*, wards(name, ward_no, panchayats(name))').limit(queryIntent.limit || 5);
                        } else {
                            query = query.select('*').limit(queryIntent.limit || 5);
                        }
                    }

                    // Apply Filters
                    if (queryIntent.filters) {
                        queryIntent.filters.forEach(f => {
                            if (f.operator === 'eq') query = query.eq(f.column, f.value);
                            else if (f.operator === 'gt') query = query.gt(f.column, f.value);
                            else if (f.operator === 'lt') query = query.lt(f.column, f.value);
                            else if (f.operator === 'gte') query = query.gte(f.column, f.value);
                            else if (f.operator === 'lte') query = query.lte(f.column, f.value);
                            else if (f.operator === 'ilike') query = query.ilike(f.column, `%${f.value}%`);
                        });
                    }

                    // --- SECURITY: Apply Ward Restrictions ---
                    if (isWardMember) {
                        if (queryIntent.table === 'voters') {
                            if (wardBoothIds.length > 0) {
                                query = query.in('booth_id', wardBoothIds);
                            } else {
                                // No booths in ward, so no voters
                                query = query.eq('id', -1); // Impossible ID
                            }
                        } else if (queryIntent.table === 'booths') {
                            query = query.eq('ward_id', user.ward_id);
                        } else if (queryIntent.table === 'candidates') {
                            query = query.eq('ward_id', user.ward_id);
                        } else if (queryIntent.table === 'wards') {
                            query = query.eq('id', user.ward_id);
                        } else if (queryIntent.table === 'panchayats') {
                            // Allow querying panchayats, but maybe we could restrict to the user's panchayat if needed.
                            // For now, let's allow it as it's general info.
                        }
                    }
                    // -----------------------------------------

                    const { data, count, error } = await query;

                    if (!error) {
                        context = {
                            queryIntent,
                            result: queryIntent.type === 'count' ? count : data
                        };
                    } else {
                        console.error('DB Query Error:', error);
                    }
                }
            }

            // Fallback to basic stats if no specific query or general question
            if (Object.keys(context).length === 0) {
                let totalVotersQuery = supabase.from('voters').select('*', { count: 'exact', head: true });

                // Apply Ward Restriction to Fallback
                if (isWardMember) {
                    if (wardBoothIds.length > 0) {
                        totalVotersQuery = totalVotersQuery.in('booth_id', wardBoothIds);
                    } else {
                        // No booths, return 0 count effectively
                        // We can't force count 0 easily with head:true, but we can filter by impossible condition
                        totalVotersQuery = totalVotersQuery.eq('id', -1);
                    }
                }

                const { count: totalVoters } = await totalVotersQuery;
                context = {
                    basicStats: { totalVoters },
                    appName: "എന്റെ വോട്ട് (My Vote)"
                };
            }

            // 3. Ask AI with Context
            const responseText = await askDatabaseQuestion(userMsg.text, context);

            setMessages(prev => [...prev, { role: 'assistant', text: responseText }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', text: `ക്ഷമിക്കണം, ഒരു തകരാർ സംഭവിച്ചു: ${error.message || 'Unknown error'}` }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    display: isOpen ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    transition: 'transform 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                <Bot size={32} />
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '350px',
                    height: '500px',
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1000,
                    overflow: 'hidden',
                    border: '1px solid #eee'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '1rem',
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Bot size={20} />
                            <span style={{ fontWeight: 'bold' }}>AI സഹായം</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#f9fafb' }}>
                        {messages.map((msg, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                marginBottom: '1rem'
                            }}>
                                <div style={{
                                    maxWidth: '80%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '12px',
                                    background: msg.role === 'user' ? '#6366f1' : 'white',
                                    color: msg.role === 'user' ? 'white' : '#333',
                                    boxShadow: msg.role === 'assistant' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                                    borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px'
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ background: 'white', padding: '0.5rem 1rem', borderRadius: '12px', color: '#666', fontSize: '0.8rem' }}>
                                    ടൈപ്പ് ചെയ്യുന്നു...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSend} style={{ padding: '1rem', borderTop: '1px solid #eee', display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="ചോദിക്കുക..."
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            style={{
                                background: '#6366f1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                width: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
