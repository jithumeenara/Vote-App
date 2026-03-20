import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, X, RefreshCw } from 'lucide-react';
import { askDatabaseQuestion, parseUserQuery } from '../lib/ai';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function AiAssistant() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'നമസ്കാരം! വോട്ടർ ഡാറ്റ, സ്ഥിതിവിവരക്കണക്കുകൾ, വോട്ടർ തിരയൽ — എന്തും ചോദിക്കാം.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [baseContext, setBaseContext] = useState(null);
    const messagesEndRef = useRef(null);
    const scopeRef = useRef(null);

    const isWardMember = user?.role === 'ward_member';
    const isBoothMember = user?.role === 'booth_member';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load rich stats when chat opens
    useEffect(() => {
        if (isOpen && !baseContext) {
            loadBaseContext();
        }
    }, [isOpen]);

    // Build scope: which booth IDs, constituency, district this user can see
    async function getScope() {
        if (scopeRef.current) return scopeRef.current;

        let scope = { boothIds: null, scopeLabel: 'Admin (All Data)' };

        if (isBoothMember && user?.booth_id) {
            const { data: booth } = await supabase
                .from('booths')
                .select('*, constituencies(*, districts(*))')
                .eq('id', user.booth_id)
                .single();
            scope = {
                boothIds: [user.booth_id],
                constituencyId: booth?.constituency_id,
                scopeLabel: `Booth ${booth?.booth_no} - ${booth?.name}`,
                boothName: booth?.name,
                boothNo: booth?.booth_no,
                constituencyName: booth?.constituencies?.name,
                districtName: booth?.constituencies?.districts?.name,
            };
        } else if (isWardMember && user?.ward_id) {
            const [{ data: booths }, { data: constituency }] = await Promise.all([
                supabase.from('booths').select('id').eq('constituency_id', user.ward_id),
                supabase.from('constituencies').select('*, districts(*)').eq('id', user.ward_id).single()
            ]);
            scope = {
                boothIds: (booths || []).map(b => b.id),
                constituencyId: user.ward_id,
                scopeLabel: `Constituency ${constituency?.constituency_no} - ${constituency?.name}`,
                constituencyName: constituency?.name,
                districtName: constituency?.districts?.name,
            };
        }

        scopeRef.current = scope;
        return scope;
    }

    // Apply scope restriction to a Supabase query on 'voters' or 'booths'
    function applyScopeToQuery(query, table, scope) {
        if (!scope.boothIds) return query; // Admin — no filter
        if (table === 'voters') {
            return scope.boothIds.length > 0
                ? query.in('booth_id', scope.boothIds)
                : query.eq('id', 'none');
        }
        if (table === 'booths' && scope.constituencyId) {
            return query.eq('constituency_id', scope.constituencyId);
        }
        return query;
    }

    const loadBaseContext = useCallback(async () => {
        setStatsLoading(true);
        try {
            const scope = await getScope();

            const voterCount = (extraFilters = {}) => {
                let q = supabase.from('voters').select('*', { count: 'exact', head: true });
                q = applyScopeToQuery(q, 'voters', scope);
                Object.entries(extraFilters).forEach(([col, val]) => { q = q.eq(col, val); });
                return q;
            };

            // Run all stat queries in parallel
            const [total, male, female, voted, pending, deleted] = await Promise.all([
                voterCount(),
                voterCount({ gender: 'Male' }),
                voterCount({ gender: 'Female' }),
                voterCount({ has_voted: true }),
                voterCount({ has_voted: false }),
                voterCount({ status: 'deleted' }),
            ]);

            // Front-wise breakdown
            let frontBreakdown = [];
            const { data: fronts } = await supabase.from('fronts').select('id, name');
            if (fronts && fronts.length > 0) {
                frontBreakdown = await Promise.all(fronts.map(async front => {
                    let suppQ = supabase.from('voters').select('*', { count: 'exact', head: true }).eq('supported_front_id', front.id);
                    suppQ = applyScopeToQuery(suppQ, 'voters', scope);
                    let votedQ = supabase.from('voters').select('*', { count: 'exact', head: true }).eq('supported_front_id', front.id).eq('has_voted', true);
                    votedQ = applyScopeToQuery(votedQ, 'voters', scope);
                    const [{ count: supporters }, { count: frontVoted }] = await Promise.all([suppQ, votedQ]);
                    return {
                        front: front.name,
                        supporters: supporters || 0,
                        voted: frontVoted || 0,
                        pending: (supporters || 0) - (frontVoted || 0),
                        percentage: supporters > 0 ? ((frontVoted / supporters) * 100).toFixed(1) + '%' : '0%'
                    };
                }));
            }

            // Booth list (for admin / ward member)
            let boothList = [];
            if (!isBoothMember) {
                let bq = supabase.from('booths').select('booth_no, name, id');
                bq = applyScopeToQuery(bq, 'booths', scope);
                const { data: bData } = await bq;
                boothList = bData || [];
            }

            setBaseContext({
                scope: scope.scopeLabel,
                district: scope.districtName || null,
                constituency: scope.constituencyName || null,
                booth: scope.boothNo ? `${scope.boothNo} - ${scope.boothName}` : null,
                voterStats: {
                    total: total.count || 0,
                    male: male.count || 0,
                    female: female.count || 0,
                    voted: voted.count || 0,
                    pending: pending.count || 0,
                    deleted: deleted.count || 0,
                    votingPercentage: total.count > 0
                        ? ((voted.count / total.count) * 100).toFixed(1) + '%'
                        : '0%'
                },
                frontBreakdown: frontBreakdown.length > 0 ? frontBreakdown : 'No fronts configured',
                booths: boothList.length > 0 ? boothList.map(b => `${b.booth_no}-${b.name}`).join(', ') : null,
            });
        } catch (e) {
            console.error('Failed to load base context:', e);
        } finally {
            setStatsLoading(false);
        }
    }, [isBoothMember, isWardMember, user]);

    async function handleSend(e) {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const scope = await getScope();

            // 1. Parse intent
            const queryIntent = await parseUserQuery(userMsg.text);

            // 2. Execute specific query if needed
            let specificResult = null;
            if ((queryIntent.type === 'count' || queryIntent.type === 'list') && queryIntent.table) {
                const limit = Math.min(queryIntent.limit || 15, 20);
                let query = supabase.from(queryIntent.table);

                if (queryIntent.type === 'count') {
                    query = query.select('*', { count: 'exact', head: true });
                } else {
                    if (queryIntent.table === 'voters') {
                        query = query.select(
                            'sl_no, name, guardian_name, house_no, house_name, age, gender, id_card_no, has_voted, status, booths(booth_no, name)'
                        ).limit(limit);
                    } else if (queryIntent.table === 'booths') {
                        query = query.select('booth_no, name, constituencies(name, constituency_no, districts(name))').limit(limit);
                    } else {
                        query = query.select('*').limit(limit);
                    }
                }

                // Apply parsed filters
                (queryIntent.filters || []).forEach(f => {
                    if (f.operator === 'eq') query = query.eq(f.column, f.value);
                    else if (f.operator === 'ilike') query = query.ilike(f.column, `%${f.value}%`);
                    else if (f.operator === 'gt') query = query.gt(f.column, f.value);
                    else if (f.operator === 'lt') query = query.lt(f.column, f.value);
                    else if (f.operator === 'gte') query = query.gte(f.column, f.value);
                    else if (f.operator === 'lte') query = query.lte(f.column, f.value);
                });

                // Apply scope
                query = applyScopeToQuery(query, queryIntent.table, scope);

                const { data, count, error } = await query;
                if (!error) {
                    specificResult = {
                        intent: queryIntent,
                        result: queryIntent.type === 'count' ? { count } : data,
                        note: queryIntent.type === 'list' && data?.length === limit
                            ? `Showing first ${limit} results. More records may exist.`
                            : null
                    };
                }
            }

            // 3. Build full context (base stats + specific result)
            const context = {
                ...(baseContext || { voterStats: 'Loading...', scope: scope.scopeLabel }),
                ...(specificResult ? { specificQueryResult: specificResult } : {}),
                appName: 'എന്റെ വോട്ട് (My Vote)',
            };

            // 4. Ask AI
            const responseText = await askDatabaseQuestion(userMsg.text, context);
            setMessages(prev => [...prev, { role: 'assistant', text: responseText }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: `ക്ഷമിക്കണം, ഒരു തകരാർ സംഭവിച്ചു: ${error.message || 'Unknown error'}`
            }]);
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
                    width: '360px',
                    height: '520px',
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1000,
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '0.85rem 1rem',
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Bot size={20} />
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>AI സഹായം</div>
                                {statsLoading
                                    ? <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>ഡാറ്റ ലോഡ് ചെയ്യുന്നു...</div>
                                    : baseContext
                                        ? <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{baseContext.scope}</div>
                                        : null
                                }
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => { setBaseContext(null); scopeRef.current = null; loadBaseContext(); }}
                                title="Refresh stats"
                                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '6px', padding: '4px 6px' }}
                            >
                                <RefreshCw size={14} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Stats bar */}
                    {baseContext && (
                        <div style={{
                            padding: '0.4rem 0.75rem',
                            background: '#f5f3ff',
                            borderBottom: '1px solid #ede9fe',
                            display: 'flex',
                            gap: '0.75rem',
                            fontSize: '0.72rem',
                            color: '#5b21b6',
                            flexWrap: 'wrap'
                        }}>
                            <span>ആകെ: <strong>{baseContext.voterStats?.total}</strong></span>
                            <span>വോട്ട്: <strong>{baseContext.voterStats?.voted}</strong></span>
                            <span>ബാക്കി: <strong>{baseContext.voterStats?.pending}</strong></span>
                            <span>({baseContext.voterStats?.votingPercentage})</span>
                        </div>
                    )}

                    {/* Messages */}
                    <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#f9fafb' }}>
                        {messages.map((msg, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                marginBottom: '0.75rem'
                            }}>
                                <div style={{
                                    maxWidth: '85%',
                                    padding: '0.65rem 0.9rem',
                                    borderRadius: '12px',
                                    background: msg.role === 'user' ? '#6366f1' : 'white',
                                    color: msg.role === 'user' ? 'white' : '#1f2937',
                                    boxShadow: msg.role === 'assistant' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    borderBottomRightRadius: msg.role === 'user' ? '3px' : '12px',
                                    borderBottomLeftRadius: msg.role === 'assistant' ? '3px' : '12px',
                                    fontSize: '0.88rem',
                                    lineHeight: '1.5',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
                                <div style={{
                                    background: 'white', padding: '0.5rem 1rem',
                                    borderRadius: '12px', color: '#9ca3af', fontSize: '0.8rem',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                                    display: 'flex', gap: '4px', alignItems: 'center'
                                }}>
                                    <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                                    <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
                                    <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSend} style={{
                        padding: '0.75rem',
                        borderTop: '1px solid #e5e7eb',
                        display: 'flex',
                        gap: '0.5rem',
                        background: 'white'
                    }}>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="ചോദിക്കുക... (Malayalam / English)"
                            style={{
                                flex: 1,
                                padding: '0.65rem 0.85rem',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                outline: 'none',
                                fontSize: '0.88rem'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            style={{
                                background: loading || !input.trim() ? '#9ca3af' : '#6366f1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                width: '38px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                                transition: 'background 0.2s'
                            }}
                        >
                            <Send size={16} />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
