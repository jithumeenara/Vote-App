import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { Search, Save, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

export default function VoteVerification() {
    const { user } = useAuth();
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState('trend'); // Default to 'trend'
    const [districts, setDistricts] = useState([]);
    const [constituencies, setConstituencies] = useState([]);
    const [booths, setBooths] = useState([]);
    const [fronts, setFronts] = useState([]);

    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedConstituency, setSelectedConstituency] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');

    const [voters, setVoters] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [verificationFilter, setVerificationFilter] = useState('all');
    const [voteStatusFilter, setVoteStatusFilter] = useState('all');
    const [isAtTop, setIsAtTop] = useState(true);
    const [reportSubTab, setReportSubTab] = useState('detailed');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalVoters, setTotalVoters] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const isWardMember = user?.role === 'ward_member';

    // Swipe support for tabs
    const TABS = ['trend', 'verification', 'reports'];
    const touchStartX = useRef(null);
    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            const idx = TABS.indexOf(activeTab);
            if (diff > 0 && idx < TABS.length - 1) setActiveTab(TABS[idx + 1]);
            else if (diff < 0 && idx > 0) setActiveTab(TABS[idx - 1]);
        }
        touchStartX.current = null;
    };
    const isBoothMember = user?.role === 'booth_member';

    useEffect(() => {
        if (!isBoothMember) fetchDistricts();
        fetchFronts();

        const handleScroll = () => {
            setIsAtTop(window.scrollY < 100);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleScrollAction = () => {
        if (isAtTop) {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const fetchFronts = async () => {
        const { data } = await supabase.from('fronts').select('*').order('name');
        setFronts(data || []);
    };

    const fetchDistricts = async () => {
        const { data } = await supabase.from('districts').select('*').order('name');
        setDistricts(data || []);
    };

    useEffect(() => {
        if (selectedDistrict) {
            fetchConstituencies(selectedDistrict);
        } else {
            setConstituencies([]);
        }
    }, [selectedDistrict]);

    const fetchConstituencies = async (districtId) => {
        const { data } = await supabase.from('constituencies').select('*').eq('district_id', districtId).order('constituency_no');
        setConstituencies(data || []);
    };

    useEffect(() => {
        if (selectedConstituency) {
            fetchBooths(selectedConstituency);
        } else {
            setBooths([]);
        }
    }, [selectedConstituency]);

    const fetchBooths = async (constituencyId) => {
        const { data } = await supabase.from('booths').select('*').eq('constituency_id', constituencyId).order('booth_no');
        setBooths(data || []);
    };

    useEffect(() => {
        if (isWardMember && user?.ward_id) {
            const fetchConstituencyDetails = async () => {
                const { data } = await supabase.from('constituencies').select('*, districts(*)').eq('id', user.ward_id).single();
                if (data) {
                    setSelectedDistrict(data.district_id);
                    setSelectedConstituency(data.id);
                }
            };
            fetchConstituencyDetails();
        }
    }, [isWardMember, user]);

    // Booth Member Pre-selection
    useEffect(() => {
        if (isBoothMember && user?.booth_id) {
            const fetchBoothDetails = async () => {
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
            };
            fetchBoothDetails();
        }
    }, [isBoothMember, user]);

    useEffect(() => {
        if (selectedBooth) {
            setCurrentPage(1);
            fetchVoters(1);
        } else {
            setVoters([]);
            setTotalVoters(0);
        }
        if (selectedDistrict || (isWardMember && user?.ward_id) || (isBoothMember && selectedBooth)) {
            fetchStats();
        }
    }, [selectedBooth, selectedConstituency, selectedDistrict, activeTab, voteStatusFilter, verificationFilter, searchTerm]);

    // Real-time: re-fetch stats & voters when any voter record changes
    useEffect(() => {
        if (!selectedConstituency && !selectedBooth) return;

        const filter = selectedBooth
            ? `booth_id=eq.${selectedBooth}`
            : undefined;

        const channel = supabase
            .channel(`verification-realtime-${selectedBooth || selectedConstituency}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'voters',
                ...(filter ? { filter } : {})
            }, () => {
                if (selectedBooth) fetchVoters();
                fetchStats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedBooth, selectedConstituency]);

    const fetchVoters = async (page = currentPage, size = pageSize) => {
        if (!selectedBooth) return;
        setLoading(true);
        try {
            const from = (page - 1) * size;
            const to = from + size - 1;

            let query = supabase
                .from('voters')
                .select('*, fronts(name, color)', { count: 'exact' })
                .eq('booth_id', selectedBooth)
                .order('sl_no');

            if (verificationFilter === 'verified') query = query.not('supported_front_id', 'is', null);
            else if (verificationFilter === 'not_verified') query = query.is('supported_front_id', null);
            if (voteStatusFilter === 'voted') query = query.eq('has_voted', true);
            else if (voteStatusFilter === 'not_voted') query = query.eq('has_voted', false);
            if (searchTerm.trim()) {
                const term = searchTerm.trim();
                const isNum = /^\d+$/.test(term);
                const orFilter = isNum
                    ? `name.ilike.%${term}%,id_card_no.ilike.%${term}%,sl_no.eq.${term}`
                    : `name.ilike.%${term}%,id_card_no.ilike.%${term}%`;
                query = query.or(orFilter);
            }

            const { data, error, count } = await query.range(from, to);

            if (error) throw error;
            setVoters(data || []);
            setTotalVoters(count || 0);
        } catch (error) {
            console.error('Error fetching voters:', error);
            addToast('Error fetching voters', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async (forceRun = false) => {
        if (!forceRun && activeTab !== 'trend') return;
        setLoading(true);
        try {
            let bIds = [];
            // Booth member: always scope to their single booth only
            if (isBoothMember && selectedBooth) {
                bIds = [selectedBooth];
            } else if (selectedConstituency) {
                const { data: bData } = await supabase.from('booths').select('id').eq('constituency_id', selectedConstituency);
                bIds = (bData || []).map(b => b.id);
            } else if (selectedBooth) {
                bIds = [selectedBooth];
            } else if (selectedDistrict && !isWardMember) {
                const { data: cData } = await supabase.from('constituencies').select('id').eq('district_id', selectedDistrict);
                const cIds = (cData || []).map(c => c.id);
                const { data: bData } = await supabase.from('booths').select('id').in('constituency_id', cIds);
                bIds = (bData || []).map(b => b.id);
            }

            if (bIds.length === 0) {
                setStats({ total: 0, verified: 0, unverified: 0, fronts: {}, chartData: [] });
                setLoading(false);
                return;
            }

            // Use COUNT queries — reliable, no row limit issues
            const buildBase = () => {
                let q = supabase.from('voters').select('*', { count: 'exact', head: true }).in('booth_id', bIds);
                if (voteStatusFilter === 'voted') q = q.eq('has_voted', true);
                else if (voteStatusFilter === 'not_voted') q = q.eq('has_voted', false);
                return q;
            };

            // Run total + per-front counts in parallel
            const frontCountQueries = fronts.map(f =>
                buildBase().eq('supported_front_id', f.id).then(({ count }) => ({ id: f.id, name: f.name, color: f.color, count: count || 0 }))
            );

            const [totalResult, verifiedResult, ...frontResults] = await Promise.all([
                buildBase(),
                buildBase().not('supported_front_id', 'is', null),
                ...frontCountQueries
            ]);

            if (totalResult.error) throw totalResult.error;

            const total = totalResult.count || 0;
            const verifiedCount = verifiedResult.count || 0;
            const frontCounts = {};

            frontResults.forEach(({ name, color, count }) => {
                if (count > 0) frontCounts[name] = { count, color: color || '#666666' };
            });

            const unverified = total - verifiedCount;
            if (unverified > 0) frontCounts['Unverified'] = { count: unverified, color: '#9ca3af' };

            const chartData = Object.entries(frontCounts).map(([name, d]) => ({
                name, value: d.count, color: d.color
            }));

            setStats({ total, verified: verifiedCount, unverified, fronts: frontCounts, chartData });

        } catch (error) {
            console.error('Error fetching stats:', error);
            addToast('Error fetching trends', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkVoted = async (voterId, hasVoted) => {
        const previousVoters = [...voters];
        setVoters(voters.map(v => v.id === voterId ? { ...v, has_voted: hasVoted } : v));

        try {
            const { error } = await supabase.rpc('update_voter_voted', {
                p_voter_id: voterId,
                p_has_voted: hasVoted
            });

            if (error) throw error;
            addToast(hasVoted ? 'Marked as voted' : 'Marked as not voted', 'success');
            fetchStats(true);
        } catch (error) {
            console.error('Error updating vote status:', error);
            addToast('Failed to update: ' + error.message, 'error');
            setVoters(previousVoters);
        }
    };

    const handleFrontChange = async (voterId, frontId) => {
        const previousVoters = [...voters];
        setVoters(voters.map(v => v.id === voterId ? { ...v, supported_front_id: frontId } : v));

        // Try RPC first, fallback to direct update
        let error = null;

        const rpcResult = await supabase.rpc('update_voter_front', {
            p_voter_id: voterId,
            p_front_id: frontId
        });
        error = rpcResult.error;

        if (error) {
            // Fallback: direct update
            const directResult = await supabase
                .from('voters')
                .update({ supported_front_id: frontId })
                .eq('id', voterId);
            error = directResult.error;
        }

        if (error) {
            console.error('Front update failed:', JSON.stringify(error));
            addToast('Update failed: ' + error.message, 'error');
            setVoters(previousVoters);
        } else {
            addToast('Vote preference updated', 'success');
            fetchStats(true);
        }
    };

    const totalPages = Math.ceil(totalVoters / pageSize);

    const handlePrint = async () => {
        const booth = booths.find(b => b.id === selectedBooth);
        const constituency = constituencies.find(c => c.id === selectedConstituency);
        const district = districts.find(d => d.id === selectedDistrict);
        const boothLabel = booth ? `${booth.booth_no} - ${booth.name}` : '';
        const constituencyLabel = constituency ? `${constituency.constituency_no} - ${constituency.name}` : '';
        const districtLabel = district?.name || '';
        const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // Fetch ALL voters for this booth for the print report (not paginated)
        let allVoters = voters;
        try {
            let allData = [];
            let from = 0;
            const batchSize = 1000;
            while (true) {
                const { data } = await supabase.from('voters').select('*').eq('booth_id', selectedBooth).range(from, from + batchSize - 1);
                if (!data || data.length === 0) break;
                allData = [...allData, ...data];
                if (data.length < batchSize) break;
                from += batchSize;
            }
            allVoters = allData;
        } catch (e) { /* fallback to current page */ }

        const isSummary = reportSubTab === 'summary';
        const title = isSummary ? 'Vote Summary Report' : 'Voted Members - Detailed Report';

        let bodyHtml = '';

        if (isSummary) {
            const rows = fronts.map(front => {
                const supporters = allVoters.filter(v => v.supported_front_id === front.id);
                const voted = supporters.filter(v => v.has_voted).length;
                const notVoted = supporters.length - voted;
                const pct = supporters.length > 0 ? ((voted / supporters.length) * 100).toFixed(1) : '0.0';
                return `<tr>
                    <td style="padding:8px 12px;border:1px solid #ddd;font-weight:600">${front.name}</td>
                    <td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${supporters.length}</td>
                    <td style="padding:8px 12px;border:1px solid #ddd;text-align:center;color:#16a34a;font-weight:700">${voted}</td>
                    <td style="padding:8px 12px;border:1px solid #ddd;text-align:center;color:#dc2626">${notVoted}</td>
                    <td style="padding:8px 12px;border:1px solid #ddd;text-align:center;font-weight:600">${pct}%</td>
                </tr>`;
            }).join('');
            const totalSupp = allVoters.filter(v => v.supported_front_id).length;
            const totalVoted = allVoters.filter(v => v.supported_front_id && v.has_voted).length;
            const totalPending = totalSupp - totalVoted;
            bodyHtml = `
                <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
                    <thead>
                        <tr style="background:#1a1a2e;color:white">
                            <th style="padding:10px 12px;border:1px solid #ddd;text-align:left">മുന്നണി (Front)</th>
                            <th style="padding:10px 12px;border:1px solid #ddd;text-align:center">Total Supporters</th>
                            <th style="padding:10px 12px;border:1px solid #ddd;text-align:center">Voted</th>
                            <th style="padding:10px 12px;border:1px solid #ddd;text-align:center">Not Voted</th>
                            <th style="padding:10px 12px;border:1px solid #ddd;text-align:center">Percentage</th>
                        </tr>
                    </thead>
                    <tbody>${rows}
                        <tr style="background:#f0f4ff;font-weight:700">
                            <td style="padding:10px 12px;border:1px solid #ddd">ആകെ (Total)</td>
                            <td style="padding:10px 12px;border:1px solid #ddd;text-align:center">${totalSupp}</td>
                            <td style="padding:10px 12px;border:1px solid #ddd;text-align:center;color:#16a34a">${totalVoted}</td>
                            <td style="padding:10px 12px;border:1px solid #ddd;text-align:center;color:#dc2626">${totalPending}</td>
                            <td style="padding:10px 12px;border:1px solid #ddd;text-align:center">-</td>
                        </tr>
                    </tbody>
                </table>
                <div style="margin-top:24px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;color:#555">
                    <strong>Summary:</strong> Total Registered Voters: ${allVoters.length} &nbsp;|&nbsp; Total Verified (Front Assigned): ${totalSupp} &nbsp;|&nbsp; Total Voted: ${totalVoted} &nbsp;|&nbsp; Pending: ${allVoters.length - totalVoted}
                </div>`;
        } else {
            bodyHtml = fronts.map(front => {
                const fv = allVoters.filter(v => v.has_voted && v.supported_front_id === front.id);
                if (fv.length === 0) return '';
                const rows = fv.map((v, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="padding:7px 10px;border:1px solid #ddd;text-align:center">${v.sl_no}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd;font-weight:600">${v.name}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd;color:#555">${v.guardian_name || ''}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd;color:#555">${v.house_no ? `${v.house_no} /` : ''} ${v.house_name || ''}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd;text-align:center">${v.age || ''}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd;color:#555;font-size:11px">${v.updated_at ? new Date(v.updated_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '-'}</td>
                </tr>`).join('');
                return `
                    <div style="margin-bottom:20px;page-break-inside:avoid">
                        <h3 style="background:#1a1a2e;color:white;padding:8px 12px;margin:0;font-size:13px;border-radius:4px 4px 0 0">
                            ${front.name} &nbsp;—&nbsp; ${fv.length} voters voted
                        </h3>
                        <table style="width:100%;border-collapse:collapse;font-size:12px">
                            <thead>
                                <tr style="background:#e8eaf6">
                                    <th style="padding:7px 10px;border:1px solid #ddd;text-align:center;width:50px">Sl.No</th>
                                    <th style="padding:7px 10px;border:1px solid #ddd;text-align:left">Name</th>
                                    <th style="padding:7px 10px;border:1px solid #ddd;text-align:left">Guardian</th>
                                    <th style="padding:7px 10px;border:1px solid #ddd;text-align:left">House</th>
                                    <th style="padding:7px 10px;border:1px solid #ddd;text-align:center;width:40px">Age</th>
                                    <th style="padding:7px 10px;border:1px solid #ddd;text-align:center;width:100px">Time</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>`;
            }).join('');
            const noFront = allVoters.filter(v => v.has_voted && !v.supported_front_id);
            if (noFront.length > 0) {
                const rows = noFront.map((v, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="padding:7px 10px;border:1px solid #ddd;text-align:center">${v.sl_no}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd;font-weight:600">${v.name}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd">${v.guardian_name || ''}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd">${v.house_no ? `${v.house_no} /` : ''} ${v.house_name || ''}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd;text-align:center">${v.age || ''}</td>
                    <td style="padding:7px 10px;border:1px solid #ddd;font-size:11px">${v.updated_at ? new Date(v.updated_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '-'}</td>
                </tr>`).join('');
                bodyHtml += `<div style="margin-bottom:20px;page-break-inside:avoid">
                    <h3 style="background:#6b7280;color:white;padding:8px 12px;margin:0;font-size:13px;border-radius:4px 4px 0 0">Unverified (No Front) — ${noFront.length} voters</h3>
                    <table style="width:100%;border-collapse:collapse;font-size:12px">
                        <thead><tr style="background:#f1f5f9">
                            <th style="padding:7px 10px;border:1px solid #ddd;text-align:center;width:50px">Sl.No</th>
                            <th style="padding:7px 10px;border:1px solid #ddd;text-align:left">Name</th>
                            <th style="padding:7px 10px;border:1px solid #ddd;text-align:left">Guardian</th>
                            <th style="padding:7px 10px;border:1px solid #ddd;text-align:left">House</th>
                            <th style="padding:7px 10px;border:1px solid #ddd;text-align:center;width:40px">Age</th>
                            <th style="padding:7px 10px;border:1px solid #ddd;text-align:center;width:100px">Time</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            }
        }

        const html = `<!DOCTYPE html><html><head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                * { box-sizing: border-box; }
                body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #1a1a2e; font-size: 13px; }
                .doc-header { border-bottom: 3px solid #1a1a2e; padding-bottom: 12px; margin-bottom: 16px; }
                .doc-title { font-size: 20px; font-weight: 800; color: #1a1a2e; margin: 0 0 4px 0; }
                .doc-subtitle { font-size: 13px; color: #555; margin: 0; }
                .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; }
                .meta-item label { display: block; color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
                .meta-item span { font-weight: 700; font-size: 13px; }
                @media print {
                    body { padding: 10px; }
                    @page { margin: 15mm; size: A4; }
                    .no-print { display: none !important; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; }
                    div { page-break-inside: avoid; }
                }
            </style>
        </head><body>
            <div class="doc-header">
                <p class="doc-title">എന്റെ വോട്ട് — My Vote</p>
                <p class="doc-subtitle">${title}</p>
            </div>
            <div class="meta-grid">
                <div class="meta-item"><label>District</label><span>${districtLabel}</span></div>
                <div class="meta-item"><label>Constituency</label><span>${constituencyLabel}</span></div>
                <div class="meta-item"><label>Booth</label><span>${boothLabel}</span></div>
                <div class="meta-item"><label>Total Voters</label><span>${allVoters.length}</span></div>
                <div class="meta-item"><label>Voted</label><span>${allVoters.filter(v => v.has_voted).length}</span></div>
                <div class="meta-item"><label>Printed On</label><span>${now}</span></div>
            </div>
            ${bodyHtml}
            <div style="margin-top:30px;border-top:1px solid #ddd;padding-top:10px;font-size:11px;color:#888;text-align:center">
                Generated by എന്റെ വോട്ട് (My Vote) &nbsp;·&nbsp; ${now} &nbsp;·&nbsp; ${boothLabel}
            </div>
        </body></html>`;

        const win = window.open('', '_blank', 'width=900,height=700');
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages) return;
        setCurrentPage(newPage);
        fetchVoters(newPage, pageSize);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setCurrentPage(1);
        fetchVoters(1, newSize);
    };

    return (
        <>
            <div className="container">
                <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-bg)' }}>വോട്ട് ഉറപ്പുവരുത്തുക (Vote Verification)</h2>

                {/* Filters — hidden for booth members (auto-selected) */}
                {!isBoothMember && <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                    <div className="responsive-grid">
                        <div className="form-group">
                            <label className="label">ജില്ല</label>
                            <select
                                className="input"
                                value={selectedDistrict}
                                onChange={e => { setSelectedDistrict(e.target.value); setSelectedConstituency(''); setSelectedBooth(''); }}
                                disabled={isWardMember}
                            >
                                <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="label">നിയോജക മണ്ഡലം</label>
                            <select
                                className="input"
                                value={selectedConstituency}
                                onChange={e => { setSelectedConstituency(e.target.value); setSelectedBooth(''); }}
                                disabled={!selectedDistrict || isWardMember}
                            >
                                <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                {constituencies.map(c => <option key={c.id} value={c.id}>{c.constituency_no} - {c.name}</option>)}
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
                                <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                {booths.map(b => <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>}

                {/* Modern Pill Tabs with swipe support */}
                <div
                    style={{ background: '#f1f5f9', borderRadius: '14px', padding: '4px', display: 'flex', marginBottom: '1.5rem', gap: '2px' }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {[
                        { id: 'trend', label: 'ട്രെൻഡ്', color: 'var(--accent)' },
                        { id: 'verification', label: 'വെരിഫിക്കേഷൻ', color: 'var(--primary)' },
                        { id: 'reports', label: 'റിപ്പോർട്ട്', color: 'var(--primary)' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: '0.6rem 0.4rem',
                                border: 'none',
                                borderRadius: '10px',
                                background: activeTab === tab.id ? 'white' : 'transparent',
                                color: activeTab === tab.id ? tab.color : '#6b7280',
                                fontWeight: activeTab === tab.id ? '700' : '500',
                                fontSize: 'clamp(0.72rem, 2.8vw, 0.88rem)',
                                cursor: 'pointer',
                                boxShadow: activeTab === tab.id ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'reports' && (
                    <div className="reports-section">
                        {!selectedBooth ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#666', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                റിപ്പോർട്ടുകൾ ലഭിക്കുന്നതിനായി ദയവായി ഒരു ബൂത്ത് തിരഞ്ഞെടുക്കുക. (Please select a booth to generate reports)
                            </div>
                        ) : (
                            <div className="card" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #eee' }}>
                                    <button
                                        onClick={() => setReportSubTab('detailed')}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            border: 'none',
                                            background: 'none',
                                            borderBottom: reportSubTab === 'detailed' ? '2px solid var(--primary)' : '2px solid transparent',
                                            color: reportSubTab === 'detailed' ? 'var(--primary)' : '#666',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Detailed List
                                    </button>
                                    <button
                                        onClick={() => setReportSubTab('summary')}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            border: 'none',
                                            background: 'none',
                                            borderBottom: reportSubTab === 'summary' ? '2px solid var(--primary)' : '2px solid transparent',
                                            color: reportSubTab === 'summary' ? 'var(--primary)' : '#666',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Summary Report
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: 'var(--primary-bg)' }}>
                                            {reportSubTab === 'detailed' ? 'വോട്ട് ചെയ്തവരുടെ പട്ടിക (Voted Members List)' : 'വോട്ട് സംഗ്രഹം (Vote Summary)'}
                                        </h3>
                                        <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: '0.9rem' }}>
                                            Booth: {booths.find(b => b.id === selectedBooth)?.booth_no} - {booths.find(b => b.id === selectedBooth)?.name}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handlePrint}
                                        className="btn btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Save size={18} /> Print Report
                                    </button>
                                </div>

                                {reportSubTab === 'summary' ? (
                                    <div className="report-content">
                                        {/* Desktop table */}
                                        <div className="desktop-view">
                                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                                                        <th style={{ padding: '1rem', textAlign: 'left' }}>മുന്നണി</th>
                                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Total</th>
                                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Voted</th>
                                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Not Voted</th>
                                                        <th style={{ padding: '1rem', textAlign: 'center' }}>%</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {fronts.map(front => {
                                                        const supporters = voters.filter(v => v.supported_front_id === front.id);
                                                        const voted = supporters.filter(v => v.has_voted).length;
                                                        const notVoted = supporters.length - voted;
                                                        const percentage = supporters.length > 0 ? ((voted / supporters.length) * 100).toFixed(1) : 0;
                                                        return (
                                                            <tr key={front.id} style={{ borderBottom: '1px solid #eee' }}>
                                                                <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: front.color || '#666' }}></div>
                                                                    <span style={{ fontWeight: '500' }}>{front.name}</span>
                                                                </td>
                                                                <td style={{ padding: '1rem', textAlign: 'center' }}>{supporters.length}</td>
                                                                <td style={{ padding: '1rem', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>{voted}</td>
                                                                <td style={{ padding: '1rem', textAlign: 'center', color: '#ef4444' }}>{notVoted}</td>
                                                                <td style={{ padding: '1rem', textAlign: 'center' }}>{percentage}%</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                                                        <td style={{ padding: '1rem' }}>Total</td>
                                                        <td style={{ padding: '1rem', textAlign: 'center' }}>{voters.filter(v => v.supported_front_id).length}</td>
                                                        <td style={{ padding: '1rem', textAlign: 'center', color: '#10b981' }}>{voters.filter(v => v.supported_front_id && v.has_voted).length}</td>
                                                        <td style={{ padding: '1rem', textAlign: 'center', color: '#ef4444' }}>{voters.filter(v => v.supported_front_id && !v.has_voted).length}</td>
                                                        <td style={{ padding: '1rem', textAlign: 'center' }}>-</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Mobile tiles */}
                                        <div className="mobile-view" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                                            {fronts.map(front => {
                                                const supporters = voters.filter(v => v.supported_front_id === front.id);
                                                const voted = supporters.filter(v => v.has_voted).length;
                                                const notVoted = supporters.length - voted;
                                                const percentage = supporters.length > 0 ? ((voted / supporters.length) * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={front.id} style={{ border: `2px solid ${front.color || '#e5e7eb'}`, borderRadius: '12px', padding: '1rem', background: front.color ? `${front.color}08` : '#fff' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: front.color || '#666' }} />
                                                            <span style={{ fontWeight: '700', fontSize: '1rem', color: front.color || '#333' }}>{front.name}</span>
                                                            <span style={{ marginLeft: 'auto', background: '#f1f5f9', padding: '2px 8px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{percentage}%</span>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                                                            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.5rem' }}>
                                                                <div style={{ fontSize: '1.3rem', fontWeight: '800' }}>{supporters.length}</div>
                                                                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Total</div>
                                                            </div>
                                                            <div style={{ background: '#dcfce7', borderRadius: '8px', padding: '0.5rem' }}>
                                                                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#16a34a' }}>{voted}</div>
                                                                <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>Voted</div>
                                                            </div>
                                                            <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '0.5rem' }}>
                                                                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#dc2626' }}>{notVoted}</div>
                                                                <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>Pending</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="report-content">
                                        {fronts.map(front => {
                                            const frontVoters = voters.filter(v => v.has_voted && v.supported_front_id === front.id);
                                            if (frontVoters.length === 0) return null;

                                            return (
                                                <div key={front.id} style={{ marginBottom: '2rem' }}>
                                                    <h4 style={{
                                                        background: front.color ? `${front.color}20` : '#f3f4f6',
                                                        color: front.color || '#333',
                                                        padding: '0.75rem',
                                                        borderRadius: '8px 8px 0 0',
                                                        marginBottom: 0,
                                                        borderLeft: `4px solid ${front.color || '#ccc'}`
                                                    }}>
                                                        {front.name} ({frontVoters.length})
                                                    </h4>
                                                                    {/* Desktop table */}
                                                    <div className="desktop-view" style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'left', width: '60px' }}>Sl.No</th>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>House Name</th>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Age</th>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'left', width: '150px' }}>Updated At</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {frontVoters.map((voter) => (
                                                                    <tr key={voter.id} style={{ borderBottom: '1px solid #eee' }}>
                                                                        <td style={{ padding: '0.75rem' }}>{voter.sl_no}</td>
                                                                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>{voter.name}</td>
                                                                        <td style={{ padding: '0.75rem', color: '#666' }}>{voter.house_name}</td>
                                                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{voter.age}</td>
                                                                        <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
                                                                            {voter.updated_at ? new Date(voter.updated_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '-'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    {/* Mobile tiles */}
                                                    <div className="mobile-view" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                        {frontVoters.map((voter) => (
                                                            <div key={voter.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                                                                <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 7px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', minWidth: '32px', textAlign: 'center' }}>{voter.sl_no}</span>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{voter.name}</div>
                                                                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{voter.house_name} · Age {voter.age}</div>
                                                                </div>
                                                                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'right' }}>
                                                                    {voter.updated_at ? new Date(voter.updated_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Unverified/No Front but Voted - Should not theoretically happen if workflow is strict, but good to have */}
                                        {(() => {
                                            const otherVoters = voters.filter(v => v.has_voted && !v.supported_front_id);
                                            if (otherVoters.length === 0) return null;
                                            return (
                                                <div style={{ marginBottom: '2rem' }}>
                                                    <h4 style={{ background: '#f3f4f6', padding: '0.75rem', borderRadius: '8px 8px 0 0', marginBottom: 0, borderLeft: '4px solid #999' }}>
                                                        മറ്റുള്ളവർ / Other ({otherVoters.length})
                                                    </h4>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                                                                <th style={{ padding: '0.75rem', textAlign: 'left', width: '60px' }}>Sl.No</th>
                                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>House Name</th>
                                                                <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Age</th>
                                                                <th style={{ padding: '0.75rem', textAlign: 'left', width: '150px' }}>Updated At</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {otherVoters.map((voter, idx) => (
                                                                <tr key={voter.id} style={{ borderBottom: '1px solid #eee' }}>
                                                                    <td style={{ padding: '0.75rem' }}>{voter.sl_no}</td>
                                                                    <td style={{ padding: '0.75rem', fontWeight: '500' }}>{voter.name}</td>
                                                                    <td style={{ padding: '0.75rem', color: '#666' }}>{voter.house_name}</td>
                                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{voter.age}</td>
                                                                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
                                                                        {voter.updated_at ? new Date(voter.updated_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'verification' && selectedBooth && (
                    <>
                        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
                                <Search size={20} color="#666" />
                                <input
                                    type="text"
                                    placeholder="പേര്, ക്രമനമ്പർ എന്നിവ തിരയുക..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ border: 'none', outline: 'none', flex: 1, fontSize: '1rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Filter size={18} color="#666" />
                                <select
                                    value={verificationFilter}
                                    onChange={e => setVerificationFilter(e.target.value)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        outline: 'none',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <option value="all">എല്ലാം (All)</option>
                                    <option value="verified">പരിശോധിച്ചവ (Verified)</option>
                                    <option value="not_verified">പരിശോധിക്കാത്തവ (Not Verified)</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Filter size={18} color="#666" />
                                <select
                                    value={voteStatusFilter}
                                    onChange={e => setVoteStatusFilter(e.target.value)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        outline: 'none',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <option value="all">വോട്ടർ നില (All Status)</option>
                                    <option value="voted">വോട്ട് ചെയ്തവർ (Voted)</option>
                                    <option value="not_voted">വോട്ട് ചെയ്യാത്തവർ (Will Vote)</option>
                                </select>
                            </div>
                        </div>

                        {loading ? <LoadingSpinner /> : (
                            <div className="grid">
                                {voters.map(voter => (
                                    <div key={voter.id} className="card" style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                        #{voter.sl_no}
                                                    </span>
                                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{voter.name}</h3>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.25rem' }}>
                                                    {voter.guardian_name}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.15rem' }}>
                                                    {voter.house_no ? `No: ${voter.house_no}` : ''}{voter.house_name ? ` / ${voter.house_name}` : ''} | {voter.gender === 'Male' || voter.gender === 'പുരുഷൻ' || voter.gender === 'M' ? 'M' : 'F'} / {voter.age}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="label" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>പിന്തുണയ്ക്കുന്ന മുന്നണി:</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {fronts.map(front => (
                                                    <button
                                                        key={front.id}
                                                        onClick={() => handleFrontChange(voter.id, front.id)}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            borderRadius: '50px',
                                                            border: voter.supported_front_id === front.id ? `2px solid ${front.color || 'var(--primary)'}` : '1px solid #e2e8f0',
                                                            background: voter.supported_front_id === front.id ? (front.color ? `${front.color}20` : '#fdf2f4') : 'white',
                                                            color: voter.supported_front_id === front.id ? (front.color || 'var(--primary)') : 'var(--text)',
                                                            fontWeight: voter.supported_front_id === front.id ? 'bold' : 'normal',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {front.name}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => handleFrontChange(voter.id, null)}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        borderRadius: '50px',
                                                        border: '1px solid #e2e8f0',
                                                        background: !voter.supported_front_id ? '#f3f4f6' : 'white',
                                                        color: '#666',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    None
                                                </button>
                                            </div>
                                        </div>
                                        {voter.supported_front_id && (
                                            <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleMarkVoted(voter.id, !voter.has_voted)}
                                                    className={`btn ${voter.has_voted ? 'btn-success' : 'btn-secondary'}`}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.5rem',
                                                        background: voter.has_voted ? '#10b981' : 'white',
                                                        color: voter.has_voted ? 'white' : 'var(--text)',
                                                        borderColor: voter.has_voted ? '#10b981' : '#e2e8f0'
                                                    }}
                                                >
                                                    {voter.has_voted ? 'വോട്ട് ചെയ്തു (Voted)' : 'വോട്ട് രേഖപ്പെടുത്തുക (Mark Voted)'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {totalVoters > 0 && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalVoters}
                                pageSize={pageSize}
                                onPageChange={handlePageChange}
                                onPageSizeChange={handlePageSizeChange}
                            />
                        )}
                    </>
                )
                }

                {
                    activeTab === 'trend' && (
                        <div className="trend-section">
                            {!isBoothMember && <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: '#666', fontSize: '0.9rem' }}>Filter By:</span>
                                    <select
                                        value={voteStatusFilter}
                                        onChange={e => setVoteStatusFilter(e.target.value)}
                                        style={{
                                            padding: '0.5rem',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            outline: 'none',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        <option value="all">എല്ലാം (All Voters)</option>
                                        <option value="voted">വോട്ട് ചെയ്തവർ (Voted)</option>
                                        <option value="not_voted">വോട്ട് ചെയ്യാത്തവർ (Not Voted)</option>
                                    </select>
                                </div>
                            </div>}

                            {loading ? <LoadingSpinner /> : stats ? (
                                <div className="grid grid-2">
                                    {/* Summary Card */}
                                    <div className="card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, #371120 0%, #5b1d36 100%)', color: 'white' }}>
                                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem' }}>
                                            ആകെ സ്ഥിതിവിവരക്കണക്കുകൾ (Total Statistics)
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', textAlign: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{stats.total}</div>
                                                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>ആകെ വോട്ടർമാർ</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4ade80' }}>{stats.verified}</div>
                                                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>പരിശോധിച്ചവർ (Verified)</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24' }}>{stats.unverified}</div>
                                                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>ബാക്കിയുള്ളവർ (Pending)</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chart Section */}
                                    <div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <h3 style={{ marginBottom: '1rem', color: 'var(--primary-bg)' }}>ഗ്രാഫ് (Graph)</h3>
                                        <div style={{ width: '100%', height: '300px', minHeight: '300px', minWidth: '0' }}>
                                            <ResponsiveContainer width="100%" height={300} minWidth={0}>
                                                <PieChart>
                                                    <Pie
                                                        data={stats.chartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        outerRadius={100}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                    >
                                                        {stats.chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Front Wise Breakdown */}
                                    <div className="card">
                                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary-bg)' }}>വിശദാംശങ്ങൾ (Details)</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {Object.entries(stats.fronts).map(([frontName, data]) => {
                                                const percentage = ((data.count / stats.total) * 100).toFixed(1);
                                                return (
                                                    <div key={frontName} style={{ position: 'relative' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontWeight: '600' }}>
                                                            <span>{frontName}</span>
                                                            <span>{data.count} ({percentage}%)</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '12px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: `${percentage}%`,
                                                                height: '100%',
                                                                background: data.color,
                                                                borderRadius: '6px',
                                                                transition: 'width 0.5s ease-out'
                                                            }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                                    വിവരങ്ങൾ ലഭ്യമല്ല. ദയവായി ഒരു നിയോജക മണ്ഡലം അല്ലെങ്കിൽ ബൂത്ത് തിരഞ്ഞെടുക്കുക.
                                </div>
                            )}
                        </div>
                    )
                }
            </div >
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
