import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function AddCandidate() {
    const { addToast } = useToast();
    const [districts, setDistricts] = useState([]);
    const [constituencies, setConstituencies] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedConstituency, setSelectedConstituency] = useState('');

    const [name, setName] = useState('');
    const [front, setFront] = useState('');
    const [quote, setQuote] = useState('');
    const [photo, setPhoto] = useState(null);
    const [symbol, setSymbol] = useState(null);

    const [loading, setLoading] = useState(false);
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

    const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            let photoUrl = null;
            let symbolUrl = null;

            if (photo) {
                photoUrl = await convertToBase64(photo);
            }
            if (symbol) {
                symbolUrl = await convertToBase64(symbol);
            }

            if (isWardMember) {
                // Secure RPC for Ward User
                const { error } = await supabase.rpc('ward_add_candidate', {
                    token: user.session_token,
                    name_input: name,
                    front_input: front,
                    quote_input: quote,
                    photo_url_input: photoUrl,
                    symbol_url_input: symbolUrl
                });
                if (error) throw error;
            } else {
                // Standard Insert for Admin
                const { error } = await supabase.from('candidates').insert([{
                    constituency_id: selectedConstituency,
                    name,
                    front,
                    quote,
                    photo_url: photoUrl,
                    symbol_url: symbolUrl
                }]);
                if (error) throw error;
            }

            addToast('സ്ഥാനാർത്ഥിയെ വിജയകരമായി ചേർത്തു!', 'success');
            setName('');
            setFront('');
            setQuote('');
            setPhoto(null);
            setSymbol(null);
            document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
        } catch (error) {
            console.error('Error adding candidate:', error);
            addToast('പിശക്: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>സ്ഥാനാർത്ഥിയെ ചേർക്കുക</h2>
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
                    <label className="label">സ്ഥാനാർത്ഥിയുടെ പേര്</label>
                    <input
                        type="text"
                        className="input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="ഉദാ: ജോൺ ഡോ"
                    />
                </div>

                <div className="form-group">
                    <label className="label">മുന്നണി / പാർട്ടി</label>
                    <input
                        type="text"
                        className="input"
                        value={front}
                        onChange={e => setFront(e.target.value)}
                        required
                        placeholder="ഉദാ: എൽ.ഡി.എഫ് / യു.ഡി.എഫ് / സ്വതന്ത്രൻ"
                    />
                </div>

                <div className="form-group">
                    <label className="label">വാചകം (Quote)</label>
                    <input
                        type="text"
                        className="input"
                        value={quote}
                        onChange={e => setQuote(e.target.value)}
                    />
                </div>

                <div className="form-group">
                    <label className="label">സ്ഥാനാർത്ഥിയുടെ ഫോട്ടോ</label>
                    <input
                        type="file"
                        className="input"
                        accept="image/*"
                        onChange={e => setPhoto(e.target.files[0])}
                    />
                </div>

                <div className="form-group">
                    <label className="label">ചിഹ്നം</label>
                    <input
                        type="file"
                        className="input"
                        accept="image/*"
                        onChange={e => setSymbol(e.target.files[0])}
                    />
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'സേവ് ചെയ്യുന്നു...' : 'സ്ഥാനാർത്ഥിയെ സേവ് ചെയ്യുക'}
                </button>
            </form>
        </div>
    );
}
