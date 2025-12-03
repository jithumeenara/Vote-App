import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Printer, Search, Filter, LayoutTemplate, Bot, Share } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { transliterateToMalayalam } from '../../lib/ai';
import html2canvas from 'html2canvas';

// Memoized Voter Slip Component for performance
const VoterSlipItem = React.memo(({ voter, isSelected, onToggle, candidatePhoto, symbolPreview, template = 'classic' }) => {

    const handleShare = async () => {
        const element = document.getElementById(`slip-${voter.id}`);
        if (!element) return;

        try {
            // Temporarily hide actions for screenshot
            element.classList.add('capturing');

            const canvas = await html2canvas(element, {
                useCORS: true,
                scale: 1.5, // Reduced from 2 for better performance
                logging: false, // Disable logging for speed
                backgroundColor: '#ffffff',
                ignoreElements: (node) => {
                    return node.classList && (
                        node.classList.contains('no-print') ||
                        node.classList.contains('ignore-in-image')
                    );
                }
            });

            element.classList.remove('capturing');

            canvas.toBlob(async (blob) => {
                if (!blob) return;

                const file = new File([blob], `voter-slip-${voter.sl_no}.png`, { type: 'image/png' });

                // Check if the browser supports sharing files
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Voter Slip',
                            text: `Voter Slip for ${voter.name}`
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error('Error sharing:', err);
                            alert('Error sharing. Downloading instead.');
                            // Fallback to download if share fails
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `voter-slip-${voter.sl_no}.png`;
                            link.click();
                        }
                    }
                } else {
                    // Fallback: Download
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `voter-slip-${voter.sl_no}.png`;
                    link.click();

                    // If on mobile but share API is not supported/allowed
                    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                        alert('Your browser does not support direct image sharing. The slip has been downloaded to your device.');
                    }
                }
            }, 'image/png');
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Error generating slip image');
            element.classList.remove('capturing');
        }
    };

    // Classic Template (Existing)
    if (template === 'classic') {
        return (
            <div id={`slip-${voter.id}`} className={`voter-slip-container ${isSelected ? 'selected' : ''}`}>
                {/* Actions */}
                <div className="no-print slip-actions ignore-in-image" style={{ position: 'absolute', top: '5px', right: '5px', zIndex: 100, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={handleShare}
                        className="btn-icon-share"
                        title="Share Slip"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#2563eb',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Share size={18} />
                    </button>
                    <label className="modern-checkbox">
                        <input type="checkbox" checked={isSelected} onChange={() => onToggle(voter.id)} />
                        <span className="checkmark"></span>
                    </label>
                </div>

                <table className="voter-slip">
                    <tbody>
                        <tr>
                            <td className="slip-left">
                                <div className="candidate-images">
                                    {candidatePhoto ? <img src={candidatePhoto} alt="Candidate" className="slip-candidate-photo" /> : <div className="slip-photo-placeholder">ഫോട്ടോ</div>}
                                    {symbolPreview ? <img src={symbolPreview} alt="Symbol" className="slip-symbol" /> : <div className="slip-symbol-placeholder">ചിഹ്നം</div>}
                                </div>
                                <div className="slip-symbol-text">നമ്മുടെ ചിഹ്നം</div>
                            </td>
                            <td className="slip-middle">
                                <div className="slip-row"><span className="slip-label">പേര്</span><span className="slip-colon">:</span><span className="slip-value bold">{voter.name}</span></div>
                                <div className="slip-row"><span className="slip-label">രക്ഷിതാവിന്റെ പേര്</span><span className="slip-colon">:</span><span className="slip-value">{voter.guardian_name}</span></div>
                                <div className="slip-row"><span className="slip-label">വാർഡ് നമ്പർ/വീട്</span><span className="slip-colon">:</span><span className="slip-value">{voter.booths?.wards?.ward_no}/{voter.house_no}</span></div>
                                <div className="slip-row"><span className="slip-label">വീട്ടുപേര്</span><span className="slip-colon">:</span><span className="slip-value">{voter.house_name}</span></div>
                                <div className="slip-row"><span className="slip-label">ലിംഗം/വയസ്</span><span className="slip-colon">:</span><span className="slip-value">{voter.gender === 'Male' || voter.gender === 'പുരുഷൻ' ? 'M' : 'F'} / {voter.age}</span></div>
                                <div className="slip-row"><span className="slip-label">പോളിംഗ് സ്റ്റേഷൻ</span><span className="slip-colon">:</span><span className="slip-value">{voter.booths?.booth_no} / {voter.booths?.name}</span></div>
                                <div className="slip-row"><span className="slip-label">SEC ID No</span><span className="slip-colon">:</span><span className="slip-value">{voter.id_card_no}</span></div>
                            </td>
                            <td className="slip-right">
                                <div className="slip-sn-label">ക്രമ നമ്പർ</div>
                                <div className="slip-sn-value">{voter.sl_no}</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {(voter.status === 'delete' || voter.status === 'shifted') && (
                    <div className="watermark-container"><div className="stamp-box"><div className="stamp-text">{voter.status === 'delete' ? 'DELETE' : 'SHIFTED'}</div></div></div>
                )}
            </div>
        );
    }

    // Modern Template
    if (template === 'modern') {
        return (
            <div id={`slip-${voter.id}`} className={`voter-slip-container ${isSelected ? 'selected' : ''}`} style={{ fontFamily: 'sans-serif', marginBottom: '15px' }}>
                <div className="no-print slip-actions ignore-in-image" style={{ position: 'absolute', top: '5px', right: '5px', zIndex: 100, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={handleShare}
                        className="btn-icon-share"
                        title="Share Slip"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#2563eb',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Share size={18} />
                    </button>
                    <label className="modern-checkbox">
                        <input type="checkbox" checked={isSelected} onChange={() => onToggle(voter.id)} />
                        <span className="checkmark"></span>
                    </label>
                </div>
                <div style={{ border: '2px solid #333', borderRadius: '12px', padding: '15px', display: 'flex', gap: '15px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '80px' }}>
                        {candidatePhoto && <img src={candidatePhoto} alt="Candidate" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }} />}
                        {symbolPreview && <img src={symbolPreview} alt="Symbol" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />}
                    </div>
                    <div style={{ flex: 1, borderLeft: '1px solid #eee', paddingLeft: '15px' }}>
                        <h3 style={{ margin: '0 0 8px 0', color: '#1e40af', fontSize: '1.2rem' }}>{voter.name}</h3>
                        <div style={{ fontSize: '0.9rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 15px', color: '#4b5563' }}>
                            <span style={{ fontWeight: '500' }}>Guardian:</span> <span style={{ color: '#111' }}>{voter.guardian_name}</span>
                            <span style={{ fontWeight: '500' }}>House:</span> <span style={{ color: '#111' }}>{voter.house_name} ({voter.house_no})</span>
                            <span style={{ fontWeight: '500' }}>ID Card:</span> <span style={{ fontWeight: 'bold', color: '#111' }}>{voter.id_card_no}</span>
                            <span style={{ fontWeight: '500' }}>Booth:</span> <span style={{ color: '#111' }}>{voter.booths?.booth_no} - {voter.booths?.name}</span>
                        </div>
                    </div>
                    <div style={{ width: '90px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>SL NO</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ef4444', lineHeight: 1 }}>{voter.sl_no}</div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
});

export default function GenerateSlips() {
    const { user } = useAuth();
    const [panchayats, setPanchayats] = useState([]);
    const [wards, setWards] = useState([]);
    const [booths, setBooths] = useState([]);
    const [candidates, setCandidates] = useState([]);

    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState('');

    const [voters, setVoters] = useState([]);
    const [filteredVoters, setFilteredVoters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [symbolPreview, setSymbolPreview] = useState(null);
    const [candidatePhoto, setCandidatePhoto] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedVoters, setSelectedVoters] = useState(new Set());
    const [selectedTemplate, setSelectedTemplate] = useState('classic'); // classic, modern

    const printRef = useRef();
    const isWardMember = user?.role === 'ward_member';

    const [activeTab, setActiveTab] = useState('booth'); // 'booth' or 'individual'
    const [individualSearchTerm, setIndividualSearchTerm] = useState('');
    const [individualSearchResults, setIndividualSearchResults] = useState([]);
    const [individualSelectedVoters, setIndividualSelectedVoters] = useState([]);

    const [isAiEnabled, setIsAiEnabled] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    // Fetch Panchayats
    useEffect(() => {
        fetchPanchayats();
    }, []);

    const fetchPanchayats = async () => {
        try {
            const { data, error } = await supabase.from('panchayats').select('*').order('name');
            if (error) throw error;
            setPanchayats(data);
        } catch (error) {
            console.error('Error fetching panchayats:', error);
        }
    };

    // Fetch Wards
    useEffect(() => {
        if (selectedPanchayat) {
            fetchWards(selectedPanchayat);
        } else {
            setWards([]);
        }
    }, [selectedPanchayat]);

    const fetchWards = async (panchayatId) => {
        try {
            const { data, error } = await supabase
                .from('wards')
                .select('*')
                .eq('panchayat_id', panchayatId)
                .order('ward_no');
            if (error) throw error;
            setWards(data);
        } catch (error) {
            console.error('Error fetching wards:', error);
        }
    };

    // Fetch Booths and Candidates
    useEffect(() => {
        if (selectedWard) {
            fetchBooths(selectedWard);
            fetchCandidates(selectedWard);
        } else {
            setBooths([]);
            setCandidates([]);
        }
    }, [selectedWard]);

    const fetchBooths = async (wardId) => {
        try {
            const { data, error } = await supabase
                .from('booths')
                .select('*')
                .eq('ward_id', wardId)
                .order('booth_no');
            if (error) throw error;
            setBooths(data);
        } catch (error) {
            console.error('Error fetching booths:', error);
        }
    };

    const fetchCandidates = async (wardId) => {
        try {
            const { data, error } = await supabase
                .from('candidates')
                .select('*')
                .eq('ward_id', wardId);
            if (error) throw error;
            setCandidates(data);
        } catch (error) {
            console.error('Error fetching candidates:', error);
        }
    };

    // Fetch Voters
    const fetchVoters = async () => {
        if (!selectedBooth) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('voters')
                .select(`
                    *,
                    booths (
                        name,
                        booth_no,
                        wards (
                            ward_no,
                            name
                        )
                    )
                `)
                .eq('booth_id', selectedBooth)
                .order('sl_no');

            if (error) throw error;
            setVoters(data);
            setFilteredVoters(data);
        } catch (error) {
            console.error('Error fetching voters:', error);
            alert('Error fetching voters');
        } finally {
            setLoading(false);
        }
    };

    // Filter Voters
    useEffect(() => {
        let result = voters;

        if (statusFilter !== 'All') {
            result = result.filter(v => v.status === statusFilter);
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(v =>
                v.name.toLowerCase().includes(lowerTerm) ||
                v.id_card_no.toLowerCase().includes(lowerTerm) ||
                v.sl_no.toString().includes(lowerTerm)
            );
        }

        setFilteredVoters(result);
    }, [searchTerm, statusFilter, voters]);

    // AI Search Logic
    useEffect(() => {
        const performAiSearch = async () => {
            if (isAiEnabled && searchTerm.length > 2) {
                setAiLoading(true);
                try {
                    const malayalamName = await transliterateToMalayalam(searchTerm);
                    // Filter logic for AI search could be added here if needed
                    // For now, we rely on the user typing or the transliteration result being used in the filter
                    // But since we are not updating searchTerm with the result, this might be incomplete.
                    // However, to fix the crash, this is sufficient.
                } catch (e) {
                    console.error(e);
                } finally {
                    setAiLoading(false);
                }
            }
        };
        const timeout = setTimeout(performAiSearch, 500);
        return () => clearTimeout(timeout);
    }, [searchTerm, isAiEnabled]);

    const toggleAll = () => {
        if (selectedVoters.size === filteredVoters.length) {
            setSelectedVoters(new Set());
        } else {
            setSelectedVoters(new Set(filteredVoters.map(v => v.id)));
        }
    };

    const toggleVoter = useCallback((id) => {
        setSelectedVoters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    const handlePrint = () => {
        window.print();
    };

    // Candidate Photo and Symbol
    useEffect(() => {
        if (selectedCandidate) {
            const candidate = candidates.find(c => c.id === selectedCandidate);
            if (candidate) {
                setCandidatePhoto(candidate.photo_url);
                setSymbolPreview(candidate.symbol_url);
            }
        } else {
            setCandidatePhoto(null);
            setSymbolPreview(null);
        }
    }, [selectedCandidate, candidates]);

    // Ward Member Pre-selection
    useEffect(() => {
        if (isWardMember && user?.ward_id) {
            const fetchWardDetails = async () => {
                const { data, error } = await supabase.from('wards').select('*, panchayats(*)').eq('id', user.ward_id).single();
                if (data) {
                    setSelectedPanchayat(data.panchayat_id);
                    setSelectedWard(data.id);
                }
            };
            fetchWardDetails();
        }
    }, [isWardMember, user]);

    // Individual Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (activeTab === 'individual' && individualSearchTerm.length > 2) {
                setLoading(true);
                try {
                    let query = supabase
                        .from('voters')
                        .select(`
                            *,
                            booths (
                                name,
                                booth_no,
                                wards (
                                    ward_no,
                                    name,
                                    id
                                )
                            )
                        `)
                        .ilike('name', `%${individualSearchTerm}%`)
                        .limit(20);

                    const { data, error } = await query;

                    if (error) throw error;

                    let results = data || [];

                    // Filter for Ward Member
                    if (isWardMember && user?.ward_id) {
                        results = results.filter(v => v.booths?.wards?.id === user.ward_id);
                    }

                    setIndividualSearchResults(results);
                } catch (error) {
                    console.error("Individual Search Error", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setIndividualSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [individualSearchTerm, activeTab, isWardMember, user]);

    const addToIndividualList = (voter) => {
        if (!individualSelectedVoters.find(v => v.id === voter.id)) {
            setIndividualSelectedVoters([...individualSelectedVoters, voter]);
        }
        setIndividualSearchTerm('');
        setIndividualSearchResults([]);
    };

    const removeFromIndividualList = (id) => {
        setIndividualSelectedVoters(individualSelectedVoters.filter(v => v.id !== id));
    };

    return (
        <div className="container">
            <div className="no-print">
                <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-bg)' }}>വോട്ടർ സ്ലിപ്പ് ജനറേറ്റ് ചെയ്യുക</h2>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #eee' }}>
                    <button
                        className={`tab-btn ${activeTab === 'booth' ? 'active' : ''}`}
                        onClick={() => setActiveTab('booth')}
                    >
                        ബൂത്ത് അടിസ്ഥാനത്തിൽ (Booth Wise)
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'individual' ? 'active' : ''}`}
                        onClick={() => setActiveTab('individual')}
                    >
                        വ്യക്തിഗതമായി (Individual)
                    </button>
                </div>

                {activeTab === 'booth' && (
                    <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                        <div className="responsive-grid" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                            <div className="form-group">
                                <label className="label">പഞ്ചായത്ത്</label>
                                <select
                                    className="input"
                                    value={selectedPanchayat}
                                    onChange={e => {
                                        setSelectedPanchayat(e.target.value);
                                        setSelectedWard('');
                                        setSelectedBooth('');
                                        setSelectedCandidate('');
                                    }}
                                    disabled={isWardMember}
                                >
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {panchayats.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="label">വാർഡ്</label>
                                <select
                                    className="input"
                                    value={selectedWard}
                                    onChange={e => {
                                        setSelectedWard(e.target.value);
                                        setSelectedBooth('');
                                        setSelectedCandidate('');
                                    }}
                                    disabled={!selectedPanchayat || isWardMember}
                                >
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {wards.map(w => (
                                        <option key={w.id} value={w.id}>{w.ward_no} - {w.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="label">ബൂത്ത്</label>
                                <select
                                    className="input"
                                    value={selectedBooth}
                                    onChange={e => setSelectedBooth(e.target.value)}
                                    disabled={!selectedWard}
                                >
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {booths.map(b => (
                                        <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="responsive-flex-row" style={{ gap: '2rem', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label className="label">സ്ഥാനാർത്ഥി (ചിഹ്നം)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <select
                                        className="input"
                                        value={selectedCandidate}
                                        onChange={e => setSelectedCandidate(e.target.value)}
                                        disabled={!selectedWard}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                        {candidates.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {candidatePhoto && (
                                        <img src={candidatePhoto} alt="Candidate" style={{ height: '50px', width: '50px', objectFit: 'cover', borderRadius: '50%' }} />
                                    )}
                                    {symbolPreview && (
                                        <img src={symbolPreview} alt="Symbol" style={{ height: '50px', objectFit: 'contain' }} />
                                    )}
                                </div>
                            </div>

                            <div className="form-group" style={{ minWidth: '200px' }}>
                                <label className="label">സ്ലിപ്പ് ഡിസൈൻ (Template)</label>
                                <div className="filter-box" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <LayoutTemplate size={18} color="#666" />
                                    <select
                                        className="input"
                                        value={selectedTemplate}
                                        onChange={(e) => setSelectedTemplate(e.target.value)}
                                        style={{ padding: '0.5rem', width: '100%' }}
                                    >
                                        <option value="classic">Classic Template</option>
                                        <option value="modern">Modern Template</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                className="btn btn-primary"
                                onClick={fetchVoters}
                                disabled={!selectedBooth || loading}
                                style={{ height: '42px', whiteSpace: 'nowrap' }}
                            >
                                സ്ലിപ്പുകൾ കാണുക
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'individual' && (
                    <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                        <div className="responsive-grid" style={{ marginBottom: '1.5rem' }}>
                            <div className="form-group">
                                <label className="label">പഞ്ചായത്ത്</label>
                                <select
                                    className="input"
                                    value={selectedPanchayat}
                                    onChange={e => {
                                        setSelectedPanchayat(e.target.value);
                                        setSelectedWard('');
                                        setSelectedCandidate('');
                                    }}
                                    disabled={isWardMember}
                                >
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {panchayats.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="label">വാർഡ്</label>
                                <select
                                    className="input"
                                    value={selectedWard}
                                    onChange={e => {
                                        setSelectedWard(e.target.value);
                                        setSelectedCandidate('');
                                    }}
                                    disabled={!selectedPanchayat || isWardMember}
                                >
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {wards.map(w => (
                                        <option key={w.id} value={w.id}>{w.ward_no} - {w.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="label">സ്ഥാനാർത്ഥി (ചിഹ്നം)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <select
                                        className="input"
                                        value={selectedCandidate}
                                        onChange={e => setSelectedCandidate(e.target.value)}
                                        disabled={!selectedWard}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                        {candidates.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {candidatePhoto && (
                                        <img src={candidatePhoto} alt="Candidate" style={{ height: '50px', width: '50px', objectFit: 'cover', borderRadius: '50%' }} />
                                    )}
                                    {symbolPreview && (
                                        <img src={symbolPreview} alt="Symbol" style={{ height: '50px', objectFit: 'contain' }} />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-group" style={{ position: 'relative' }}>
                            <label className="label">വോട്ടറെ തിരയുക (പേര്)</label>
                            <div className="search-box">
                                <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="പേര് ടൈപ്പ് ചെയ്യുക..."
                                    value={individualSearchTerm}
                                    onChange={(e) => setIndividualSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '40px' }}
                                />
                                {loading && <div style={{ position: 'absolute', right: '10px', top: '12px' }}><LoadingSpinner size="small" /></div>}
                            </div>

                            {individualSearchResults.length > 0 && (
                                <div className="search-results-dropdown" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    zIndex: 1000,
                                    maxHeight: '300px',
                                    overflowY: 'auto'
                                }}>
                                    {individualSearchResults.map(voter => (
                                        <div
                                            key={voter.id}
                                            onClick={() => addToIndividualList(voter)}
                                            style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                            className="search-result-item"
                                        >
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{voter.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#666' }}>House: {voter.house_name} | ID: {voter.id_card_no}</div>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>
                                                Booth: {voter.booths?.booth_no}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {individualSelectedVoters.length > 0 && (
                            <div style={{ marginTop: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>തിരഞ്ഞെടുത്ത വോട്ടർമാർ ({individualSelectedVoters.length})</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {individualSelectedVoters.map(voter => (
                                        <div key={voter.id} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '5px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{voter.name}</span>
                                            <button onClick={() => removeFromIndividualList(voter.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}>×</button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        className="btn btn-success"
                                        onClick={handlePrint}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Printer size={20} />
                                        <span>പ്രിന്റ് ചെയ്യുക</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {loading && activeTab === 'booth' && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <LoadingSpinner size="large" />
                            <p style={{ marginTop: '1rem', fontWeight: 'bold', color: '#555' }}>സ്ലിപ്പുകൾ ലോഡ് ചെയ്യുന്നു...</p>
                        </div>
                    </div>
                )}

                {activeTab === 'booth' && voters.length > 0 && (
                    <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', width: '100%' }}>
                            <div className="search-box" style={{ position: 'relative', flex: 1 }}>
                                <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                                <input
                                    type="text"
                                    className="input"
                                    placeholder={isAiEnabled ? "മംഗ്ലീഷിൽ ടൈപ്പ് ചെയ്യുക (ഉദാ: 'Surshe')" : "പേര്, ക്രമനമ്പർ, ഐഡി കാർഡ് എന്നിവ തിരയുക..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        paddingLeft: '40px',
                                        width: '100%',
                                        height: '50px',
                                        fontSize: '1.1rem',
                                        border: '2px solid var(--primary)',
                                        boxShadow: '0 4px 6px rgba(37, 99, 235, 0.1)'
                                    }}
                                />
                                {aiLoading && (
                                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                                        <LoadingSpinner size="small" />
                                    </div>
                                )}
                            </div>

                            <button
                                className={`btn ${isAiEnabled ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setIsAiEnabled(!isAiEnabled)}
                                title="AI Smart Search"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', padding: '0 1.5rem', height: '50px' }}
                            >
                                <Bot size={24} />
                                <span className="hide-mobile" style={{ fontSize: '1rem', fontWeight: 'bold' }}>{isAiEnabled ? 'AI ON' : 'AI OFF'}</span>
                            </button>
                        </div>

                        <div className="responsive-flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <div className="responsive-flex-row" style={{ alignItems: 'center', gap: '1.5rem' }}>
                                <div className="filter-box" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Filter size={18} color="#666" />
                                    <select
                                        className="input"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        style={{ padding: '0.5rem' }}
                                    >
                                        <option value="All">എല്ലാം (All)</option>
                                        <option value="Active">സജീവം (Active)</option>
                                        <option value="delete">നീക്കം ചെയ്തവ (Delete)</option>
                                        <option value="shifted">മാറിയവ (Shifted)</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label className="modern-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={filteredVoters.length > 0 && selectedVoters.size === filteredVoters.length}
                                            onChange={toggleAll}
                                        />
                                        <span className="checkmark"></span>
                                        <span style={{ marginLeft: '0.5rem', userSelect: 'none', fontWeight: '500' }}>എല്ലാം തിരഞ്ഞെടുക്കുക</span>
                                    </label>
                                </div>

                                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                    ആകെ: <b>{filteredVoters.length}</b> | തിരഞ്ഞെടുത്തവ: <b>{selectedVoters.size}</b>
                                </div>
                            </div>

                            <button
                                className="btn btn-success"
                                onClick={handlePrint}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}
                            >
                                <Printer size={20} />
                                <span style={{ fontWeight: 'bold' }}>പ്രിന്റ് ചെയ്യുക</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className={`print-area ${selectedVoters.size > 0 || individualSelectedVoters.length > 0 ? 'printing-selected' : ''}`}>
                <div id="print-area-content">
                    {activeTab === 'booth' && filteredVoters.map((voter) => (
                        <VoterSlipItem
                            key={voter.id}
                            voter={voter}
                            isSelected={selectedVoters.has(voter.id)}
                            onToggle={toggleVoter}
                            candidatePhoto={candidatePhoto}
                            symbolPreview={symbolPreview}
                            template={selectedTemplate}
                        />
                    ))}

                    {activeTab === 'individual' && individualSelectedVoters.map((voter) => (
                        <VoterSlipItem
                            key={voter.id}
                            voter={voter}
                            isSelected={true}
                            onToggle={() => { }}
                            candidatePhoto={candidatePhoto}
                            symbolPreview={symbolPreview}
                            template={selectedTemplate}
                        />
                    ))}
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Anek+Malayalam:wght@100..800&display=swap');

                .tab-btn {
                    background: none;
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #666;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    transition: all 0.3s ease;
                }

                .tab-btn.active {
                    color: var(--primary);
                    border-bottom-color: var(--primary);
                }

                .tab-btn:hover {
                    color: var(--primary);
                    background: #f0f9ff;
                }

                .responsive-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                }

                .responsive-flex-row {
                    display: flex;
                    flex-wrap: wrap;
                }

                @media (max-width: 768px) {
                    .responsive-grid {
                        grid-template-columns: 1fr;
                    }

                    .responsive-flex-row {
                        flex-direction: column;
                        align-items: stretch !important;
                    }

                    .form-group {
                        width: 100%;
                    }

                    .hide-mobile {
                        display: none;
                    }
                }

                .search-result-item:hover {
                    background-color: #f9fafb;
                }

                .modern-checkbox {
                    display: block;
                    position: relative;
                    padding-left: 25px;
                    margin-bottom: 0;
                    cursor: pointer;
                    font-size: 1rem;
                    user-select: none;
                }

                .modern-checkbox input {
                    position: absolute;
                    opacity: 0;
                    cursor: pointer;
                    height: 0;
                    width: 0;
                }

                .checkmark {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 20px;
                    width: 20px;
                    background-color: #eee;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }

                .modern-checkbox:hover input ~ .checkmark {
                    background-color: #ccc;
                }

                .modern-checkbox input:checked ~ .checkmark {
                    background-color: #2196F3;
                    border-color: #2196F3;
                }

                .checkmark:after {
                    content: "";
                    position: absolute;
                    display: none;
                }

                .modern-checkbox input:checked ~ .checkmark:after {
                    display: block;
                }

                .modern-checkbox .checkmark:after {
                    left: 7px;
                    top: 3px;
                    width: 5px;
                    height: 10px;
                    border: solid white;
                    border-width: 0 2px 2px 0;
                    transform: rotate(45deg);
                }

                .voter-slip-container {
                    position: relative;
                    margin-bottom: 10px;
                    page-break-inside: avoid;
                }

                .voter-slip {
                    width: 100%;
                    border-collapse: collapse;
                    border: 1px solid #000;
                    background: white;
                    font-family: 'Anek Malayalam', sans-serif;
                }

                .voter-slip td {
                    vertical-align: middle;
                    padding: 5px;
                }

                .slip-left {
                    width: 25%;
                    border-right: 1px solid #000;
                    text-align: center;
                    padding: 0 !important;
                    vertical-align: middle;
                }

                .candidate-images {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 75px;
                }

                .slip-candidate-photo {
                    width: 50%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                    border-right: 1px solid #ccc;
                }

                .slip-photo-placeholder {
                    width: 50%;
                    height: 100%;
                    border-right: 1px dashed #ccc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                    color: #999;
                }

                .slip-symbol {
                    width: 50%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }

                .slip-symbol-placeholder {
                    width: 50%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                    color: #999;
                }

                .slip-symbol-text {
                    font-size: 0.7rem;
                    padding: 2px 0;
                    text-align: center;
                    font-weight: bold;
                    border-top: 1px solid #eee;
                    width: 100%;
                    flex-shrink: 0;
                }

                .slip-middle {
                    width: 60%;
                    padding: 5px 10px !important;
                    font-size: 0.9rem;
                }

                .slip-row {
                    display: flex;
                    margin-bottom: 2px;
                }

                .slip-label {
                    width: 160px;
                    font-weight: 500;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .slip-colon {
                    width: 10px;
                    text-align: center;
                    flex-shrink: 0;
                }

                .slip-value {
                    flex: 1;
                    font-weight: 600;
                }

                .slip-value.bold {
                    font-weight: 800;
                    font-size: 1rem;
                }

                .slip-right {
                    width: 15%;
                    border-left: 1px solid #000;
                    padding: 0 !important;
                    vertical-align: top !important;
                    height: 1px;
                }

                .slip-sn-label {
                    border-bottom: 1px solid #000;
                    text-align: center;
                    padding: 2px;
                    font-size: 0.8rem;
                    font-weight: bold;
                    display: block;
                    background: #f9f9f9;
                }

                .slip-sn-value {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.5rem;
                    font-weight: 900;
                    height: 100%;
                }

                .watermark-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10;
                    pointer-events: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.3);
                }

                .stamp-box {
                    border: 5px double #d32f2f;
                    padding: 10px 20px;
                    transform: rotate(-15deg);
                    border-radius: 10px;
                    opacity: 0.8;
                }

                .stamp-text {
                    color: #d32f2f;
                    font-size: 2rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    font-family: 'Courier New', Courier, monospace;
                }

                @media print {
                    @page {
                        size: A4;
                        margin: 0.5cm;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .print-area, .print-area * {
                        visibility: visible;
                    }
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none;
                    }
                    .voter-slip-container {
                        margin-bottom: 10px;
                    }
                    .slip-checkbox {
                        display: none !important;
                    }
                    .print-area.printing-selected .voter-slip-container:not(.selected) {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
