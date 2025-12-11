import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';

export default function VoterStatusReports() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const componentRef = useRef();

    const [panchayats, setPanchayats] = useState([]);
    const [wards, setWards] = useState([]);
    const [booths, setBooths] = useState([]);

    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('shifted');

    const [voters, setVoters] = useState([]);
    const [fronts, setFronts] = useState([]);
    const [activeTab, setActiveTab] = useState('status_report');
    const [loading, setLoading] = useState(false);

    const isWardMember = user?.role === 'ward_member';

    const statusOptions = [
        { value: 'all', label: 'All' },
        { value: 'active', label: 'Active' },
        { value: 'shifted', label: 'Shifted' },
        { value: 'deleted', label: 'Deleted' },
        { value: 'death', label: 'Death' },
        { value: 'gulf', label: 'Gulf' },
        { value: 'out_of_place', label: 'Out of Place' },
        { value: 'duplicate', label: 'Duplicate' }
    ];

    useEffect(() => {
        fetchPanchayats();
        fetchFronts();
        if (isWardMember && user?.ward_id) {
            fetchUserWardDetails();
        }
    }, [user]);

    async function fetchFronts() {
        const { data } = await supabase.from('fronts').select('*').order('id');
        setFronts(data || []);
    }

    async function fetchUserWardDetails() {
        const { data } = await supabase
            .from('wards')
            .select('id, panchayat_id')
            .eq('id', user.ward_id)
            .single();

        if (data) {
            setSelectedPanchayat(data.panchayat_id);
            setSelectedWard(data.id);
        }
    }

    async function fetchPanchayats() {
        const { data } = await supabase.from('panchayats').select('*').order('name');
        setPanchayats(data || []);
    }

    useEffect(() => {
        if (selectedPanchayat) {
            fetchWards(selectedPanchayat);
        } else {
            setWards([]);
        }
    }, [selectedPanchayat]);

    async function fetchWards(panchayatId) {
        const { data } = await supabase.from('wards').select('*').eq('panchayat_id', panchayatId).order('ward_no');
        setWards(data || []);
    }

    useEffect(() => {
        if (selectedWard) {
            fetchBooths(selectedWard);
        } else {
            setBooths([]);
        }
    }, [selectedWard]);

    async function fetchBooths(wardId) {
        const { data } = await supabase.from('booths').select('*').eq('ward_id', wardId).order('booth_no');
        setBooths(data || []);
    }

    useEffect(() => {
        if (selectedWard) {
            fetchVoters();
        } else {
            setVoters([]);
        }
    }, [selectedWard, selectedBooth, selectedStatus]);

    async function fetchVoters() {
        setLoading(true);
        try {
            let query = supabase
                .from('voters')
                .select('*, booths(booth_no, name)')
                .order('sl_no');

            if (selectedStatus !== 'all') {
                query = query.eq('status', selectedStatus);
            }

            if (selectedBooth) {
                query = query.eq('booth_id', selectedBooth);
            } else if (selectedWard) {
                // Fetch booth IDs for the ward
                const { data: bData } = await supabase.from('booths').select('id').eq('ward_id', selectedWard);
                const bIds = bData.map(b => b.id);
                if (bIds.length > 0) {
                    query = query.in('booth_id', bIds);
                } else {
                    setVoters([]);
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            setVoters(data || []);
        } catch (error) {
            console.error('Error fetching voters:', error);
            addToast('Error fetching voters', 'error');
        } finally {
            setLoading(false);
        }
    }

    const handleDownloadPdf = () => {
        const element = document.getElementById('report-content');
        const opt = {
            margin: 10,
            filename: `voter_status_report_${selectedStatus}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Use html2pdf to generate and save the PDF
        html2pdf().set(opt).from(element).save().then(() => {
            addToast('PDF downloaded successfully', 'success');
        }).catch(err => {
            console.error('PDF generation error:', err);
            addToast('Failed to generate PDF', 'error');
        });
    };

    return (
        <div className="container">
            <div className="report-header">
                <h2 style={{ color: 'var(--primary-bg)', margin: 0 }}>വോട്ടർ സ്റ്റാറ്റസ് റിപ്പോർട്ടുകൾ (Voter Status Reports)</h2>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #eee' }}>
                <button
                    onClick={() => setActiveTab('status_report')}
                    style={{
                        padding: '1rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'status_report' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: activeTab === 'status_report' ? 'var(--primary)' : '#666',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Status Wise Lists
                </button>
                <button
                    onClick={() => setActiveTab('front_report')}
                    style={{
                        padding: '1rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'front_report' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: activeTab === 'front_report' ? 'var(--primary)' : '#666',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Front Wise Stats
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <div className="responsive-grid">
                    <div className="form-group">
                        <label className="label">പഞ്ചായത്ത്</label>
                        <select
                            className="input"
                            value={selectedPanchayat}
                            onChange={e => { setSelectedPanchayat(e.target.value); setSelectedWard(''); setSelectedBooth(''); }}
                            disabled={isWardMember}
                        >
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                            {panchayats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="label">വാർഡ്</label>
                        <select
                            className="input"
                            value={selectedWard}
                            onChange={e => { setSelectedWard(e.target.value); setSelectedBooth(''); }}
                            disabled={!selectedPanchayat || isWardMember}
                        >
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                            {wards.map(w => <option key={w.id} value={w.id}>{w.ward_no} - {w.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="label">ബൂത്ത് (Optional)</label>
                        <select
                            className="input"
                            value={selectedBooth}
                            onChange={e => setSelectedBooth(e.target.value)}
                            disabled={!selectedWard}
                        >
                            <option value="">-- എല്ലാ ബൂത്തുകളും --</option>
                            {booths.map(b => <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="label">സ്റ്റാറ്റസ് (Status)</label>
                        <select
                            className="input"
                            value={selectedStatus}
                            onChange={e => setSelectedStatus(e.target.value)}
                            disabled={activeTab === 'front_report'}
                        >
                            {statusOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {activeTab === 'status_report' && voters.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleDownloadPdf} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileDown size={18} /> PDF Download
                        </button>
                    </div>
                )}
                {activeTab === 'front_report' && (
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => window.print()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileDown size={18} /> Print Report
                        </button>
                    </div>
                )}
            </div>

            {loading ? <LoadingSpinner /> : (
                <div ref={componentRef} id="report-content" style={{ background: 'white', padding: '2rem', borderRadius: '8px' }}>
                    {activeTab === 'status_report' ? (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #eee', paddingBottom: '1rem' }}>
                                <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-bg)', marginBottom: '0.5rem' }}>
                                    {statusOptions.find(s => s.value === selectedStatus)?.label} Voters List
                                </h1>
                                <p style={{ color: '#666', marginBottom: '0.5rem' }}>
                                    Ward: {wards.find(w => w.id === selectedWard)?.ward_no} |
                                    Generated on: {new Date().toLocaleDateString()}
                                </p>
                                <p style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>
                                    Total Voters: {voters.length}
                                </p>
                            </div>

                            {voters.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>SL No</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Guardian Name</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>House Name</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Booth No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {voters.map((voter, index) => (
                                            <tr key={voter.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '0.75rem' }}>{voter.sl_no}</td>
                                                <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{voter.name}</td>
                                                <td style={{ padding: '0.75rem' }}>{voter.guardian_name}</td>
                                                <td style={{ padding: '0.75rem' }}>{voter.house_name}</td>
                                                <td style={{ padding: '0.75rem' }}>{voter.booths?.booth_no}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                                    ഈ വിഭാഗത്തിൽ വോട്ടർമാരില്ല.
                                </div>
                            )}
                        </>
                    ) : (
                        // FRONT REPORT
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #eee', paddingBottom: '1rem' }}>
                                <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-bg)', marginBottom: '0.5rem' }}>
                                    മുന്നണി തിരിച്ചുള്ള വോട്ട് കണക്ക് (Front Wise Vote Report)
                                </h1>
                                <p style={{ color: '#666', marginBottom: '0.5rem' }}>
                                    Ward: {wards.find(w => w.id === selectedWard)?.ward_no} | {wards.find(w => w.id === selectedWard)?.name}
                                </p>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>മുന്നണി (Front)</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Total Supporters</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Voted</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Not Voted</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Percentage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fronts.map(front => {
                                        // Need to be careful: 'voters' is filtered by current selectedStatus.
                                        // Ideally for Front Report we want ALL Active voters usually.
                                        // But here we rely on the filters set above.
                                        // If user selected 'active', it shows stats for active.
                                        const supporters = voters.filter(v => v.supported_front_id === front.id);
                                        const voted = supporters.filter(v => v.has_voted).length;
                                        const notVoted = supporters.length - voted;
                                        const percentage = supporters.length > 0 ? ((voted / supporters.length) * 100).toFixed(1) : 0;

                                        return (
                                            <tr key={front.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: front.color || '#666' }}></div>
                                                    <span style={{ fontWeight: '500' }}>{front.name}</span>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>{supporters.length}</td>
                                                <td style={{ padding: '1rem', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>{voted}</td>
                                                <td style={{ padding: '1rem', textAlign: 'center', color: '#ef4444' }}>{notVoted}</td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>{percentage}%</td>
                                            </tr>
                                        );
                                    })}
                                    <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                                        <td style={{ padding: '1rem' }}>Total</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>{voters.filter(v => v.supported_front_id).length}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: '#10b981' }}>{voters.filter(v => v.supported_front_id && v.has_voted).length}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: '#ef4444' }}>{voters.filter(v => v.supported_front_id && !v.has_voted).length}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>-</td>
                                    </tr>
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
