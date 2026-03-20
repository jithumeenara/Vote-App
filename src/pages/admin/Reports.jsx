import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { ArrowUp, ArrowDown, Users, UserCheck, UserX, UserMinus, AlertTriangle, Ban, HelpCircle, Copy, Home, Moon, Star, Sparkles, ChevronDown, ChevronUp, Printer } from 'lucide-react';

// ── Religion auto-detection (Kerala name patterns) ─────────────────────────
const MUSLIM_TOKENS = [
    'mohammed','mohamad','muhammad','mohd','abu ','abu-',
    'abdul','abdulla','abdu','abubakr','abubakar',
    'hassan','husain','hussain','hasan','habeeb','habib',
    'sheikh','syed','sayyid','fathima','fatima','faheema',
    'ayisha','aisha','aysha','zainab','hafsath','hafsa',
    'mariyam','maryam','shahana','shafina','shafeeqa',
    'safiya','safia','najma','najeeba','noushad','nowshad',
    'rasheed','rashid','aslam','ansar','ansari','siraj',
    'basheer','bashir','kabeer','kabir','salim','saleem',
    'rahim','raheem','jaleel','jalil','hameed','hamid',
    'waheed','wahid','majeed','majid','hakeem','hakim',
    'ismail','ismaeel','ibrahim','ibraheem','yusuf','yoosuf',
    'usman','siddique','siddiqui','sidheek','shareef','sharif','sherif',
    'koya',' haji','hajee','shafi','shafee','nizar','nisar',
    'feroz','feroos','rafeeq','rafiq','rafeeque',
    'musthafa','mustafa','rahman','rehman','riyaz','riyas',
    'swalih','salah','tahir','tariq','thariq','zakariya',
    'muneer','munir','naushad','afsal','afzal','ashraf',
    'shihab','sahib','sahab','kunhi','kunjikutty','moideen','moidu',
    'ahammed','ahamed','ummer','umar','omar','ibnu','ibn ',
    'ayub','ayyub','shabeer','jabir','jabeer','jasim','jassim',
    'lukman','luqman','naufal','nawfal','shabana','rukhsana',
    'raheela','raziya','rabiya','rabeeya','ruqaiya','sulfikar',
    'sulfikkar','sulekha','subaida','sumayya','thasneem',
    'thasni','unais','unaiz','vazeer','vazir','zubair','zubear',
];
const CHRISTIAN_TOKENS = [
    'thomas','george','john ','jose ','joseph','paul ','peter','matthew',
    'philip','stephen','alex ','abraham','augustine','xavier','francis',
    'antony','anthony','sebastian','lawrence','vincent','biju','shibu',
    ' mary ','mariam','mariamma','annamma','aleyamma','kunjumol','molly',
    'tessy','celine','lisy','lissy','lizy','ancy','shaly','sheela',
    'suresh thomas','varghese','mathew','chacko','kuttappan','tharakan',
    'mundadan','panickar','kuriakose','cyriac','cyril','eapen','elias',
    'elisha','elizabath','elizabetha','elsamma','ommen','oommen',
    'thankamma','rosamma','annakutty','marykutty','omana','kunjamma',
    'saby','sabu','sajimon','saji','saju','somy','soby','sobin','sojan',
    'shijo','shino','shinu','shiju','shyjo','aby','abin','abishek',
    'abiram','achu','achuthan christian','agi','agio','agius',
    'agi','giby','gigi','gigin','gigy','gijo','gijin','gijoy',
    'gigy','benny','beno','benoj','bibin','biby','bijo','biji',
    'binil','binoy','binu','boby','bobby','bobin','boban',
    'christy','christu','christo','cijo','cinu','ciby','cibin',
    'dijo','diji','dibin','diby','dinil','dinesh christian',
];
const HINDU_STRONG = [
    'nair','menon','pillai','kurup','panikkar','warrier','namboothiri',
    'nambiar','namboodiri','pothuval','ezhava','thiyya','panicker',
    'krishnan','muraleedharan','gopinathan','damodaran','gopalan',
    'balakrishnan','narayanan','sivasankaran','subrahmanyam',
    'devan','ashtamurthy','vaidyan','chathu','chattambikkaran',
    'ammini','omana hindu','thankam','kalyani','kamalam','sarojam',
    'geetha','radha','seetha','sumathi','leela','mallika','bindhu',
    'sreedevi','sreelatha','sreekala','sreeja','sreekumar',
    'unnikrishnan','unnikrishan','harikrishnan','hari krishnan',
    'ravi','raju','raman','vijayan','sureshkumar','mohanan',
    'chandran','chandramohan','padmanabhan','venugopal','rajendran',
    'babu','balan','balakumar','aravind','arjun','ajith','ajin',
];

function detectReligion(name) {
    if (!name) return 'Other';
    const n = ` ${name.toLowerCase()} `;
    let muslimScore = 0, christianScore = 0, hinduScore = 0;
    for (const t of MUSLIM_TOKENS) { if (n.includes(t)) muslimScore += 2; }
    for (const t of CHRISTIAN_TOKENS) { if (n.includes(t)) christianScore += 2; }
    for (const t of HINDU_STRONG) { if (n.includes(t)) hinduScore += 2; }
    // Tiebreak: Kerala default lean towards Hindu
    hinduScore += 0.5;
    const max = Math.max(muslimScore, christianScore, hinduScore);
    if (max < 1) return 'Other';
    if (max === muslimScore) return 'Muslim';
    if (max === christianScore) return 'Christian';
    return 'Hindu';
}

export default function Reports() {
    const { user } = useAuth();
    const [districts, setDistricts] = useState([]);
    const [constituencies, setConstituencies] = useState([]);
    const [booths, setBooths] = useState([]);

    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedConstituency, setSelectedConstituency] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');

    const [stats, setStats] = useState({
        total: 0, male: 0, female: 0, active: 0, deleted: 0,
        shifted: 0, death: 0, gulf: 0, out_of_place: 0, duplicate: 0
    });
    const [loading, setLoading] = useState(false);
    const [isAtTop, setIsAtTop] = useState(true);

    // Analysis tabs
    const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'family' | 'religion'
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [familyGroups, setFamilyGroups] = useState(null);
    const [religionGroups, setReligionGroups] = useState(null);
    const [expandedFamily, setExpandedFamily] = useState(null);

    const isWardMember = user?.role === 'ward_member';
    const isBoothMember = user?.role === 'booth_member';

    useEffect(() => {
        if (!isBoothMember) fetchDistricts();
        if (isWardMember && user?.ward_id) {
            fetchUserConstituencyDetails();
        } else if (isBoothMember && user?.booth_id) {
            fetchUserBoothDetails();
        } else {
            fetchStats(); // Initial fetch for admin (all voters)
        }

        const handleScroll = () => {
            setIsAtTop(window.scrollY < 100);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [user]);

    const handleScrollAction = () => {
        if (isAtTop) {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

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
        if (!isWardMember) fetchStats();
    }, [selectedDistrict]);

    useEffect(() => {
        if (selectedConstituency) {
            fetchBooths(selectedConstituency);
        } else {
            setBooths([]);
        }
        fetchStats();
    }, [selectedConstituency]);

    useEffect(() => {
        fetchStats();
    }, [selectedBooth]);

    // Real-time: auto-refresh stats when votes change
    useEffect(() => {
        if (!selectedConstituency && !selectedBooth && !selectedDistrict) return;

        const channel = supabase
            .channel(`reports-realtime-${selectedBooth || selectedConstituency || selectedDistrict}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'voters'
            }, () => {
                fetchStats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedBooth, selectedConstituency, selectedDistrict]);

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

    async function fetchStats() {
        setLoading(true);
        try {
            const applyFilters = (query) => {
                if (selectedBooth) {
                    return query.eq('booth_id', selectedBooth);
                } else if (selectedConstituency) {
                    return query.eq('booths.constituency_id', selectedConstituency);
                } else if (selectedDistrict) {
                    return query.eq('booths.constituencies.district_id', selectedDistrict);
                }
                return query;
            };

            const runCountQuery = async (filterFn) => {
                let query = supabase.from('voters').select('booths!inner(constituency_id, constituencies!inner(district_id))', { count: 'exact', head: true });

                query = applyFilters(query);
                if (filterFn) query = filterFn(query);

                const { count, error } = await query;
                if (error) throw error;
                return count;
            };

            const [total, male, female, active, deleted, shifted, death, gulf, out_of_place, duplicate] = await Promise.all([
                runCountQuery(),
                runCountQuery(q => q.or('gender.ilike.male,gender.eq.പുരുഷൻ,gender.eq.M')),
                runCountQuery(q => q.or('gender.ilike.female,gender.eq.സ്ത്രീ,gender.eq.F')),
                runCountQuery(q => q.eq('status', 'active')),
                runCountQuery(q => q.eq('status', 'deleted')),
                runCountQuery(q => q.eq('status', 'shifted')),
                runCountQuery(q => q.eq('status', 'death')),
                runCountQuery(q => q.eq('status', 'gulf')),
                runCountQuery(q => q.eq('status', 'out_of_place')),
                runCountQuery(q => q.eq('status', 'duplicate'))
            ]);

            setStats({
                total: total || 0,
                male: male || 0,
                female: female || 0,
                active: active || 0,
                deleted: deleted || 0,
                shifted: shifted || 0,
                death: death || 0,
                gulf: gulf || 0,
                out_of_place: out_of_place || 0,
                duplicate: duplicate || 0
            });

        } catch (error) {
            console.error('Error fetching stats:', error.message);
        } finally {
            setLoading(false);
        }
    }

    // Fetch all voters for analysis (family / religion)
    async function fetchAllVotersForAnalysis() {
        if (!selectedBooth) return null;
        let all = [], from = 0;
        while (true) {
            const { data } = await supabase
                .from('voters').select('id,sl_no,name,guardian_name,house_no,house_name,age,gender,has_voted,status')
                .eq('booth_id', selectedBooth).eq('status', 'active')
                .range(from, from + 999);
            if (!data || data.length === 0) break;
            all = [...all, ...data];
            if (data.length < 1000) break;
            from += 1000;
        }
        return all;
    }

    async function runFamilyAnalysis() {
        setAnalysisLoading(true);
        try {
            const voters = await fetchAllVotersForAnalysis();
            if (!voters) return;
            const map = new Map();
            for (const v of voters) {
                // Key: normalize house_no + house_name
                const hno = (v.house_no || '').trim().toLowerCase();
                const hname = (v.house_name || '').trim().toLowerCase();
                const key = hno && hname ? `${hno}||${hname}` : hno ? `no:${hno}` : hname ? `name:${hname}` : `guardian:${(v.guardian_name||'unknown').trim().toLowerCase()}`;
                if (!map.has(key)) map.set(key, { house_no: v.house_no, house_name: v.house_name, members: [] });
                map.get(key).members.push(v);
            }
            const groups = [...map.values()]
                .filter(g => g.members.length > 0)
                .sort((a, b) => b.members.length - a.members.length);
            setFamilyGroups(groups);
        } finally {
            setAnalysisLoading(false);
        }
    }

    async function runReligionAnalysis() {
        setAnalysisLoading(true);
        try {
            const voters = await fetchAllVotersForAnalysis();
            if (!voters) return;
            const groups = { Hindu: [], Muslim: [], Christian: [], Other: [] };
            for (const v of voters) {
                const r = detectReligion(v.name);
                groups[r].push(v);
            }
            setReligionGroups(groups);
        } finally {
            setAnalysisLoading(false);
        }
    }

    function handleTabChange(tab) {
        setActiveTab(tab);
        if (tab === 'family' && !familyGroups) runFamilyAnalysis();
        if (tab === 'religion' && !religionGroups) runReligionAnalysis();
    }

    // Reset analysis when booth changes
    useEffect(() => { setFamilyGroups(null); setReligionGroups(null); }, [selectedBooth]);

    function printAnalysis(type) {
        const booth = booths.find(b => b.id === selectedBooth);
        const boothLabel = booth ? `${booth.booth_no} - ${booth.name}` : '';
        const now = new Date().toLocaleString('en-IN');
        let bodyHtml = '';

        if (type === 'family' && familyGroups) {
            const rows = familyGroups.map((g, i) => {
                const voted = g.members.filter(m => m.has_voted).length;
                const memberRows = g.members.map(m =>
                    `<tr><td style="padding:4px 8px;border:1px solid #ddd">${m.sl_no}</td><td style="padding:4px 8px;border:1px solid #ddd">${m.name}</td><td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${m.gender||''}</td><td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${m.age||''}</td><td style="padding:4px 8px;border:1px solid #ddd;text-align:center;color:${m.has_voted?'#16a34a':'#dc2626'}">${m.has_voted?'✓ Voted':'Pending'}</td></tr>`
                ).join('');
                return `<div style="margin-bottom:12px;page-break-inside:avoid">
                    <div style="background:#1a1a2e;color:white;padding:6px 10px;font-size:12px;font-weight:700">
                        ${i+1}. ${g.house_no ? `No: ${g.house_no}` : ''} ${g.house_name || ''} &nbsp;|&nbsp; ${g.members.length} members &nbsp;|&nbsp; Voted: ${voted}
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:11px">
                        <thead><tr style="background:#f0f4ff"><th style="padding:4px 8px;border:1px solid #ddd">Sl</th><th style="padding:4px 8px;border:1px solid #ddd">Name</th><th style="padding:4px 8px;border:1px solid #ddd">Gender</th><th style="padding:4px 8px;border:1px solid #ddd">Age</th><th style="padding:4px 8px;border:1px solid #ddd">Status</th></tr></thead>
                        <tbody>${memberRows}</tbody>
                    </table></div>`;
            }).join('');
            bodyHtml = `<h3 style="margin:0 0 12px">Family-wise Grouping — ${familyGroups.length} families, ${familyGroups.reduce((s,g)=>s+g.members.length,0)} voters</h3>${rows}`;
        } else if (type === 'religion' && religionGroups) {
            const colors = { Hindu: '#f97316', Muslim: '#10b981', Christian: '#3b82f6', Other: '#6b7280' };
            bodyHtml = Object.entries(religionGroups).map(([rel, voters]) => {
                if (!voters.length) return '';
                const voted = voters.filter(v => v.has_voted).length;
                const rows = voters.map(v =>
                    `<tr><td style="padding:4px 8px;border:1px solid #ddd">${v.sl_no}</td><td style="padding:4px 8px;border:1px solid #ddd;font-weight:600">${v.name}</td><td style="padding:4px 8px;border:1px solid #ddd">${v.guardian_name||''}</td><td style="padding:4px 8px;border:1px solid #ddd;text-align:center;color:${v.has_voted?'#16a34a':'#dc2626'}">${v.has_voted?'✓ Voted':'Pending'}</td></tr>`
                ).join('');
                return `<div style="margin-bottom:16px;page-break-inside:avoid">
                    <div style="background:${colors[rel]};color:white;padding:8px 12px;font-size:13px;font-weight:700">
                        ${rel} — ${voters.length} voters &nbsp;|&nbsp; Voted: ${voted} &nbsp;|&nbsp; Pending: ${voters.length-voted}
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:11px">
                        <thead><tr style="background:#f8fafc"><th style="padding:4px 8px;border:1px solid #ddd">Sl</th><th style="padding:4px 8px;border:1px solid #ddd">Name</th><th style="padding:4px 8px;border:1px solid #ddd">Guardian</th><th style="padding:4px 8px;border:1px solid #ddd">Status</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table></div>`;
            }).join('');
            bodyHtml = `<h3 style="margin:0 0 12px">Religion-wise Report (AI Detected) — ${Object.values(religionGroups).reduce((s,v)=>s+v.length,0)} voters</h3>${bodyHtml}`;
        }

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report</title>
        <style>body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#111;font-size:12px}
        .header{border-bottom:3px solid #1a1a2e;padding-bottom:10px;margin-bottom:14px}
        @media print{@page{margin:12mm;size:A4}}</style></head><body>
        <div class="header"><div style="font-size:18px;font-weight:800">എന്റെ വോട്ട് — My Vote</div>
        <div style="color:#555;font-size:12px">Booth: ${boothLabel} &nbsp;·&nbsp; ${now}</div></div>
        ${bodyHtml}
        <div style="margin-top:24px;border-top:1px solid #ddd;padding-top:8px;font-size:11px;color:#888;text-align:center">Generated by എന്റെ വോട്ട് · ${now}</div>
        </body></html>`;
        const win = window.open('','_blank','width=900,height=700');
        win.document.write(html); win.document.close(); win.focus();
        setTimeout(()=>win.print(), 500);
    }

    return (
        <>
            <div className="container">
                <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>റിപ്പോർട്ടുകൾ</h2>

                {!isBoothMember && <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
                    <div className="form-group">
                        <label className="label">ജില്ല</label>
                        <select
                            className="input"
                            value={selectedDistrict}
                            onChange={e => {
                                setSelectedDistrict(e.target.value);
                                setSelectedConstituency('');
                                setSelectedBooth('');
                            }}
                            disabled={isWardMember}
                        >
                            <option value="">-- എല്ലാം --</option>
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
                            onChange={e => {
                                setSelectedConstituency(e.target.value);
                                setSelectedBooth('');
                            }}
                            disabled={!selectedDistrict || isWardMember}
                        >
                            <option value="">-- എല്ലാം --</option>
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
                            disabled={!selectedConstituency}
                        >
                            <option value="">-- എല്ലാം --</option>
                            {booths.map(b => (
                                <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>}

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', borderBottom: '2px solid #eee', paddingBottom: '0' }}>
                    {[
                        { id: 'stats', label: '📊 സ്ഥിതി വിവരം' },
                        { id: 'family', label: '🏠 കുടുംബ ഗ്രൂപ്പ്' },
                        { id: 'religion', label: '🕌 മത ഗ്രൂപ്പ്' },
                    ].map(t => (
                        <button key={t.id} onClick={() => handleTabChange(t.id)}
                            style={{ padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t.id ? '700' : '400', color: activeTab === t.id ? 'var(--primary)' : '#666', borderBottom: activeTab === t.id ? '3px solid var(--primary)' : '3px solid transparent', fontSize: '0.9rem', marginBottom: '-2px', transition: 'all 0.2s' }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'stats' && loading ? <LoadingSpinner /> : activeTab === 'stats' && (
                    <div className="grid grid-4">
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--primary)' }}>
                            <div style={{ padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '50%', color: 'var(--primary)' }}>
                                <Users size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Voters</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #3b82f6' }}>
                            <div style={{ padding: '0.75rem', background: '#dbeafe', borderRadius: '50%', color: '#3b82f6' }}>
                                <Users size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Male</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.male}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ec4899' }}>
                            <div style={{ padding: '0.75rem', background: '#fce7f3', borderRadius: '50%', color: '#ec4899' }}>
                                <Users size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Female</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.female}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ padding: '0.75rem', background: '#d1fae5', borderRadius: '50%', color: '#10b981' }}>
                                <UserCheck size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Active</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.active}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '50%', color: '#f59e0b' }}>
                                <UserMinus size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Shifted</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.shifted}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: '50%', color: '#ef4444' }}>
                                <UserX size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Deleted</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.deleted}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #6366f1' }}>
                            <div style={{ padding: '0.75rem', background: '#e0e7ff', borderRadius: '50%', color: '#6366f1' }}>
                                <Ban size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Death</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.death}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #8b5cf6' }}>
                            <div style={{ padding: '0.75rem', background: '#ede9fe', borderRadius: '50%', color: '#8b5cf6' }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Gulf</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.gulf}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ec4899' }}>
                            <div style={{ padding: '0.75rem', background: '#fce7f3', borderRadius: '50%', color: '#ec4899' }}>
                                <HelpCircle size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Out of Place</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.out_of_place}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #14b8a6' }}>
                            <div style={{ padding: '0.75rem', background: '#ccfbf1', borderRadius: '50%', color: '#14b8a6' }}>
                                <Copy size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Duplicate</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.duplicate}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Family grouping tab ── */}
                {activeTab === 'family' && (
                    <div>
                        {!selectedBooth ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                കുടുംബ ഗ്രൂപ്പ് കാണുന്നതിന് ഒരു ബൂത്ത് തിരഞ്ഞെടുക്കുക
                            </div>
                        ) : analysisLoading ? <LoadingSpinner /> : familyGroups && (
                            <>
                                {/* Summary bar */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {[
                                            { label: 'ആകെ കുടുംബങ്ങൾ', val: familyGroups.length, color: '#6366f1' },
                                            { label: 'ആകെ വോട്ടർമാർ', val: familyGroups.reduce((s,g)=>s+g.members.length,0), color: '#3b82f6' },
                                            { label: 'ഏറ്റവും വലിയ കുടുംബം', val: familyGroups[0]?.members.length || 0, color: '#f59e0b' },
                                        ].map(s => (
                                            <div key={s.label} className="card" style={{ padding: '10px 18px', borderLeft: `4px solid ${s.color}`, minWidth: '140px' }}>
                                                <div style={{ fontSize: '0.8rem', color: '#666' }}>{s.label}</div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: s.color }}>{s.val}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => printAnalysis('family')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Printer size={16} /> Print
                                    </button>
                                </div>
                                {/* Family cards */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {familyGroups.map((g, i) => {
                                        const voted = g.members.filter(m => m.has_voted).length;
                                        const pct = ((voted / g.members.length) * 100).toFixed(0);
                                        const isOpen = expandedFamily === i;
                                        return (
                                            <div key={i} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                                                <div onClick={() => setExpandedFamily(isOpen ? null : i)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', background: isOpen ? '#f0f4ff' : '#fff' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.9rem', flexShrink: 0 }}>{i+1}</div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: '700', color: '#1a1a2e', fontSize: '0.95rem' }}>
                                                            {g.house_no ? `No: ${g.house_no}` : ''} {g.house_name || 'വിലാസം അജ്ഞാതം'}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{g.members.length} members · Voted: {voted} · Pending: {g.members.length - voted}</div>
                                                    </div>
                                                    {/* Progress bar */}
                                                    <div style={{ width: '80px' }}>
                                                        <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${pct}%`, background: pct > 60 ? '#10b981' : pct > 30 ? '#f59e0b' : '#ef4444', height: '100%' }} />
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center', marginTop: '2px' }}>{pct}%</div>
                                                    </div>
                                                    {isOpen ? <ChevronUp size={18} color="#888" /> : <ChevronDown size={18} color="#888" />}
                                                </div>
                                                {isOpen && (
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f8fafc' }}>
                                                                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555', fontWeight: '600', borderTop: '1px solid #eee' }}>Sl</th>
                                                                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555', fontWeight: '600', borderTop: '1px solid #eee' }}>Name</th>
                                                                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#555', fontWeight: '600', borderTop: '1px solid #eee' }}>Gender</th>
                                                                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#555', fontWeight: '600', borderTop: '1px solid #eee' }}>Age</th>
                                                                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#555', fontWeight: '600', borderTop: '1px solid #eee' }}>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {g.members.map((m, j) => (
                                                                <tr key={m.id} style={{ background: j % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                                    <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', color: '#888' }}>{m.sl_no}</td>
                                                                    <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', fontWeight: '600' }}>{m.name}</td>
                                                                    <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', textAlign: 'center', color: '#555' }}>{m.gender || '-'}</td>
                                                                    <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>{m.age || '-'}</td>
                                                                    <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                                                                        <span style={{ background: m.has_voted ? '#d1fae5' : '#fee2e2', color: m.has_voted ? '#065f46' : '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '600' }}>
                                                                            {m.has_voted ? '✓ Voted' : 'Pending'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── Religion-wise tab ── */}
                {activeTab === 'religion' && (
                    <div>
                        {!selectedBooth ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                മത ഗ്രൂപ്പ് കാണുന്നതിന് ഒരു ബൂത്ത് തിരഞ്ഞെടുക്കുക
                            </div>
                        ) : analysisLoading ? <LoadingSpinner /> : religionGroups && (
                            <>
                                {/* Summary tiles */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {[
                                            { rel: 'Hindu',    color: '#f97316', bg: '#fff7ed', emoji: '🕉️' },
                                            { rel: 'Muslim',   color: '#10b981', bg: '#ecfdf5', emoji: '☪️' },
                                            { rel: 'Christian',color: '#3b82f6', bg: '#eff6ff', emoji: '✝️' },
                                            { rel: 'Other',    color: '#6b7280', bg: '#f9fafb', emoji: '🔵' },
                                        ].map(({ rel, color, bg, emoji }) => {
                                            const vs = religionGroups[rel] || [];
                                            const voted = vs.filter(v => v.has_voted).length;
                                            return (
                                                <div key={rel} className="card" style={{ padding: '14px 20px', borderLeft: `4px solid ${color}`, background: bg, minWidth: '150px' }}>
                                                    <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{emoji}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{rel}</div>
                                                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color }}>{vs.length}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#888' }}>Voted: {voted} | Pending: {vs.length - voted}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>⚠️ AI detection — approximate</div>
                                        <button onClick={() => printAnalysis('religion')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Printer size={16} /> Print
                                        </button>
                                    </div>
                                </div>
                                {/* Religion sections */}
                                {[
                                    { rel: 'Hindu',    color: '#f97316', bg: '#fff7ed', emoji: '🕉️' },
                                    { rel: 'Muslim',   color: '#10b981', bg: '#ecfdf5', emoji: '☪️' },
                                    { rel: 'Christian',color: '#3b82f6', bg: '#eff6ff', emoji: '✝️' },
                                    { rel: 'Other',    color: '#6b7280', bg: '#f9fafb', emoji: '🔵' },
                                ].map(({ rel, color, bg, emoji }) => {
                                    const vs = religionGroups[rel] || [];
                                    if (!vs.length) return null;
                                    const voted = vs.filter(v => v.has_voted).length;
                                    const isOpen = expandedFamily === rel;
                                    return (
                                        <div key={rel} className="card" style={{ marginBottom: '10px', padding: 0, overflow: 'hidden', border: `1px solid ${color}33` }}>
                                            <div onClick={() => setExpandedFamily(isOpen ? null : rel)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', cursor: 'pointer', background: isOpen ? bg : '#fff' }}>
                                                <span style={{ fontSize: '1.5rem' }}>{emoji}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '800', fontSize: '1rem', color }}>{rel}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{vs.length} voters · Voted: {voted} · Pending: {vs.length - voted} · {((voted/vs.length)*100).toFixed(1)}%</div>
                                                </div>
                                                <div style={{ width: '100px' }}>
                                                    <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${(voted/vs.length*100).toFixed(0)}%`, background: color, height: '100%' }} />
                                                    </div>
                                                </div>
                                                {isOpen ? <ChevronUp size={18} color="#888" /> : <ChevronDown size={18} color="#888" />}
                                            </div>
                                            {isOpen && (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                    <thead>
                                                        <tr style={{ background: bg }}>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555', borderTop: '1px solid #eee' }}>Sl</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555', borderTop: '1px solid #eee' }}>Name</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555', borderTop: '1px solid #eee' }}>Guardian</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', color: '#555', borderTop: '1px solid #eee' }}>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {vs.map((v, j) => (
                                                            <tr key={v.id} style={{ background: j % 2 === 0 ? '#fff' : bg }}>
                                                                <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', color: '#888' }}>{v.sl_no}</td>
                                                                <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', fontWeight: '600' }}>{v.name}</td>
                                                                <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', color: '#555' }}>{v.guardian_name || '-'}</td>
                                                                <td style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                                                                    <span style={{ background: v.has_voted ? '#d1fae5' : '#fee2e2', color: v.has_voted ? '#065f46' : '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '600' }}>
                                                                        {v.has_voted ? '✓ Voted' : 'Pending'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                )}
            </div>
            <button
                onClick={handleScrollAction}
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 100,
                    transition: 'transform 0.2s'
                }}
                title={isAtTop ? "Go to Bottom" : "Go to Top"}
            >
                {isAtTop ? <ArrowDown size={24} /> : <ArrowUp size={24} />}
            </button>
        </>
    );
}
