import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function AddBooth() {
    const [panchayats, setPanchayats] = useState([]);
    const [wards, setWards] = useState([]);
    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [boothNo, setBoothNo] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const { user } = useAuth();
    const isWardMember = user?.role === 'ward_member';

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

    useEffect(() => {
        if (selectedPanchayat) {
            fetchWards(selectedPanchayat);
        } else {
            setWards([]);
        }
    }, [selectedPanchayat]);

    async function fetchPanchayats() {
        const { data } = await supabase.from('panchayats').select('*').order('name');
        setPanchayats(data || []);
    }

    async function fetchWards(panchayatId) {
        const { data } = await supabase.from('wards').select('*').eq('panchayat_id', panchayatId).order('ward_no');
        setWards(data || []);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            if (isWardMember) {
                // Secure RPC for Ward User
                const { error } = await supabase.rpc('ward_add_booth', {
                    token: user.session_token,
                    booth_no_input: parseInt(boothNo),
                    name_input: name
                });
                if (error) throw error;
            } else {
                // Standard Insert for Admin
                const { error } = await supabase.from('booths').insert([{
                    ward_id: selectedWard,
                    booth_no: parseInt(boothNo),
                    name
                }]);
                if (error) throw error;
            }

            addToast('ബൂത്ത് വിജയകരമായി ചേർത്തു!', 'success');
            setBoothNo('');
            setName('');
        } catch (error) {
            addToast('പിശക്: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>ബൂത്ത് ചേർക്കുക</h2>
            <form onSubmit={handleSubmit} className="card">
                <div className="form-group">
                    <label className="label">പഞ്ചായത്ത് തിരഞ്ഞെടുക്കുക</label>
                    <select
                        className="input"
                        value={selectedPanchayat}
                        onChange={e => setSelectedPanchayat(e.target.value)}
                        required
                        disabled={isWardMember}
                    >
                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                        {panchayats.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="label">വാർഡ് തിരഞ്ഞെടുക്കുക</label>
                    <select
                        className="input"
                        value={selectedWard}
                        onChange={e => setSelectedWard(e.target.value)}
                        required
                        disabled={!selectedPanchayat || isWardMember}
                    >
                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                        {wards.map(w => (
                            <option key={w.id} value={w.id}>{w.ward_no} - {w.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="label">ബൂത്ത് നമ്പർ</label>
                    <input
                        type="number"
                        className="input"
                        value={boothNo}
                        onChange={e => setBoothNo(e.target.value)}
                        required
                        placeholder="ഉദാ: 1"
                    />
                </div>

                <div className="form-group">
                    <label className="label">ബൂത്തിന്റെ പേര്</label>
                    <input
                        type="text"
                        className="input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="ഉദാ: ഗവൺമെന്റ് ഹൈസ്കൂൾ (നോർത്ത് ബ്ലോക്ക്)"
                    />
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'സേവ് ചെയ്യുന്നു...' : 'ബൂത്ത് സേവ് ചെയ്യുക'}
                </button>
            </form>
        </div>
    );
}
