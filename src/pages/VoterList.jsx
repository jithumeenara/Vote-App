import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, User } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { transliterateMalayalamToEnglish } from '../utils/transliteration';

export default function VoterList() {
    const { boothId } = useParams();
    const [voters, setVoters] = useState([]);
    const [boothDetails, setBoothDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, [boothId]);

    async function fetchData() {
        try {
            // Fetch Booth Details
            const { data: bData } = await supabase
                .from('booths')
                .select('*, wards(name, ward_no, panchayats(name))')
                .eq('id', boothId)
                .single();
            if (bData) setBoothDetails(bData);

            // Fetch Voters
            const { data, error } = await supabase
                .from('voters')
                .select('*')
                .eq('booth_id', boothId)
                .order('sl_no');

            if (error) throw error;
            setVoters(data || []);
        } catch (error) {
            console.error('Error fetching voters:', error.message);
        } finally {
            setLoading(false);
        }
    }

    const filteredVoters = useMemo(() => {
        if (!searchTerm) return voters;
        const lowerTerm = searchTerm.toLowerCase();
        return voters.filter(v => {
            const manglishName = transliterateMalayalamToEnglish(v.name).toLowerCase();
            const manglishHouse = transliterateMalayalamToEnglish(v.house_name).toLowerCase();
            const manglishGuardian = transliterateMalayalamToEnglish(v.guardian_name).toLowerCase();

            return (
                v.name.toLowerCase().includes(lowerTerm) ||
                manglishName.includes(lowerTerm) ||
                v.house_name?.toLowerCase().includes(lowerTerm) ||
                manglishHouse.includes(lowerTerm) ||
                v.id_card_no?.toLowerCase().includes(lowerTerm) ||
                v.guardian_name?.toLowerCase().includes(lowerTerm) ||
                manglishGuardian.includes(lowerTerm) ||
                v.sl_no.toString().includes(lowerTerm)
            );
        });
    }, [voters, searchTerm]);

    if (loading) return <LoadingSpinner text="വോട്ടർ പട്ടിക ലോഡുചെയ്യുന്നു..." />;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <span style={{ color: 'var(--text-light)', fontSize: '1rem' }}>
                    {boothDetails?.wards?.panchayats?.name} / വാർഡ് {boothDetails?.wards?.ward_no}
                </span>
                <h1 style={{ color: 'var(--primary-bg)' }}>{boothDetails?.name}</h1>
                <div style={{ fontSize: '1rem', color: 'var(--text-light)', marginTop: '0.5rem', fontWeight: '600' }}>
                    ആകെ വോട്ടർമാർ: {voters.length}
                </div>
            </div>

            <div className="search-bar">
                <Search className="search-icon" size={24} />
                <input
                    type="text"
                    className="search-input"
                    placeholder="പേര്, ഐഡി കാർഡ്, വീട്ടുപേര് അല്ലെങ്കിൽ ക്രമനമ്പർ തിരയുക..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {filteredVoters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    "{searchTerm}" എന്ന പേരിൽ വോട്ടർമാരെ കണ്ടെത്തിയില്ല
                </div>
            ) : (
                <div className="grid grid-2">
                    {filteredVoters.map((voter) => (
                        <div key={voter.id} className="card voter-card" style={{
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: (voter.status === 'shifted' || voter.status === 'deleted') ? '#fee2e2' : 'white'
                        }}>
                            {(voter.status === 'shifted' || voter.status === 'deleted') && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                                    zIndex: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        backgroundColor: voter.status === 'deleted' ? '#ef4444' : '#f59e0b',
                                        color: 'white',
                                        padding: '0.5rem 2rem',
                                        fontSize: '1.5rem',
                                        fontWeight: '900',
                                        transform: 'rotate(-15deg)',
                                        border: '4px solid white',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '2px'
                                    }}>
                                        {voter.status === 'shifted' ? 'SHIFTED' : 'DELETED'}
                                    </div>
                                </div>
                            )}
                            <div className="sl-no-badge" style={{ zIndex: 1, position: 'relative' }}>
                                ക്രമനമ്പർ: {voter.sl_no}
                            </div>

                            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', position: 'relative', zIndex: 1 }}>
                                <div style={{ background: '#fdf2f4', padding: '1rem', borderRadius: '50%' }}>
                                    <User size={32} color="var(--primary)" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 className="voter-name">{voter.name}</h3>
                                    <div style={{ fontSize: '1rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                                        {voter.guardian_name ? `രക്ഷിതാവ്: ${voter.guardian_name}` : ''}
                                    </div>
                                </div>
                            </div>

                            <div className="voter-details" style={{ marginTop: '1rem', position: 'relative', zIndex: 1 }}>
                                <div className="detail-item">
                                    <span className="detail-label">വീട്ടുനമ്പർ</span>
                                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{voter.house_no || '-'}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">വീട്ടുപേര്</span>
                                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{voter.house_name || '-'}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">ഐഡി കാർഡ് നമ്പർ</span>
                                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{voter.id_card_no || '-'}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">വയസ്സ്</span>
                                    <span style={{ fontWeight: 600 }}>{voter.age || '-'}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">ലിംഗഭേദം</span>
                                    <span style={{ fontWeight: 600 }}>{voter.gender || '-'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
