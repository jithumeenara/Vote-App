import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronRight, MapPin } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function DistrictList() {
    const [districts, setDistricts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDistricts();
    }, []);

    async function fetchDistricts() {
        try {
            const { data, error } = await supabase
                .from('districts')
                .select('*')
                .order('name');

            if (error) throw error;
            setDistricts(data || []);
        } catch (error) {
            console.error('Error fetching districts:', error.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>ജില്ല തിരഞ്ഞെടുക്കുക</h2>
            <div className="grid grid-3">
                {districts.map((district) => (
                    <Link key={district.id} to={`/district/${district.id}`} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <MapPin size={24} color="var(--primary)" />
                            <span style={{ fontWeight: '700', fontSize: '1.2rem' }}>{district.name}</span>
                        </div>
                        <ChevronRight size={24} color="var(--text-light)" />
                    </Link>
                ))}
            </div>
            {districts.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>
                    ജില്ലകളൊന്നും കണ്ടെത്തിയില്ല. അഡ്മിൻ പാനലിൽ നിന്ന് ചേർക്കുക.
                </div>
            )}
        </div>
    );
}
