import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronRight, ChevronDown, Users, Vote, Search, X, MapPin } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import Fuse from 'fuse.js';
import { transliterateMalayalamToEnglish } from '../utils/transliteration';

export default function BoothList() {
    const { constituencyId } = useParams();
    const [booths, setBooths] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [constituencyDetails, setConstituencyDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [allVoters, setAllVoters] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const loadingRef = useRef(false);

    useEffect(() => {
        fetchData();
    }, [constituencyId]);

    async function fetchData() {
        try {
            const { data: wData } = await supabase.from('constituencies').select('*, districts(name)').eq('id', constituencyId).single();
            if (wData) setConstituencyDetails(wData);

            const { data: bData } = await supabase
                .from('booths').select('*').eq('constituency_id', constituencyId).order('booth_no');
            setBooths(bData || []);

            const { data: cData } = await supabase
                .from('candidates').select('*').eq('constituency_id', constituencyId);
            setCandidates(cData || []);
        } catch (error) {
            console.error('Error fetching data:', error.message);
        } finally {
            setLoading(false);
        }
    }

    // Lazy-load all voters when user starts typing
    async function loadAllVoters(currentBooths) {
        if (allVoters !== null || loadingRef.current) return;
        loadingRef.current = true;
        setSearchLoading(true);
        try {
            const boothIds = currentBooths.map(b => b.id);
            if (boothIds.length === 0) return;
            const BATCH = 1000;
            let all = [];
            let from = 0;
            while (true) {
                const { data, error } = await supabase
                    .from('voters')
                    .select('sl_no, name, guardian_name, house_no, house_name, age, gender, id_card_no, status, booth_id, booths(booth_no, name)')
                    .in('booth_id', boothIds)
                    .range(from, from + BATCH - 1);
                if (error || !data || data.length === 0) break;
                all = [...all, ...data];
                if (data.length < BATCH) break;
                from += BATCH;
            }
            setAllVoters(all);
        } catch (e) {
            console.error(e);
        } finally {
            setSearchLoading(false);
            loadingRef.current = false;
        }
    }

    const handleSearchChange = (val) => {
        setSearchTerm(val);
        if (val.length >= 2 && allVoters === null) {
            loadAllVoters(booths);
        }
    };

    const fuse = useMemo(() => {
        if (!allVoters || allVoters.length === 0) return null;
        const data = allVoters.map(v => ({
            ...v,
            manglishName: transliterateMalayalamToEnglish(v.name || '').toLowerCase(),
            manglishGuardian: transliterateMalayalamToEnglish(v.guardian_name || '').toLowerCase(),
            sl_no_str: String(v.sl_no),
        }));
        return new Fuse(data, {
            keys: [
                { name: 'name', weight: 2 },
                { name: 'manglishName', weight: 2 },
                { name: 'sl_no_str', weight: 2 },
                { name: 'id_card_no', weight: 1.5 },
                { name: 'house_name', weight: 1 },
                { name: 'house_no', weight: 1 },
                { name: 'guardian_name', weight: 0.8 },
                { name: 'manglishGuardian', weight: 0.8 },
            ],
            threshold: 0.35, distance: 200, minMatchCharLength: 2,
            includeScore: true, ignoreLocation: true, findAllMatches: true,
        });
    }, [allVoters]);

    const searchResults = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return null;
        if (!fuse) return [];
        return fuse.search(searchTerm, { limit: 40 }).map(r => r.item);
    }, [searchTerm, fuse]);

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <span style={{ color: 'var(--text-light)', fontSize: '1rem' }}>
                    {constituencyDetails?.districts?.name} / നിയോജക മണ്ഡലം {constituencyDetails?.constituency_no}
                </span>
                <h1 style={{ color: 'var(--primary-bg)' }}>{constituencyDetails?.name}</h1>
            </div>

            {/* Scroll Down Indicator */}
            {candidates.length > 0 && (
                <div
                    className="scroll-down-indicator"
                    style={{
                        margin: '0 auto 2rem auto',
                        textAlign: 'center',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                    onClick={() => document.getElementById('booths-section').scrollIntoView({ behavior: 'smooth' })}
                >
                    <span className="scroll-text" style={{ color: '#cf2e4d', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        നിങ്ങളുടെ ബൂത്ത് തിരഞ്ഞെടുക്കുക
                    </span>
                    <ChevronDown
                        size={32}
                        className="animate-bounce"
                        style={{ color: '#cf2e4d' }}
                    />
                </div>
            )}

            {/* Candidates Section */}
            <section style={{ marginBottom: '3rem' }}>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
                    <Vote size={24} color="var(--primary)" /> സ്ഥാനാർത്ഥി
                </h3>
                <div className="grid grid-3">
                    {candidates.map((candidate) => (
                        <div key={candidate.id} className="election-poster">
                            <div className="poster-top-badges">
                                <div className="slogan-badge">
                                    {candidate.quote || 'ചുറ്റിക അരിവാൾ നക്ഷത്രം'}
                                </div>
                                <div className="front-badge-container">
                                    <div className="ward-badge-text">{constituencyDetails?.name} നിയോജക മണ്ഡലം</div>
                                    <div className="front-name">{candidate.front}</div>
                                    <div className="candidate-label">സ്ഥാനാർത്ഥി</div>
                                </div>
                            </div>

                            <div className="poster-image-container">
                                <img
                                    src={candidate.photo_url || 'https://via.placeholder.com/300'}
                                    alt={candidate.name}
                                    className="poster-main-photo"
                                />
                            </div>

                            <div className="poster-bottom-section">
                                {candidate.symbol_url && (
                                    <img src={candidate.symbol_url} alt="Symbol" className="poster-symbol-large" />
                                )}
                                <div className="vote-appeal-text">
                                    <span className="candidate-name-highlight">സഖാവ്. {candidate.name}-യെ</span>
                                    വിജയിപ്പിക്കുക
                                </div>
                            </div>
                        </div>
                    ))}
                    {candidates.length === 0 && (
                        <div style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>സ്ഥാനാർത്ഥികളെ ചേർത്തിട്ടില്ല.</div>
                    )}
                </div>
            </section>

            {/* Global Search Bar */}
            <section id="booths-section">
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="എല്ലാ ബൂത്തുകളിലും തിരയുക: പേര്, Manglish, SL No, ഐഡി, വീട്..."
                            value={searchTerm}
                            onChange={e => handleSearchChange(e.target.value)}
                            style={{
                                width: '100%', padding: '0.9rem 3rem 0.9rem 3.2rem',
                                borderRadius: '16px', border: '2px solid rgba(55,17,32,0.12)',
                                background: 'white', fontSize: '1rem', outline: 'none',
                                color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                            onBlur={e => { e.target.style.borderColor = 'rgba(55,17,32,0.12)'; }}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '4px' }}>
                                <X size={18} />
                            </button>
                        )}
                    </div>
                    {searchLoading && (
                        <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                            വോട്ടർ ഡേറ്റ ലോഡ് ചെയ്യുന്നു...
                        </div>
                    )}
                </div>

                {/* Search Results */}
                {searchResults !== null ? (
                    <div>
                        <div style={{ marginBottom: '1rem', color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: '600' }}>
                            {searchResults.length > 0 ? `${searchResults.length} ഫലങ്ങൾ കണ്ടെത്തി` : 'ഫലങ്ങളൊന്നും കണ്ടെത്തിയില്ല'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {searchResults.map((voter, idx) => {
                                const isDeleted = voter.status === 'deleted';
                                const isShifted = voter.status === 'shifted';
                                return (
                                    <Link key={voter.id || idx} to={`/booth/${voter.booth_id}`} style={{ textDecoration: 'none' }}>
                                        <div style={{
                                            background: 'white', borderRadius: '14px', padding: '1rem 1.25rem',
                                            border: '1px solid rgba(55,17,32,0.08)',
                                            boxShadow: '0 2px 8px rgba(55,17,32,0.06)',
                                            display: 'flex', gap: '1rem', alignItems: 'flex-start',
                                            transition: 'box-shadow 0.2s',
                                        }}>
                                            {/* Serial No box */}
                                            <div style={{
                                                background: 'var(--primary-bg)', minWidth: '40px', height: '40px',
                                                borderRadius: '10px', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontWeight: '700', fontSize: '1rem',
                                                color: '#facc15', flexShrink: 0,
                                            }}>{voter.sl_no}</div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {/* Name + status badge */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                                                    <span style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--text)' }}>{voter.name}</span>
                                                    {(isDeleted || isShifted) && (
                                                        <span style={{ background: isDeleted ? '#fee2e2' : '#fef3c7', color: isDeleted ? '#ef4444' : '#d97706', padding: '1px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700' }}>
                                                            {isDeleted ? 'Deleted' : 'Shifted'}
                                                        </span>
                                                    )}
                                                </div>
                                                {voter.guardian_name && (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.3rem' }}>
                                                        രക്ഷിതാവ്: {voter.guardian_name}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.85rem', color: '#555', marginBottom: '0.4rem' }}>
                                                    {(voter.house_no || voter.house_name) && (
                                                        <span>{[voter.house_no, voter.house_name].filter(Boolean).join(' / ')}</span>
                                                    )}
                                                    {voter.age && <span>{voter.age} വ. • {voter.gender}</span>}
                                                    {voter.id_card_no && <span style={{ color: 'var(--primary-bg)', fontWeight: '600' }}>{voter.id_card_no}</span>}
                                                </div>
                                                {/* Booth badge */}
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#f0f4ff', color: '#3b4db8', padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
                                                    <MapPin size={12} />
                                                    ബൂത്ത് {voter.booths?.booth_no} — {voter.booths?.name}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Normal Booth List */
                    <div>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
                            <Users size={24} color="var(--primary)" /> ബൂത്തുകൾ
                        </h3>
                        <div className="grid">
                            {booths.map((booth) => (
                                <Link key={booth.id} to={`/booth/${booth.id}`} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                            ബൂത്ത് നമ്പർ: {booth.booth_no}
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{booth.name}</div>
                                    </div>
                                    <div className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '1rem' }}>
                                        വോട്ടർ പട്ടിക <ChevronRight size={20} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                        {booths.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>
                                ഈ നിയോജക മണ്ഡലത്തിൽ ബൂത്തുകളൊന്നും കണ്ടെത്തിയില്ല.
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
