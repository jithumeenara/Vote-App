import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export default function AddDistrict() {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { addToast } = useToast();

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('districts').insert([{ name }]);
            if (error) throw error;
            addToast('ജില്ല വിജയകരമായി ചേർത്തു!', 'success');
            navigate('/admin');
        } catch (error) {
            addToast('പിശക്: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>ജില്ല ചേർക്കുക</h2>
            <form onSubmit={handleSubmit} className="card">
                <div className="form-group">
                    <label className="label">ജില്ലയുടെ പേര്</label>
                    <input
                        type="text"
                        className="input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="ഉദാ: തിരുവനന്തപുരം"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'സേവ് ചെയ്യുന്നു...' : 'ജില്ല സേവ് ചെയ്യുക'}
                </button>
            </form>
        </div>
    );
}
