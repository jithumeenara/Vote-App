import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Papa from 'papaparse';
import { useToast } from '../../context/ToastContext';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UploadVoters() {
    const [districts, setDistricts] = useState([]);
    const [constituencies, setConstituencies] = useState([]);
    const [booths, setBooths] = useState([]);

    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedConstituency, setSelectedConstituency] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');

    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef(null);
    const { addToast } = useToast();
    const { user } = useAuth();
    const isWardMember = user?.role === 'ward_member';
    const isBoothMember = user?.role === 'booth_member';

    useEffect(() => {
        if (!isBoothMember) fetchDistricts();
        if (isWardMember && user?.ward_id) {
            fetchUserConstituencyDetails();
        } else if (isBoothMember && user?.booth_id) {
            fetchUserBoothDetails();
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

    async function fetchUserBoothDetails() {
        const { data } = await supabase
            .from('booths')
            .select('*, constituencies(*, districts(*))')
            .eq('id', user.booth_id)
            .single();

        if (data) {
            setDistricts([data.constituencies.districts]);
            setConstituencies([data.constituencies]);
            setBooths([data]);
            setSelectedDistrict(data.constituencies.district_id);
            setSelectedConstituency(data.constituency_id);
            setSelectedBooth(data.id);
        }
    }

    useEffect(() => {
        if (selectedDistrict) {
            fetchConstituencies(selectedDistrict);
        } else {
            setConstituencies([]);
            setBooths([]);
        }
    }, [selectedDistrict]);

    useEffect(() => {
        if (selectedConstituency) {
            fetchBooths(selectedConstituency);
        } else {
            setBooths([]);
        }
    }, [selectedConstituency]);

    async function fetchDistricts() {
        const { data } = await supabase.from('districts').select('*').order('name');
        setDistricts(data || []);
    }

    async function fetchConstituencies(districtId) {
        const { data } = await supabase.from('constituencies').select('*').eq('district_id', districtId).order('constituency_no');
        setConstituencies(data || []);
    }

    async function fetchBooths(constituencyId) {
        const { data } = await supabase.from('booths').select('*').eq('constituency_id', constituencyId).order('booth_no');
        setBooths(data || []);
    }

    function handleDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    }

    function handleChange(e) {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    }

    function validateAndSetFile(file) {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            addToast('ദയവായി ഒരു CSV ഫയൽ അപ്‌ലോഡ് ചെയ്യുക', 'error');
            return;
        }
        setFile(file);
        parseFileForPreview(file);
    }

    function parseGenderAge(value) {
        if (!value) return { gender: '', age: 0 };
        const parts = value.split('/').map(s => s.trim());
        if (parts.length === 2) {
            return { gender: parts[0], age: parseInt(parts[1]) || 0 };
        }
        return { gender: value, age: 0 };
    }

    // Helper to find key case-insensitively and ignoring special chars
    function findKey(row, possibleKeys) {
        const rowKeys = Object.keys(row);
        for (const key of possibleKeys) {
            const found = rowKeys.find(k => k.toLowerCase().trim() === key.toLowerCase().trim() || k.toLowerCase().includes(key.toLowerCase()));
            if (found) return found;
        }
        return null;
    }

    function parseFileForPreview(file) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: 'UTF-8',
            transformHeader: (h) => h.trim(),
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    const mappedData = results.data.slice(0, 5).map(row => {
                        const genderAge = parseGenderAge(row[findKey(row, ['Gender / Age', 'Gender/Age'])] || '');
                        const ageRaw = row[findKey(row, ['age', 'Age'])];
                        const genderRaw = row[findKey(row, ['gender', 'Gender'])];
                        return {
                            sl_no: row[findKey(row, ['serial_number', 'Sl no', 'Sl No', 'Sl.No'])],
                            name: row[findKey(row, ['name', 'Name'])],
                            guardian_name: row[findKey(row, ['parent_or_spouse_name', 'Guardian\'s Name', 'Guardian Name'])],
                            house_no: row[findKey(row, ['house_number', 'OldWard No/ House No.', 'OldWard No/House No', 'House No'])],
                            house_name: row[findKey(row, ['House Name'])],
                            gender: genderRaw || genderAge.gender,
                            age: ageRaw ? parseInt(ageRaw) : genderAge.age,
                            id_card_no: row[findKey(row, ['voter_id', 'New SEC ID No.', 'ID Card No', 'SEC ID'])]
                        };
                    });
                    setPreviewData(mappedData);
                }
            },
            error: (error) => {
                addToast('CSV വായിക്കുന്നതിൽ പിശക്: ' + error.message, 'error');
            }
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!file || !selectedBooth) return;

        setLoading(true);
        setStatus('CSV ഫയൽ പരിശോധിക്കുന്നു...');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: 'UTF-8',
            transformHeader: (h) => h.trim(),
            complete: async (results) => {
                try {
                    setStatus(`${results.data.length} വോട്ടർമാരെ അപ്‌ലോഡ് ചെയ്യുന്നു...`);

                    const voters = results.data.map(row => {
                        const genderAge = parseGenderAge(row[findKey(row, ['Gender / Age', 'Gender/Age'])] || '');
                        const ageRaw = row[findKey(row, ['age', 'Age'])];
                        const genderRaw = row[findKey(row, ['gender', 'Gender'])];

                        return {
                            booth_id: selectedBooth,
                            sl_no: parseInt(row[findKey(row, ['serial_number', 'Sl no', 'Sl No', 'Sl.No'])] || 0),
                            name: row[findKey(row, ['name', 'Name'])],
                            guardian_name: row[findKey(row, ['parent_or_spouse_name', 'Guardian\'s Name', 'Guardian Name'])],
                            house_no: row[findKey(row, ['house_number', 'OldWard No/ House No.', 'OldWard No/House No', 'House No'])],
                            house_name: row[findKey(row, ['House Name'])],
                            gender: genderRaw || genderAge.gender,
                            age: ageRaw ? parseInt(ageRaw) : genderAge.age,
                            id_card_no: row[findKey(row, ['voter_id', 'New SEC ID No.', 'ID Card No', 'SEC ID'])]
                        };
                    });

                    const invalidRows = voters.filter(v => !v.name || !v.id_card_no);
                    if (invalidRows.length > 0) {
                        console.warn('Some rows are missing required fields:', invalidRows);
                    }

                    if (isWardMember) {
                        // Secure RPC for Ward User (Bulk Upload)
                        // We need to chunk it because RPC might have payload limits, but let's try 100 at a time.
                        const chunkSize = 100;
                        for (let i = 0; i < voters.length; i += chunkSize) {
                            const chunk = voters.slice(i, i + chunkSize);
                            const { error } = await supabase.rpc('ward_upload_voters', {
                                token: user.session_token,
                                booth_id_input: selectedBooth,
                                voters_json: chunk
                            });
                            if (error) throw error;
                            setStatus(`${Math.min(i + chunkSize, voters.length)} / ${voters.length} വോട്ടർമാരെ അപ്‌ലോഡ് ചെയ്തു...`);
                        }
                    } else {
                        // Standard Insert for Admin
                        const chunkSize = 100;
                        for (let i = 0; i < voters.length; i += chunkSize) {
                            const chunk = voters.slice(i, i + chunkSize);
                            const { error } = await supabase.from('voters').insert(chunk);
                            if (error) throw error;
                            setStatus(`${Math.min(i + chunkSize, voters.length)} / ${voters.length} വോട്ടർമാരെ അപ്‌ലോഡ് ചെയ്തു...`);
                        }
                    }

                    setStatus('അപ്‌ലോഡ് പൂർത്തിയായി!');
                    addToast('വോട്ടർമാരെ വിജയകരമായി അപ്‌ലോഡ് ചെയ്തു!', 'success');
                    setFile(null);
                    setPreviewData([]);
                } catch (error) {
                    console.error(error);
                    setStatus('പിശക്: ' + error.message);
                    addToast('വോട്ടർമാരെ അപ്‌ലോഡ് ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു.', 'error');
                } finally {
                    setLoading(false);
                }
            },
            error: (error) => {
                setStatus('CSV ഫയൽ വായിക്കുന്നതിൽ പിശക്');
                setLoading(false);
                addToast('CSV ഫയൽ വായിക്കുന്നതിൽ പിശക്', 'error');
            }
        });
    }

    function downloadSampleCSV() {
        const csvContent = "\uFEFFserial_number,voter_id,name,parent_or_spouse_name,house_number,age,gender\n" +
            "1,WRS1724202,ദേവിക ബി ജി,ഗോപിനാഥൻ കെ,വാലകത്ത് വീട്,26,സ്ത്രീ\n" +
            "2,WRS1446467,വൽസലകുമാരി എസ്,സനൽ കുമാർ,/ രാഗാർദ്രം,70,സ്ത്രീ\n";

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'sample_voters.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>വോട്ടർമാരെ അപ്‌ലോഡ് ചെയ്യുക (CSV)</h2>
            <form onSubmit={handleSubmit} className="card">
                {!isBoothMember && <div className="grid grid-3" style={{ gap: '1rem', marginBottom: '2rem' }}>
                    <div className="form-group">
                        <label className="label">ജില്ല</label>
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
                        <label className="label">നിയോജക മണ്ഡലം</label>
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
                        <label className="label">ബൂത്ത്</label>
                        <select
                            className="input"
                            value={selectedBooth}
                            onChange={e => setSelectedBooth(e.target.value)}
                            required
                            disabled={!selectedConstituency}
                        >
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                            {booths.map(b => (
                                <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>}

                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <label className="label" style={{ marginBottom: 0 }}>CSV ഫയൽ അപ്‌ലോഡ് ചെയ്യുക</label>
                        <button
                            type="button"
                            onClick={downloadSampleCSV}
                            className="btn"
                            style={{ fontSize: '0.85rem', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', border: '1px solid var(--primary)', background: 'transparent' }}
                        >
                            <FileText size={16} />
                            മാതൃക CSV ഡൗൺലോഡ് ചെയ്യുക
                        </button>
                    </div>

                    <div
                        className={`upload-box ${dragActive ? 'active' : ''}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current.click()}
                        style={{
                            border: '2px dashed var(--border)',
                            borderRadius: '12px',
                            padding: '3rem 2rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: dragActive ? '#f0f9ff' : 'var(--bg)',
                            borderColor: dragActive ? 'var(--primary)' : 'var(--border)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleChange}
                            style={{ display: 'none' }}
                        />

                        {file ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    background: '#dcfce7',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--success)'
                                }}>
                                    <CheckCircle size={32} />
                                </div>
                                <div>
                                    <h4 style={{ marginBottom: '0.25rem' }}>{file.name}</h4>
                                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                                        {(file.size / 1024).toFixed(2)} KB
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="btn"
                                    style={{ color: 'var(--danger)', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                >
                                    നീക്കം ചെയ്യുക
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    background: '#f1f5f9',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-light)'
                                }}>
                                    <Upload size={32} />
                                </div>
                                <div>
                                    <h4 style={{ marginBottom: '0.5rem' }}>ഇവിടെ ക്ലിക്ക് ചെയ്യുക അല്ലെങ്കിൽ ഫയൽ ഡ്രാഗ് ചെയ്യുക</h4>
                                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', maxWidth: '300px', margin: '0 auto' }}>
                                        CSV ഫയൽ മാത്രം. ആവശ്യമായ ഹെഡറുകൾ: serial_number, voter_id, name, parent_or_spouse_name, house_number, age, gender
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {previewData.length > 0 && (
                    <div style={{ marginBottom: '2rem', overflowX: 'auto' }}>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>ഡാറ്റ പ്രിവ്യൂ (ആദ്യത്തെ 5 വരികൾ)</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>Sl No</th>
                                    <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>Name</th>
                                    <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>House No</th>
                                    <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>House Name</th>
                                    <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>Gender</th>
                                    <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>Age</th>
                                    <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>ID Card</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.map((row, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.75rem' }}>{row.sl_no}</td>
                                        <td style={{ padding: '0.75rem' }}>{row.name}</td>
                                        <td style={{ padding: '0.75rem' }}>{row.house_no}</td>
                                        <td style={{ padding: '0.75rem' }}>{row.house_name}</td>
                                        <td style={{ padding: '0.75rem' }}>{row.gender}</td>
                                        <td style={{ padding: '0.75rem' }}>{row.age}</td>
                                        <td style={{ padding: '0.75rem' }}>{row.id_card_no}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {status && (
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="logo-spinner" style={{ width: '30px', height: '30px', display: loading ? 'block' : 'none' }}></div>
                        <span>{status}</span>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" disabled={loading || !file || !selectedBooth} style={{ padding: '0.75rem 2rem' }}>
                        {loading ? 'അപ്‌ലോഡ് ചെയ്യുന്നു...' : 'അപ്‌ലോഡ് ആരംഭിക്കുക'}
                    </button>
                </div>
            </form>
        </div>
    );
}
