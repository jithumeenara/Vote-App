import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function AddCandidate() {
    const { addToast } = useToast();
    const [panchayats, setPanchayats] = useState([]);
    const [wards, setWards] = useState([]);
    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [selectedWard, setSelectedWard] = useState('');

    const [name, setName] = useState('');
    const [front, setFront] = useState('');
    const [quote, setQuote] = useState('');
    const [photo, setPhoto] = useState(null);
    const [symbol, setSymbol] = useState(null);

    const [loading, setLoading] = useState(false);
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
                    ward_id: selectedWard,
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
            // Reset file inputs manually if needed or use a ref
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
