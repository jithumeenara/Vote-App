import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { ArrowUp, ArrowDown, Users, UserCheck, UserX, UserMinus, AlertTriangle, Ban, HelpCircle, Copy, Home, Moon, Star, Sparkles, ChevronDown, ChevronUp, Printer } from 'lucide-react';

// ── Religion auto-detection (Kerala name patterns) ─────────────────────────
// Strategy: word-by-word scoring (not substring) to avoid false positives.
// Supports both Malayalam script and Manglish/English.
// Based on: "Kerala Malayalam Name Grouping by Religion using AI" spec.

// Step 1: Normalize spelling variants → canonical form
function normalizeName(raw) {
    let n = (raw || '').toUpperCase().trim();
    // Common Muslim name spelling variants → canonical
    n = n.replace(/\bMOHAMMAD\b|\bMOHAMMED\b|\bMUHAMMAD\b|\bMOHD\.?\b|\bMD\.?\b/g, 'MUHAMMED');
    n = n.replace(/\bAHAMED\b|\bAHAMMED\b/g, 'MUHAMMED');
    n = n.replace(/\bABDULLA\b|\bABDULLAH\b/g, 'ABDUL');
    n = n.replace(/\bHUSSAIN\b|\bHUSAIN\b/g, 'HASSAN');
    n = n.replace(/\bFATIMA\b|\bFATHEMA\b|\bFAHEEMA\b/g, 'FATHIMA');
    n = n.replace(/\bAISHA\b|\bAYSHA\b/g, 'AYISHA');
    n = n.replace(/\bMARYAM\b/g, 'MARIYAM');
    n = n.replace(/\bMATTHEW\b/g, 'MATHEW');
    n = n.replace(/\bJOSEPH\b/g, 'JOSE');
    n = n.replace(/\bGEORGE\b/g, 'GEORGE');
    // Remove house identifiers (BHAVAN, MANZIL, VILLA, HOUSE, NIVAS)
    n = n.replace(/\b(BHAVAN|MANZIL|VILLA|HOUSE|NIVAS|ILLAM|VEEDU)\b/g, '');
    return n.trim();
}

// Step 2: Word dictionaries (exact word match after split)
// ── Malayalam script words (stored as-is in DB) ──
const ML_MUSLIM = new Set([
    'മുഹമ്മദ്','മുഹമ്മദ','മൊഹമ്മദ്','അബ്ദുൽ','അബ്ദുൾ','അബ്ദുല്ല',
    'ഫാത്തിമ','ഫാത്തിമ്മ','ഫാത്തിമ','ഫഹീമ','ആഇഷ','ആയിഷ',
    'മർയം','മര്‍യം','ഹസൻ','ഹസ്സൻ','ഹുസൈൻ','ഹുസൈൻ',
    'ഷാഫി','ശാഫി','ഷഫീക്','ഷഹ്‌ദ','ഷഹ്ദ',
    'റഹ്മാൻ','റഹ്മ്മാൻ','അൻസാർ','ഇസ്മാഈൽ','ഇബ്രാഹീം',
    'ഷൈഖ്','സയ്യിദ്','നൗഷാദ്','നൗഷദ്','റഷീദ്','ബഷീർ','ഖദീജ',
    'ഇബ്നു','ഉമർ','ഉസ്മാൻ','ഹകീം','ഹമീദ്','ജലീൽ','ഷിഹാബ്',
    'മൊയ്ദീൻ','മൊഹിദ്ദീൻ','കോയ','ഹാജി','മുസ്തഫ','ഉനൈസ്',
    'സുലൈഖ','സുബൈദ','ഹാഫ്‌സ','സഫിയ','ഷഹാന','ബീവി','ബീഫ',
    'ഷഹ്‌ജഹാൻ','സാജഹാൻ','ഷംസ','ഷംഷ','നജ്മ','സ്വലീഹ്','ഉൻസ',
    'ഫൈസൽ','ഫൈസ്','നൗഫൽ','ലുഖ്മാൻ','മൂസ','ഈസ',
]);
const ML_CHRISTIAN = new Set([
    'തോമസ്','ജോർജ്','ജോസ്','ജോണ്‍','ജോൺ','പോൾ','പോൾ',
    'മത്തായി','ഫിലിപ്പ്','സ്റ്റീഫൻ','അബ്രഹാം','ഫ്രാൻസിസ്','സെബാസ്റ്റ്യൻ',
    'ലോറൻസ്','വിൻസന്റ്','ഓഗസ്‌റ്റിൻ','ആഗസ്റ്റിൻ',
    'മറിയ','മറിയം','മേരി','ആൻ','ആന്ന','അന്ന','ആന്നക്കുട്ടി',
    'ഏലിസബത്ത്','ഏലിസ','ഏലിയ','ഏലിഷ',
    'വർഗ്ഗീസ്','വർഗ്ഗീസ','ചാക്കോ','ഒമ്മൻ','ഏ.ഒ.','കുര്യൻ','കുര്യാക്കോസ്',
    'ഈഫൻ','ഈപ്പൻ','കൊച്ചുമോൻ','കൊച്ചുതൊമ്മൻ','ഉഷ','ആൻസി',
    'ടെസ്സി','സെലിൻ','ലിസ്സി','ലിസി','ലൈലി','അഞ്ചലി',
    'ബിജു','ഷിബു','സബി','ജോബി','ബോബി','ബിനോ','ബിജോ',
    'ബെന്നി','ബേബി','ഗ്ലാഡ്സ്','ഗ്ലാഡ്‌സ്','ഗ്ലോറി','ലൂസ്',
    'ഷൈജോ','ഷൈനോ','ഷൈജി','ഷൈബു',
]);
const ML_HINDU = new Set([
    'നായർ','നായര്','മേനോൻ','മേനോന്','പിള്ള','കുറുപ്പ്','കുറുപ്',
    'പണിക്കർ','വാര്യർ','നമ്പൂതിരി','നമ്പ്യാർ','ഏഴവൻ','തിയ്യൻ',
    'കൃഷ്ണൻ','കൃഷ്ണ','ഗോപൻ','ഗോപ','ഗോവിന്ദൻ','ദേവൻ','ദേവൻ',
    'ദേവി','ദേവ','ലക്ഷ്മി','ലക്ഷ്‌മി','ശ്രീദേവി','ഭദ്ര','ദുർഗ',
    'ശിവൻ','ശിവ','ശിവദേവ്','ഹരി','ഹരി','കുമാർ','സുരേഷ്',
    'രമേശ്','മോഹൻ','വിജയൻ','ദാമോദരൻ','മുരളീധരൻ','ഉണ്ണി',
    'ഉണ്ണികൃഷ്ണൻ','ഹരികൃഷ്ണൻ','ബാലകൃഷ്ണൻ','ബാലൻ',
    'ഗൗരി','ഗൗര','കല്യാണി','കമലം','ശാരദ','ശ്യാമ','ശ്യാമ',
    'കൗസ്ത്യ','ഗീത','ഗീതൻ','ഗൗരി','ജ്യോതി','ജ്യോതി',
    'സുമതി','ലീല','മല്ലിക','ബിന്ദു','ഇന്ദിര','ഇന്ദ്ര',
    'രാധ','സീത','ഉഷ','ഉഷ','ഉദ്ദ','ഉഷ','ഇന്ദ്ര',
    'അമ്മ','അമ്മിണി','ചിന്ത','ചിത്ര','ലത','ലത',
    'വേണു','ബേബി','ദിവ്യ','ദിവ്യ','ദിലീപ്','അനിൽ','അനിൽ',
    'ബിനു','ബിനി','ബിന','ശ്രീ','ഷൈൻ','ഷൈൻ',
    'ഓമന','ഓമന','ത്രേസ്യ','ക്ഷേ','ക്ഷേമ','ക്ഷ',
]);

// ── English/Manglish word sets ──
const EN_MUSLIM = new Set([
    'MUHAMMED','MOHAMMED','MOHAMAD','AHAMMED','AHAMED',
    'ABDUL','ABDU','ABDUR','ABUBAKR','ABUBAKAR',
    'HASSAN','HASAN','HUSSAIN','HUSAIN',
    'FATHIMA','FATIMA','FAHEEMA',
    'AYISHA','AISHA','AYSHA',
    'ZAINAB','ZAINABA','HAFSATH','HAFSA',
    'MARIYAM','MARYAM','SHAHANA','SHAFEEQA',
    'SAFIYA','SAFIA','NAJMA','NAJEEBA',
    'NOUSHAD','NOWSHAD','NAUSHAD',
    'RASHEED','RASHID','ASLAM','ANSAR','ANSARI',
    'SIRAJ','SEERAJ','BASHEER','BASHIR',
    'KABEER','KABIR','SALIM','SALEEM',
    'RAHIM','RAHEEM','JALEEL','JALIL',
    'HAMEED','HAMID','WAHEED','WAHID',
    'MAJEED','MAJID','HAKEEM','HAKIM',
    'ISMAIL','ISMAEEL','IBRAHIM','IBRAHEEM',
    'YUSUF','YOOSUF','USMAN','UTHMAN',
    'SIDDIQUE','SIDDIQUI','SIDHEEK',
    'SHAREEF','SHARIF','SHERIF',
    'KOYA','HAJI','HAJEE',
    'SHAFI','SHAFEE','SHAFIQ','SHAFEEQ',
    'NIZAR','NISAR','FEROZ','FEROOS',
    'RAFEEQ','RAFIQ','RAFEEQUE',
    'MUSTHAFA','MUSTAFA','RAHMAN','REHMAN',
    'RIYAZ','RIYAS','SWALIH','SALAH',
    'TAHIR','TARIQ','THARIQ','ZAKARIYA',
    'MUNEER','MUNIR','AFSAL','AFZAL','ASHRAF',
    'SHIHAB','MOIDEEN','MOIDU',
    'UMMER','UMAR','OMAR','IBNU',
    'AYUB','AYYUB','SHABEER','JABIR','JABEER',
    'JASIM','JASSIM','LUKMAN','LUQMAN',
    'NAUFAL','NAWFAL','SHABANA','RUKHSANA',
    'RAZIYA','RABIYA','SULFIKAR','SULFIKKAR',
    'SULEKHA','SUBAIDA','SUMAYYA',
    'THASNEEM','THASNI','UNAIS','UNAIZ',
    'VAZEER','VAZIR','ZUBAIR','ZUBEAR',
    'BEEVI','BEEVY','KUNHI','MANZOOR','MANAF',
    'FAIZAL','FAISAL','FAIZ','SAINUL','SAINUDHEEN',
    'SHAJAHAN','SHAJAH','SAMEER','SAMIR',
    'SHANAWAZ','SHANAVAS','ROSHAN','ROSHNA',
]);
const EN_CHRISTIAN = new Set([
    'THOMAS','GEORGE','JOHN','JOSE','JOSEPH',
    'PAUL','PETER','MATHEW','MATTHEW',
    'PHILIP','STEPHEN','ALEX','ABRAHAM',
    'AUGUSTINE','XAVIER','FRANCIS',
    'ANTONY','ANTHONY','SEBASTIAN','LAWRENCE',
    'VINCENT','BIJU','SHIBU',
    'MARY','MARIAM','MARIAMMA','ANNAMMA',
    'ALEYAMMA','KUNJUMOL','MOLLY',
    'TESSY','CELINE','LISY','LISSY','LIZY',
    'ANCY','SHALY','SHEELA',
    'VARGHESE','MATHEW','CHACKO','KUTTAPPAN',
    'THARAKAN','MUNDADAN','PANICKAR',
    'KURIAKOSE','CYRIAC','CYRIL',
    'EAPEN','EIPEN','ELIAS','ELISHA',
    'ELIZABATH','ELIZABETHA','ELSAMMA',
    'OMMEN','OOMMEN','THANKAMMA','ROSAMMA',
    'ANNAKUTTY','MARYKUTTY','KUNJAMMA',
    'SABY','SABU','SAJIMON','SAJI','SAJU',
    'SOMY','SOBY','SOBIN','SOJAN',
    'SHIJO','SHINO','SHINU','SHIJU','SHYJO',
    'ABY','ABIN','GIBY','GIGI','GIGIN',
    'GIJO','GIJOY','BENNY','BENO','BENOJ',
    'BIBIN','BIBY','BIJO','BIJI','BINIL',
    'BINOY','BINU','BOBY','BOBBY','BOBIN','BOBAN',
    'CHRISTY','CHRISTU','CHRISTO','CIJO','CINU',
    'DIJO','DIJI','DIBIN','DIBY','DINIL',
    'TIJO','TIJU','TIBIN','TIBY','TINIL',
    'ROSHAN','ROSHNI','LIGI','LIGY','LIBIN',
    'LIBU','LINIL','LINOY','LINTO','LIJU',
    'BABY','JOBY','JOJI','JOJO','JOMOL',
    'JOMON','JOBIN','JOBY','JOBIL',
]);
const EN_HINDU = new Set([
    'NAIR','MENON','PILLAI','KURUP','PANIKKAR',
    'WARRIER','NAMBOOTHIRI','NAMBIAR','NAMBOODIRI',
    'POTHUVAL','EZHAVA','THIYYA','PANICKER',
    'KRISHNAN','KRISHNA','MURALEEDHARAN',
    'GOPINATHAN','GOPALAN','DAMODARAN',
    'BALAKRISHNAN','NARAYANAN','SIVASANKARAN',
    'SUBRAHMANYAM','DEVI','LAKSHMI','LEKHA',
    'GEETHA','RADHA','SEETHA','SUMATHI',
    'LEELA','MALLIKA','BINDHU','SREEDEVI',
    'SREEKUMAR','UNNIKRISHNAN','HARIKRISHNAN',
    'VIJAYAN','MOHANAN','CHANDRAN','PADMANABHAN',
    'VENUGOPAL','RAJENDRAN','BALAN','RAJAN',
    'MOHAN','MURALI','SIVAN','SHANKAR','SHANKARAN',
    'GOPALAKRISHNAN','SATHEESH','SATHEESHAN',
    'RAVEENDRAN','RAJENDRAN','RAJESH','SURESH',
    'RAMESH','DINESH','MAHESH','GANESH',
    'KAVITHA','PARVATHY','INDIRA','AMBIKA',
    'SAROJAM','KALYANI','KAMALAM','AMMINI',
    'OMANA','THANKAM','THANKAMANI','SARADHA',
    'USHA','GIRIJA','GIRISH','GIREESH',
    'ARAVIND','ARJUN','AJITH','PRAVEEN','PRADEEP',
    'PRAVEENA','PRIYA','DIVYA','DEEPA','DEEPTHI',
    'ANJU','ASHA','REKHA','REMA','RAJI',
]);

// Step 3: Suffix/prefix patterns for compound words
const MUSLIM_SUFFIX = ['BEEVI','BEEVY','KUTTY','KUNHI','KABEER','RAHEEM','RAHIMAN','UTHMAN'];
const CHRISTIAN_SUFFIX = ['AMMA','KUTTY','ACHAN','APPAN'];
const HINDU_SUFFIX = ['KUMAR','KRISHNAN','KRISHNA','DEVI','LEKHA','NAIR','MENON','WARRIER','PILLAI','KURUP','RAJAN','MOHAN','CHANDRAN','VIJAYAN','BALAN'];
const HINDU_PREFIX = ['SREE','SRI','HARI','GIRI','MURA','VENU','RAMA','PARA','SIVA','DAMO'];

// Step 4: Classify with word-by-word scoring
function detectReligion(name) {
    if (!name) return 'Other';
    const score = { Hindu: 0.5, Muslim: 0, Christian: 0 }; // 0.5 Hindu default (Kerala baseline)

    // Check Malayalam script tokens (exact word match)
    const mlWords = name.split(/[\s,./]+/).filter(Boolean);
    for (const w of mlWords) {
        if (ML_MUSLIM.has(w))    { score.Muslim    += 3; continue; }
        if (ML_CHRISTIAN.has(w)) { score.Christian += 3; continue; }
        if (ML_HINDU.has(w))     { score.Hindu     += 3; continue; }
    }

    // Check Manglish/English tokens (normalize first, then word match)
    const normalized = normalizeName(name);
    const enWords = normalized.split(/[\s,./]+/).filter(w => w.length > 1 && !/^[A-Z]$/.test(w)); // skip single initials
    for (const w of enWords) {
        if (EN_MUSLIM.has(w))    { score.Muslim    += 3; continue; }
        if (EN_CHRISTIAN.has(w)) { score.Christian += 3; continue; }
        if (EN_HINDU.has(w))     { score.Hindu     += 3; continue; }
        // Suffix matching for compound words (e.g., SREEKUMAR → KUMAR → Hindu)
        for (const s of HINDU_SUFFIX)    { if (w.endsWith(s) && w.length > s.length) { score.Hindu     += 2; break; } }
        for (const s of MUSLIM_SUFFIX)   { if (w.endsWith(s) && w.length > s.length) { score.Muslim    += 2; break; } }
        for (const s of CHRISTIAN_SUFFIX){ if (w.endsWith(s) && w.length > s.length) { score.Christian += 1; break; } }
        for (const s of HINDU_PREFIX)    { if (w.startsWith(s) && w.length > s.length) { score.Hindu   += 2; break; } }
    }

    const max = Math.max(score.Hindu, score.Muslim, score.Christian);
    if (score.Muslim    === max) return 'Muslim';
    if (score.Christian === max) return 'Christian';
    if (score.Hindu     === max && max > 0.5) return 'Hindu';
    return 'Other';
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
