import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export default function AddConstituency() {
    const [districts, setDistricts] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [constituencyNo, setConstituencyNo] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { addToast } = useToast();

    useEffect(() => {
        fetchDistricts();
    }, []);

    async function fetchDistricts() {
        const { data } = await supabase.from('districts').select('*').order('name');
        setDistricts(data || []);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('constituencies').insert([{
                district_id: selectedDistrict,
                constituency_no: parseInt(constituencyNo),
                name
            }]);
            if (error) throw error;
            addToast('നിയോജക മണ്ഡലം വിജയകരമായി ചേർത്തു!', 'success');
            setConstituencyNo('');
            setName('');
        } catch (error) {
            addToast('പിശക്: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>നിയോജക മണ്ഡലം ചേർക്കുക</h2>
            <form onSubmit={handleSubmit} className="card">
                <div className="form-group">
                    <label className="label">ജില്ല തിരഞ്ഞെടുക്കുക</label>
                    <select
                        className="input"
                        value={selectedDistrict}
                        onChange={e => setSelectedDistrict(e.target.value)}
                        required
                    >
                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                        {districts.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="label">നിയോജക മണ്ഡലം നമ്പർ</label>
                    <input
                        type="number"
                        className="input"
                        value={constituencyNo}
                        onChange={e => setConstituencyNo(e.target.value)}
                        required
                        placeholder="ഉദാ: 1"
                    />
                </div>

                <div className="form-group">
                    <label className="label">നിയോജക മണ്ഡലത്തിന്റെ പേര്</label>
                    <input
                        type="text"
                        className="input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="ഉദാ: നേമം"
                    />
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'സേവ് ചെയ്യുന്നു...' : 'നിയോജക മണ്ഡലം സേവ് ചെയ്യുക'}
                </button>
            </form>
        </div>
    );
}
