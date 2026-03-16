import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, User, Phone, MapPin, CreditCard } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { transliterateMalayalamToEnglish } from '../utils/transliteration';
import Fuse from 'fuse.js';

export default function VoterList() {
    const { boothId } = useParams();
    const [voters, setVoters] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
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
                .select('*, constituencies(name, constituency_no, districts(name))')
                .eq('id', boothId)
                .single();
            if (bData) setBoothDetails(bData);

            // Get total count first
            const { count } = await supabase
                .from('voters')
                .select('*', { count: 'exact', head: true })
                .eq('booth_id', boothId);
            setTotalCount(count || 0);

            // Fetch all voters in batches of 1000 (bypasses Supabase row limit)
            const BATCH = 1000;
            const batches = Math.ceil((count || 0) / BATCH);
            let all = [];
            for (let i = 0; i < batches; i++) {
                const { data, error } = await supabase
                    .from('voters')
                    .select('*')
                    .eq('booth_id', boothId)
                    .order('sl_no')
                    .range(i * BATCH, (i + 1) * BATCH - 1);
                if (error) throw error;
                all = all.concat(data || []);
            }
            setVoters(all);
        } catch (error) {
            console.error('Error fetching voters:', error.message);
        } finally {
            setLoading(false);
        }
    }

    // Initialize Fuse.js for smart fuzzy search (AI-like correction)
    const fuse = useMemo(() => {
        if (voters.length === 0) return null;

        // Pre-process data for search: Add Manglish fields
        const searchableData = voters.map(v => ({
            ...v,
            manglishName: transliterateMalayalamToEnglish(v.name).toLowerCase(),
            manglishHouse: transliterateMalayalamToEnglish(v.house_name || '').toLowerCase(),
            manglishGuardian: transliterateMalayalamToEnglish(v.guardian_name || '').toLowerCase(),
            sl_no_str: v.sl_no.toString()
        }));

        return new Fuse(searchableData, {
            keys: [
                { name: 'name', weight: 2 },            // Malayalam Name
                { name: 'manglishName', weight: 2 },    // Manglish Name
                { name: 'sl_no_str', weight: 2 },       // Serial No
                { name: 'id_card_no', weight: 1.5 },    // ID Card
                { name: 'house_name', weight: 1 },      // House Name Malayalam
                { name: 'manglishHouse', weight: 1 },   // House Name Manglish
                { name: 'house_no', weight: 1 },        // House Number
                { name: 'guardian_name', weight: 0.8 },
                { name: 'manglishGuardian', weight: 0.8 },
            ],
            threshold: 0.35,        // Balanced: catches Manglish typos like "Raju"→"രാജു"
            distance: 200,          // Wider match window
            minMatchCharLength: 2,
            includeScore: true,
            ignoreLocation: true,
            useExtendedSearch: false,
            findAllMatches: true
        });
    }, [voters]);

    const filteredVoters = useMemo(() => {
        if (!searchTerm) return voters;
        if (!fuse) return voters;

        const results = fuse.search(searchTerm);
        return results.map(result => result.item);
    }, [voters, searchTerm, fuse]);

    if (loading) return <LoadingSpinner text="വോട്ടർ പട്ടിക ലോഡുചെയ്യുന്നു..." />;

    return (
        <div style={{ paddingBottom: '80px', fontFamily: "'Anek Malayalam', sans-serif", color: 'var(--text)' }}>

            {/* Booth Info Section - Moved Above Search */}
            <div style={{ padding: '0 0 1.5rem 0', textAlign: 'center' }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.35rem 1rem',
                    background: 'var(--surface)',
                    border: '1px solid rgba(55, 17, 32, 0.1)',
                    color: 'var(--text-light)',
                    borderRadius: '30px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    marginBottom: '1rem',
                    boxShadow: '0 2px 4px rgba(55, 17, 32, 0.05)'
                }}>
                    <MapPin size={14} />
                    {boothDetails?.constituencies?.districts?.name} • നിയോജക മണ്ഡലം {boothDetails?.constituencies?.constituency_no}
                </div>

                <h1 style={{
                    fontSize: '1.85rem',
                    lineHeight: '1.2',
                    marginBottom: '1.25rem',
                    color: 'var(--text)',
                    fontWeight: '800',
                    letterSpacing: '-0.02em',
                    padding: '0 1rem'
                }}>
                    {boothDetails?.name}
                </h1>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                        background: 'var(--surface)',
                        padding: '0.6rem 1.25rem',
                        borderRadius: '16px',
                        fontWeight: '600',
                        color: 'var(--text-light)',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: '1px solid rgba(55, 17, 32, 0.1)',
                        boxShadow: '0 2px 4px rgba(55, 17, 32, 0.05)'
                    }}>
                        <User size={18} style={{ color: 'var(--primary)' }} />
                        {totalCount} വോട്ടർമാർ
                    </div>

                    {boothDetails?.contact_number && (
                        <a
                            href={`tel:${boothDetails.contact_number}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#16a34a', // Green Color
                                color: 'white',
                                padding: '0.6rem 1.5rem',
                                borderRadius: '30px',
                                textDecoration: 'none',
                                fontWeight: '600',
                                fontSize: '1rem',
                                boxShadow: '0 8px 16px -4px rgba(22, 163, 74, 0.3)',
                                transition: 'transform 0.2s active'
                            }}
                        >
                            <Phone size={18} fill="currentColor" />
                            സഹായത്തിന് വിളിക്കുക
                        </a>
                    )}
                </div>
            </div>

            {/* Sticky Search Header */}
            <div style={{
                position: 'sticky',
                top: '0',
                zIndex: 100,
                background: 'rgba(253, 242, 244, 0.95)',
                backdropFilter: 'blur(10px)',
                padding: '1rem',
                margin: '0 -1rem',
                boxShadow: '0 4px 20px rgba(55, 17, 32, 0.05)',
                marginBottom: '1rem'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={20} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input
                            type="text"
                            placeholder="തിരയുക: പേര്, Manglish, SL No, ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.85rem 1rem 0.85rem 3.2rem',
                                borderRadius: '16px',
                                border: '1px solid rgba(55, 17, 32, 0.1)',
                                background: 'var(--surface)',
                                fontSize: '1.05rem',
                                outline: 'none',
                                color: 'var(--text)',
                                transition: 'all 0.2s ease',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = 'var(--primary)';
                                e.target.style.boxShadow = '0 0 0 4px rgba(207, 46, 77, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = 'rgba(55, 17, 32, 0.1)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Voters List */}
            {filteredVoters.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 1rem',
                    color: 'var(--text-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.5rem'
                }}>
                    <div style={{
                        background: 'var(--surface)',
                        padding: '2rem',
                        borderRadius: '50%',
                        boxShadow: 'inset 0 2px 4px rgba(55, 17, 32, 0.05)'
                    }}>
                        <Search size={40} style={{ color: 'var(--text-light)', opacity: 0.5 }} />
                    </div>
                    <div>
                        {searchTerm ? (
                            <p style={{ fontSize: '1.1rem' }}>"{searchTerm}" എന്ന പേരിൽ വോട്ടർമാരെ കണ്ടെത്തിയില്ല</p>
                        ) : (
                            <p>തുടങ്ങാൻ മുകളിൽ പേര് തിരയുക</p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="responsive-grid-mobile">
                    {filteredVoters.map((voter, index) => {
                        const isShifted = voter.status === 'shifted';
                        const isDeleted = voter.status === 'deleted';
                        const isEven = index % 2 === 0;

                        return (
                            <div key={voter.id} style={{
                                borderRadius: '16px',
                                overflow: 'hidden',
                                boxShadow: '0 4px 6px -1px rgba(55, 17, 32, 0.05), 0 2px 4px -1px rgba(55, 17, 32, 0.03)',
                                border: '1px solid rgba(55, 17, 32, 0.08)',
                                background: 'var(--surface)',
                                animation: `fadeIn 0.5s ease-out ${index * 0.05}s both`,
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Header - Alternating Theme Background */}
                                <div style={{
                                    background: isEven ? 'var(--background)' : 'white',
                                    padding: '1rem 1.25rem',
                                    borderBottom: '1px solid rgba(55, 17, 32, 0.08)',
                                    position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <div style={{
                                            background: 'var(--primary-bg)',
                                            minWidth: '42px',
                                            height: '42px',
                                            borderRadius: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: '700',
                                            fontSize: '1.1rem',
                                            color: '#facc15',
                                            border: '1px solid var(--primary-bg)',
                                            boxShadow: '0 1px 2px rgba(55, 17, 32, 0.1)'
                                        }}>
                                            {voter.sl_no}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{
                                                margin: '0 0 0.1rem 0',
                                                fontSize: '1.25rem',
                                                fontWeight: '800',
                                                lineHeight: '1.3',
                                                color: 'var(--text)'
                                            }}>
                                                {voter.name}
                                            </h3>
                                            {voter.guardian_name && (
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-light)', fontWeight: '500' }}>
                                                    രക്ഷിതാവ്: {voter.guardian_name}
                                                </div>
                                            )}
                                        </div>
                                        {(isShifted || isDeleted) && (
                                            <div style={{
                                                background: isDeleted ? '#fee2e2' : '#fef3c7',
                                                color: isDeleted ? '#ef4444' : '#d97706',
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                border: `1px solid ${isDeleted ? '#fecaca' : '#fde68a'}`
                                            }}>
                                                {isDeleted ? 'Deleted' : 'Shifted'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Body */}
                                <div style={{ padding: '1.25rem' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '1rem 1.5rem',
                                    }}>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>വീട്ടുനമ്പർ/വീട്ടുപേര്</div>
                                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1.05rem' }}>
                                                {[voter.house_no, voter.house_name].filter(Boolean).join(' • ') || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>വിവരങ്ങൾ</div>
                                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1.05rem' }}>{voter.age} വയസ്സ്, {voter.gender}</div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>ഐഡി കാർഡ്</div>
                                            <div style={{ fontWeight: 700, color: 'var(--primary-bg)', fontSize: '1.05rem', letterSpacing: '0.5px' }}>{voter.id_card_no}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .responsive-grid-mobile {
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                    @media (min-width: 768px) {
                        .responsive-grid-mobile {
                            grid-template-columns: repeat(2, 1fr);
                        }
                    }
                    .text-primary {
                        color: var(--primary-bg);
                    }
                `}
            </style>
        </div>
    );
}
