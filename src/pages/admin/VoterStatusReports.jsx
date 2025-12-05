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
    const [loading, setLoading] = useState(false);

    const isWardMember = user?.role === 'ward_member';

    const statusOptions = [
        { value: 'shifted', label: 'Shifted' },
        { value: 'deleted', label: 'Deleted' },
        { value: 'death', label: 'Death' },
        { value: 'gulf', label: 'Gulf' },
        { value: 'out_of_place', label: 'Out of Place' },
        { value: 'duplicate', label: 'Duplicate' }
    ];

    useEffect(() => {
        fetchPanchayats();
        if (isWardMember && user?.ward_id) {
            fetchUserWardDetails();
        }
    }, [user]);

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
                .eq('status', selectedStatus)
                .order('sl_no');

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
                {voters.length > 0 && (
                    <button onClick={handleDownloadPdf} className="btn btn-primary">
                        <FileDown size={20} /> PDF ഡൗൺലോഡ് ചെയ്യുക
                    </button>
                )}
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
                        >
                            {statusOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? <LoadingSpinner /> : (
                <div ref={componentRef} id="report-content" style={{ background: 'white', padding: '2rem', borderRadius: '8px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #eee', paddingBottom: '1rem' }}>
                        <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-bg)', marginBottom: '0.5rem' }}>
                            {statusOptions.find(s => s.value === selectedStatus)?.label} Voters List
                        </h1>
                        <p style={{ color: '#666' }}>
                            Ward: {wards.find(w => w.id === selectedWard)?.ward_no} |
                            Generated on: {new Date().toLocaleDateString()}
                        </p>
                    </div>

                    {voters.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>SL No</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>House Name</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Age</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID Card No</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Booth</th>
                                </tr>
                            </thead>
                            <tbody>
                                {voters.map((voter, index) => (
                                    <tr key={voter.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '0.75rem' }}>{voter.sl_no}</td>
                                        <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{voter.name}</td>
                                        <td style={{ padding: '0.75rem' }}>{voter.house_name}</td>
                                        <td style={{ padding: '0.75rem' }}>{voter.age}</td>
                                        <td style={{ padding: '0.75rem' }}>{voter.id_card_no}</td>
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
                </div>
            )}
        </div>
    );
}
