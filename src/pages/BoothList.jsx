import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronRight, Users, Vote } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function BoothList() {
    const { wardId } = useParams();
    const [booths, setBooths] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [wardDetails, setWardDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [wardId]);

    async function fetchData() {
        try {
            // Fetch Ward Details
            const { data: wData } = await supabase.from('wards').select('*, panchayats(name)').eq('id', wardId).single();
            if (wData) setWardDetails(wData);

            // Fetch Booths
            const { data: bData } = await supabase
                .from('booths')
                .select('*')
                .eq('ward_id', wardId)
                .order('booth_no');
            setBooths(bData || []);

            // Fetch Candidates
            const { data: cData } = await supabase
                .from('candidates')
                .select('*')
                .eq('ward_id', wardId);
            setCandidates(cData || []);

        } catch (error) {
            console.error('Error fetching data:', error.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <span style={{ color: 'var(--text-light)', fontSize: '1rem' }}>
                    {wardDetails?.panchayats?.name} / വാർഡ് {wardDetails?.ward_no}
                </span>
                <h1 style={{ color: 'var(--primary-bg)' }}>{wardDetails?.name}</h1>
            </div>

            {/* Scroll Down Indicator */}
            {candidates.length > 0 && (
                <div className="scroll-down-indicator" style={{ margin: '0 0 2rem 0' }} onClick={() => document.getElementById('booths-section').scrollIntoView({ behavior: 'smooth' })}>
                    <span className="scroll-text">നിങ്ങളുടെ ബൂത്ത് തിരഞ്ഞെടുക്കുക</span>
                    <ChevronRight size={32} style={{ transform: 'rotate(90deg)' }} />
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
                                    {candidate.quote}
                                </div>
                                <div className="front-badge-container">
                                    <div className="ward-badge-text">{wardDetails?.name} വാർഡ്</div>
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
                                    <span className="candidate-name-highlight">{candidate.name}</span>-യെ
                                    <br />
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



            {/* Booths Section */}
            <section id="booths-section">
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
                        ഈ വാർഡിൽ ബൂത്തുകളൊന്നും കണ്ടെത്തിയില്ല.
                    </div>
                )}
            </section>
        </div>
    );
}
