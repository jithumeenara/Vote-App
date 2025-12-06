import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, User, Phone } from 'lucide-react';
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
        <div style={{ paddingBottom: '80px' }}>
            {/* Sticky Search Header */}
            <div style={{
                position: 'sticky',
                top: '0',
                zIndex: 100,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                padding: '1rem',
                margin: '0 -1rem', // Negative margin to stretch full width on mobile
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                marginBottom: '1rem'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={22} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                        <input
                            type="text"
                            placeholder="തിരയുക (പേര്, വീട്ടുപേര്, നമ്പർ...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.8rem 1rem 0.8rem 3rem',
                                borderRadius: '50px',
                                border: '2px solid #f3f4f6',
                                background: '#f9fafb',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.3s ease',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={(e) => e.target.style.borderColor = '#f3f4f6'}
                        />
                    </div>
                </div>
            </div>

            {/* Booth Info Section */}
            <div style={{ padding: '0 0 1.5rem 0', textAlign: 'center' }}>
                <span style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    background: '#fdf2f4',
                    color: 'var(--primary)',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    marginBottom: '0.75rem'
                }}>
                    {boothDetails?.wards?.panchayats?.name} • വാർഡ് {boothDetails?.wards?.ward_no}
                </span>

                <h1 style={{
                    fontSize: '1.5rem',
                    lineHeight: '1.3',
                    marginBottom: '1rem',
                    color: 'var(--primary-bg)'
                }}>
                    {boothDetails?.name}
                </h1>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{
                        background: '#f8fafc',
                        padding: '0.5rem 1rem',
                        borderRadius: '12px',
                        fontWeight: '600',
                        color: '#64748b',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <User size={16} />
                        {voters.length} വോട്ടർമാർ
                    </div>


                    {boothDetails?.contact_number && (
                        <a
                            href={`tel:${boothDetails.contact_number}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                padding: '0.5rem 1.25rem',
                                borderRadius: '50px',
                                textDecoration: 'none',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            <Phone size={16} fill="white" />
                            സഹായത്തിന് വിളിക്കുക
                        </a>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {filteredVoters.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 1rem',
                    color: 'var(--text-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <div style={{ background: '#f3f4f6', padding: '1.5rem', borderRadius: '50%' }}>
                        <Search size={32} color="#9ca3af" />
                    </div>
                    <div>
                        {searchTerm ? (
                            <p>"{searchTerm}" എന്ന പേരിൽ വോട്ടർമാരെ കണ്ടെത്തിയില്ല</p>
                        ) : (
                            <p>തുടങ്ങാൻ മുകളിൽ പേര് തിരയുക</p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-2">
                    {filteredVoters.map((voter, index) => (
                        <div key={voter.id} className="card voter-card" style={{
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: (voter.status === 'shifted' || voter.status === 'deleted') ? '#fef2f2' : 'white',
                            border: '1px solid #f1f5f9',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            animation: `fadeIn 0.5s ease-out ${index * 0.05}s both`
                        }}>
                            {(voter.status === 'shifted' || voter.status === 'deleted') && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                    zIndex: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        color: voter.status === 'deleted' ? '#ef4444' : '#f59e0b',
                                        fontSize: '1.2rem', fontWeight: '900',
                                        transform: 'rotate(-10deg)',
                                        border: '3px solid currentColor',
                                        padding: '0.25rem 1rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '2px',
                                        background: 'rgba(255,255,255,0.9)'
                                    }}>
                                        {voter.status === 'shifted' ? 'SHIFTED' : 'DELETED'}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #fdf2f4 0%, #fff 100%)',
                                    minWidth: '50px',
                                    height: '50px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid #fce7f3'
                                }}>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        {voter.sl_no}
                                    </span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: '#1e293b' }}>{voter.name}</h3>
                                    {voter.guardian_name && (
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            രക്ഷിതാവ്: {voter.guardian_name}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(max-content, 1fr) 1fr',
                                gap: '0.75rem',
                                marginTop: '1rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid #f1f5f9',
                                fontSize: '0.9rem'
                            }}>
                                <div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.1rem' }}>വീട്ടുപേര്</div>
                                    <div style={{ fontWeight: '500', color: '#334155' }}>{voter.house_name || '-'}</div>
                                </div>
                                <div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.1rem' }}>വീട്ടുനമ്പർ</div>
                                    <div style={{ fontWeight: '500', color: '#334155' }}>{voter.house_no || '-'}</div>
                                </div>
                                <div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.1rem' }}>ഐഡി കാർഡ്</div>
                                    <div style={{ fontWeight: '600', color: 'var(--primary)', letterSpacing: '0.5px' }}>{voter.id_card_no || '-'}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.1rem' }}>വയസ്സ്</div>
                                        <div style={{ fontWeight: '500', color: '#334155' }}>{voter.age || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.1rem' }}>ലിംഗം</div>
                                        <div style={{ fontWeight: '500', color: '#334155' }}>{voter.gender || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}
            </style>
        </div>
    );
}
