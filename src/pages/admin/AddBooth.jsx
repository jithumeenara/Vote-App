import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function AddBooth() {
    const [districts, setDistricts] = useState([]);
    const [constituencies, setConstituencies] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedConstituency, setSelectedConstituency] = useState('');
    const [boothNo, setBoothNo] = useState('');
    const [name, setName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const { user } = useAuth();
    const isWardMember = user?.role === 'ward_member';

    useEffect(() => {
        fetchDistricts();
        if (isWardMember && user?.ward_id) {
            fetchUserConstituencyDetails();
        }
    }, [user]);

    async function fetchUserConstituencyDetails() {
        const { data } = await supabase
            .from('constituencies')
            .select('id, district_id')
            .eq('id', user.ward_id)
            .single();

        if (data) {
            setSelectedDistrict(data.district_id);
            setSelectedConstituency(data.id);
        }
    }

    useEffect(() => {
        if (selectedDistrict) {
            fetchConstituencies(selectedDistrict);
        } else {
            setConstituencies([]);
        }
    }, [selectedDistrict]);

    async function fetchDistricts() {
        const { data } = await supabase.from('districts').select('*').order('name');
        setDistricts(data || []);
    }

    async function fetchConstituencies(districtId) {
        const { data } = await supabase.from('constituencies').select('*').eq('district_id', districtId).order('constituency_no');
        setConstituencies(data || []);
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
                    name_input: name,
                    contact_number_input: contactNumber
                });
                if (error) throw error;
            } else {
                // Standard Insert for Admin
                const { error } = await supabase.from('booths').insert([{
                    constituency_id: selectedConstituency,
                    booth_no: parseInt(boothNo),
                    name,
                    contact_number: contactNumber
                }]);
                if (error) throw error;
            }

            addToast('ബൂത്ത് വിജയകരമായി ചേർത്തു!', 'success');
            setBoothNo('');
            setName('');
            setContactNumber('');
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
                    <label className="label">ജില്ല തിരഞ്ഞെടുക്കുക</label>
                    <select
                        className="input"
                        value={selectedDistrict}
                        onChange={e => setSelectedDistrict(e.target.value)}
                        required
                        disabled={isWardMember}
                    >
                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                        {districts.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="label">നിയോജക മണ്ഡലം തിരഞ്ഞെടുക്കുക</label>
                    <select
                        className="input"
                        value={selectedConstituency}
                        onChange={e => setSelectedConstituency(e.target.value)}
                        required
                        disabled={!selectedDistrict || isWardMember}
                    >
                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                        {constituencies.map(c => (
                            <option key={c.id} value={c.id}>{c.constituency_no} - {c.name}</option>
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
                    <label className="label">സഹായത്തിനുള്ള നമ്പർ (Help Phone)</label>
                    <input
                        type="tel"
                        className="input"
                        value={contactNumber}
                        onChange={e => setContactNumber(e.target.value)}
                        placeholder="ഉദാ: 9876543210"
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
