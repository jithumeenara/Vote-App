import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export default function AddWard() {
    const [panchayats, setPanchayats] = useState([]);
    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [wardNo, setWardNo] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { addToast } = useToast();

    useEffect(() => {
        fetchPanchayats();
    }, []);

    async function fetchPanchayats() {
        const { data } = await supabase.from('panchayats').select('*').order('name');
        setPanchayats(data || []);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('wards').insert([{
                panchayat_id: selectedPanchayat,
                ward_no: parseInt(wardNo),
                name
            }]);
            if (error) throw error;
            addToast('വാർഡ് വിജയകരമായി ചേർത്തു!', 'success');
            setWardNo('');
            setName('');
        } catch (error) {
            addToast('പിശക്: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>വാർഡ് ചേർക്കുക</h2>
            <form onSubmit={handleSubmit} className="card">
                <div className="form-group">
                    <label className="label">പഞ്ചായത്ത് തിരഞ്ഞെടുക്കുക</label>
                    <select
                        className="input"
                        value={selectedPanchayat}
                        onChange={e => setSelectedPanchayat(e.target.value)}
                        required
                    >
                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                        {panchayats.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="label">വാർഡ് നമ്പർ</label>
                    <input
                        type="number"
                        className="input"
                        value={wardNo}
                        onChange={e => setWardNo(e.target.value)}
                        required
                        placeholder="ഉദാ: 1"
                    />
                </div>

                <div className="form-group">
                    <label className="label">വാർഡിന്റെ പേര്</label>
                    <input
                        type="text"
                        className="input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="ഉദാ: ടൗൺ വാർഡ്"
                    />
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'സേവ് ചെയ്യുന്നു...' : 'വാർഡ് സേവ് ചെയ്യുക'}
                </button>
            </form>
        </div>
    );
}
