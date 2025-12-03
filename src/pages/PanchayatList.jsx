import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronRight, MapPin } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PanchayatList() {
    const [panchayats, setPanchayats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPanchayats();
    }, []);

    async function fetchPanchayats() {
        try {
            const { data, error } = await supabase
                .from('panchayats')
                .select('*')
                .order('name');

            if (error) throw error;
            setPanchayats(data || []);
        } catch (error) {
            console.error('Error fetching panchayats:', error.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>ഗ്രാമപഞ്ചായത്ത് തിരഞ്ഞെടുക്കുക</h2>
            <div className="grid grid-3">
                {panchayats.map((panchayat) => (
                    <Link key={panchayat.id} to={`/panchayat/${panchayat.id}`} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <MapPin size={24} color="var(--primary)" />
                            <span style={{ fontWeight: '700', fontSize: '1.2rem' }}>{panchayat.name}</span>
                        </div>
                        <ChevronRight size={24} color="var(--text-light)" />
                    </Link>
                ))}
            </div>
            {panchayats.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>
                    പഞ്ചായത്തുകളൊന്നും കണ്ടെത്തിയില്ല. അഡ്മിൻ പാനലിൽ നിന്ന് ചേർക്കുക.
                </div>
            )}
        </div>
    );
}
