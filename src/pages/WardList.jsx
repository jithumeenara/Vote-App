import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronRight, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function WardList() {
    const { panchayatId } = useParams();
    const [wards, setWards] = useState([]);
    const [panchayatName, setPanchayatName] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPopup, setShowPopup] = useState(true);

    useEffect(() => {
        fetchWards();
    }, [panchayatId]);

    async function fetchWards() {
        try {
            // Fetch Panchayat Name
            const { data: pData } = await supabase.from('panchayats').select('name').eq('id', panchayatId).single();
            if (pData) setPanchayatName(pData.name);

            // Fetch Wards
            const { data, error } = await supabase
                .from('wards')
                .select('*')
                .eq('panchayat_id', panchayatId)
                .order('ward_no');

            if (error) throw error;
            setWards(data || []);
        } catch (error) {
            console.error('Error fetching wards:', error.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            {showPopup && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        position: 'relative',
                        maxWidth: '500px',
                        width: '100%',
                        background: 'transparent',
                        borderRadius: '16px',
                        overflow: 'hidden'
                    }}>
                        <button
                            onClick={() => setShowPopup(false)}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                                zIndex: 10
                            }}
                        >
                            <X size={24} color="var(--primary)" />
                        </button>
                        <img
                            src="/popup_image.jpg"
                            alt="Welcome"
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                                borderRadius: '16px'
                            }}
                        />
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
                <span style={{ color: 'var(--text-light)', fontSize: '1rem' }}>പഞ്ചായത്ത്</span>
                <h1 style={{ color: 'var(--primary-bg)' }}>{panchayatName}</h1>
            </div>

            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text)' }}>വാർഡ് തിരഞ്ഞെടുക്കുക</h3>
            <div className="grid grid-3">
                {wards.map((ward) => (
                    <Link key={ward.id} to={`/ward/${ward.id}`} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: 'var(--primary)', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                {ward.ward_no}
                            </div>
                            <span style={{ fontWeight: '700', fontSize: '1.2rem' }}>{ward.name}</span>
                        </div>
                        <ChevronRight size={24} color="var(--text-light)" />
                    </Link>
                ))}
            </div>
            {wards.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>
                    ഈ പഞ്ചായത്തിൽ വാർഡുകളൊന്നും കണ്ടെത്തിയില്ല.
                </div>
            )}
        </div>
    );
}
