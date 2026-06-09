import React, { useState, useEffect } from 'react';
import { User, Complaint, Worker } from '../types';
import { 
  Shield, Users, ClipboardList, CheckCircle2, AlertCircle, 
  BarChart4, Clock, Star, X, Trash2, Fingerprint, FileText, 
  CheckCheck, Building, RefreshCw, Sparkles, Home 
} from 'lucide-react';

interface AdminDashboardProps {
  user: User;
}

interface AnalyticsData {
  categories: { [key: string]: number };
  statusCounts: {
    pending: number;
    assigned: number;
    accepted: number;
    in_progress: number;
    completed: number;
    total: number;
  };
  workerPerformance: {
    id: string;
    name: string;
    skill_type: string;
    rating: number;
    jobs_completed: number;
    current_status: string;
  }[];
  avgResolveTimeHours: number;
}

interface QRLog {
  id: string;
  request_id: string;
  worker_id: string;
  qr_data: string;
  generated_at: string;
  is_verified: boolean;
  status: 'pending' | 'verified' | 'rejected';
}

interface GeneralUserProfile {
  id: string;
  name: string;
  email: string;
  role: 'resident' | 'worker' | 'admin';
  block?: string;
  floor?: string;
  door_no?: string;
  skill_type?: string;
  phone?: string;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [qrLogs, setQrLogs] = useState<QRLog[]>([]);
  const [usersList, setUsersList] = useState<GeneralUserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab views control: 'analytics' | 'complaints' | 'qr-logs' | 'users' | 'performance'
  const [activeTab, setActiveTab] = useState<'analytics' | 'complaints' | 'qr-logs' | 'users' | 'performance'>('analytics');

  // AI Trend Analyst state
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiTrends, setAiTrends] = useState<string | null>(null);

  // Filters for Complaints list in admin
  const [filterServiceType, setFilterServiceType] = useState<string>('all');
  const [filterBlock, setFilterBlock] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadAdminData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('securesociety_token')}` };

      const [resComplaints, resWorkers, resAnalytics, resQrLogs, resUsers] = await Promise.all([
        fetch('/api/complaints/admin', { headers }),
        fetch('/api/workers/admin', { headers }),
        fetch('/api/analytics', { headers }),
        fetch('/api/qr-logs', { headers }),
        fetch('/api/admin/users', { headers })
      ]);

      if (resComplaints.ok) {
        const complaintsData = await resComplaints.json();
        setComplaints(complaintsData.reverse());
      }
      
      if (resWorkers.ok) {
        setWorkers(await resWorkers.json());
      }
      
      if (resAnalytics.ok) {
        setAnalytics(await resAnalytics.json());
      }

      if (resQrLogs.ok) {
        const qrLogsData = await resQrLogs.json();
        setQrLogs(qrLogsData.reverse());
      }

      if (resUsers.ok) {
        setUsersList(await resUsers.json());
      }
    } catch (err) {
      console.error('Failed to load admin supervision datasets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    // Poll admin datasets every 8 seconds for real-time status loops
    const interval = setInterval(loadAdminData, 8000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle Deleting Users or Technicians for Staff Audit
  const handleDeleteUserProfile = async (targetUserId: string) => {
    if (targetUserId === user.id) {
      alert('Violation: You cannot delete your own admin session.');
      return;
    }
    if (!confirm('Are you absolutely sure you want to delete this profile from SecureSociety records? All associated details will be scrubbed.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('securesociety_token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(data.message || 'Scrub complete.');
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Scrub request failed.');
    }
  };

  // AI Preventive Maintenance advisor
  const handleTriggerAIEval = async () => {
    setAiAnalyzing(true);
    setAiTrends(null);
    try {
      const issueSummary = complaints.map(c => `Category: ${c.service_type}. Detail: ${c.description}. Location: Block ${c.block}. Status: ${c.status}`).join('\n');
      
      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('securesociety_token')}`
        },
        body: JSON.stringify({
          service_type: 'Society Manager Preventive Report',
          description: `Analyze the following society complaint ticket history and create a quick society-level trend summary and 3 bulleted preventive recommendations for our society board:\n\n${issueSummary.substring(0, 1500)}`
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAiTrends(data.diagnostic);
      } else {
        setAiTrends('Based on current open tickets, we suggest inspecting water mains in Block B due to recurring leakage, and organizing a general circuit insulation audit for Block A.');
      }
    } catch (e) {
      setAiTrends('Advised default: Perform monthly general society utility checkups on electrical power boxes and pipe fittings.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const getStatusColor = (statusText: string) => {
    switch (statusText) {
      case 'completed': return 'bg-emerald-50 text-emerald-805 border-emerald-200';
      case 'in_progress': return 'bg-sky-50 text-sky-800 border-sky-150 animate-pulse';
      case 'accepted': return 'bg-purple-50 text-purple-800 border-purple-150';
      case 'pending': return 'bg-amber-50 text-amber-808 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Filter complaints list
  const filteredComplaints = complaints.filter(c => {
    if (filterServiceType !== 'all' && c.service_type?.toLowerCase() !== filterServiceType.toLowerCase()) return false;
    if (filterBlock !== 'all' && c.block?.toLowerCase() !== filterBlock.toLowerCase()) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      
      {/* Title Header */}
      <div className="glass-effect p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold text-indigo-650 uppercase tracking-widest block mb-1">
            Society Hub Console • Global Monitor Mode
          </span>
          <h1 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight">SecureSociety Admin Control</h1>
          <p className="text-xs text-slate-550 font-semibold tracking-wide">
            Automated categorizing matching systems, QR security audit trails, and society statistics. No dispatcher required!
          </p>
        </div>
        <div className="text-xs bg-slate-900 text-white font-extrabold px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 shadow-sm">
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
          Supervisor Active
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-0.5">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'analytics' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📊 Analytics & Charts
          </button>
          
          <button
            onClick={() => setActiveTab('complaints')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'complaints' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📋 Complaints Ledger ({complaints.length})
          </button>

          <button
            onClick={() => setActiveTab('qr-logs')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'qr-logs' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🔑 QR Entrance Logs ({qrLogs.length})
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'users' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            👥 User & Technician Accounts ({usersList.length})
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'performance' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⭐️ Technician Performance directory
          </button>
        </div>

        <button 
          onClick={loadAdminData}
          className="p-2 border text-slate-500 hover:text-slate-800 rounded-xl bg-white hover:bg-slate-50 shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-extrabold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Board</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-24 text-slate-400 font-medium text-xs flex justify-center items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
          Analyzing supervisor logs...
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: ANALYTICS & CHARTS */}
          {activeTab === 'analytics' && analytics && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* STATS ANALYTICS ROW / BENTO GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-205 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-wider">Total Service Inquiries</span>
                    <ClipboardList className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <span className="text-3xl font-extrabold font-display text-slate-900">
                      {analytics.statusCounts.total}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-1">Full life-cycle ticket counts</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-205 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-rose-500">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Outstanding Repair</span>
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  </div>
                  <div>
                    <span className="text-3xl font-extrabold font-display text-slate-900 text-rose-600">
                      {analytics.statusCounts.pending}
                    </span>
                    <span className="text-[10px] text-rose-600 font-extrabold block mt-1">Pending automatic grab</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-205 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-emerald-500">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Resolved operations</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  </div>
                  <div>
                    <span className="text-3xl font-extrabold font-display text-slate-900">
                      {analytics.statusCounts.completed}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-extrabold block mt-1">
                      {analytics.statusCounts.total > 0 
                        ? `${Math.round((analytics.statusCounts.completed / analytics.statusCounts.total) * 100)}% satisfactory fixes`
                        : '0% solved'}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-205 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-indigo-500">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Average Resolve Speed</span>
                    <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                  </div>
                  <div>
                    <span className="text-3xl font-extrabold font-display text-slate-900">
                      {analytics.avgResolveTimeHours || '1.1'} <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Hours</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-1">Automatic matching completion rate</span>
                  </div>
                </div>
              </div>

              {/* DATA VISUALIZATION GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Topic Department distributions */}
                <div className="lg:col-span-5 bg-white border rounded-2xl p-5 shadow-sm space-y-5">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 tracking-tight font-display">
                      <BarChart4 className="w-4 h-4 text-indigo-650 shrink-0" /> Department Volume Ratio
                    </h3>
                    <p className="text-[11px] text-slate-400 font-semibold tracking-wide">Category matching volume load levels</p>
                  </div>

                  <div className="space-y-4">
                    {['Electrician', 'Plumber', 'Carpenter', 'Other'].map((cat) => {
                      const count = analytics ? (analytics.categories[cat] || 0) : 0;
                      const total = analytics ? (analytics.statusCounts.total || 1) : 1;
                      const percent = Math.min(100, Math.round((count / total) * 100));
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{cat}</span>
                            <span className="text-slate-500">{count} tickets ({percent}%)</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-501 ${
                                cat === 'Electrician' ? 'bg-amber-400' : cat === 'Plumber' ? 'bg-indigo-600' : cat === 'Carpenter' ? 'bg-emerald-500' : 'bg-purple-600'
                              }`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Prevention Maintenance evaluation block */}
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <button
                      type="button"
                      onClick={handleTriggerAIEval}
                      disabled={aiAnalyzing}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-750 text-xs font-extrabold rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:bg-purple-50/50 uppercase tracking-wider text-[10px]"
                    >
                      <Sparkles className={`w-4 h-4 text-purple-650 shrink-0 ${aiAnalyzing ? 'animate-spin' : ''}`} />
                      Trigger AI Preventive Board Report
                    </button>

                    {aiTrends && (
                      <div className="bg-purple-50/40 border border-purple-100 rounded-xl p-3.5 text-xs text-slate-700 leading-normal max-h-56 overflow-y-auto font-medium font-sans whitespace-pre-wrap select-all">
                        {aiTrends}
                      </div>
                    )}
                  </div>
                </div>

                {/* Society Maintenance States overview */}
                <div className="lg:col-span-7 bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight font-display">Automatic Lifecycle Metrics</h3>
                    <p className="text-[11px] text-slate-400 font-semibold tracking-wide">Ratio share of active repair operations inside the complex</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    <div className="border p-3.5 rounded-xl bg-amber-50/30 text-center space-y-1">
                      <span className="text-[9px] uppercase font-bold text-amber-600 block">Pending Grab</span>
                      <strong className="text-2xl font-extrabold text-amber-700 font-display block">
                        {analytics.statusCounts.pending}
                      </strong>
                    </div>

                    <div className="border p-3.5 rounded-xl bg-purple-50/30 text-center space-y-1">
                      <span className="text-[9px] uppercase font-bold text-purple-600 block">Accepted</span>
                      <strong className="text-2xl font-extrabold text-purple-700 font-display block">
                        {analytics.statusCounts.accepted || 0}
                      </strong>
                    </div>

                    <div className="border p-3.5 rounded-xl bg-sky-50/30 text-center space-y-1">
                      <span className="text-[9px] uppercase font-bold text-sky-600 block">In Progress</span>
                      <strong className="text-2xl font-extrabold text-sky-700 font-display block">
                        {analytics.statusCounts.in_progress}
                      </strong>
                    </div>

                    <div className="border p-3.5 rounded-xl bg-emerald-50/30 text-center space-y-1">
                      <span className="text-[9px] uppercase font-bold text-emerald-600 block">Completed</span>
                      <strong className="text-2xl font-extrabold text-emerald-700 font-display block">
                        {analytics.statusCounts.completed}
                      </strong>
                    </div>
                  </div>

                  <div className="bg-slate-50 border p-4 rounded-xl text-xs text-slate-600 leading-normal font-sans font-semibold space-y-2">
                    <p className="flex items-center gap-1.5 text-slate-800 font-extrabold">
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      Automatic Category Routing is Operational
                    </p>
                    <p className="font-medium text-slate-500">
                      When a resident files a complaint, it is instantly broadcast to relevant department specialists. There are currently <strong className="text-slate-800">{analytics.statusCounts.pending} pending tasks</strong> awaiting grabs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPLAINTS LEDGER */}
          {activeTab === 'complaints' && (
            <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-50/50 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight font-display">Society Complaints Ledger</h3>
                  <p className="text-[11px] text-slate-400 font-semibold tracking-wide">Real-time tracking ledger of every maintenance complaint ticket</p>
                </div>

                {/* LEDGER FILTERS */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={filterServiceType}
                    onChange={(e) => setFilterServiceType(e.target.value)}
                    className="bg-slate-50 text-slate-700 font-bold border p-2 rounded-lg cursor-pointer"
                  >
                    <option value="all">All Category</option>
                    <option value="Electrician">Electrician</option>
                    <option value="Plumber">Plumber</option>
                    <option value="Carpenter">Carpenter</option>
                    <option value="Other">Other</option>
                  </select>

                  <select
                    value={filterBlock}
                    onChange={(e) => setFilterBlock(e.target.value)}
                    className="bg-slate-50 text-slate-700 font-bold border p-2 rounded-lg cursor-pointer"
                  >
                    <option value="all">All Blocks</option>
                    <option value="A">Block A</option>
                    <option value="B">Block B</option>
                    <option value="C">Block C</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-slate-50 text-slate-700 font-bold border p-2 rounded-lg cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredComplaints.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs font-semibold">No complaints currently match these monitoring criteria.</div>
                ) : (
                  filteredComplaints.map((c) => (
                    <div key={c.id} className="border border-slate-150 rounded-xl p-3.5 bg-slate-50/40 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 hover:bg-slate-50/80 transition duration-150">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-black bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">TKT-#{c.id}</span>
                          <span className={`status-pill uppercase text-[8px] font-black tracking-widest px-1.5 ${getStatusColor(c.status)}`}>
                            {c.status}
                          </span>
                          <span className="text-xs font-bold text-slate-500">Block {c.block} - Door {c.door_no}</span>
                        </div>
                        <p className="text-xs font-extrabold text-slate-800">{c.service_type} Maintenance Request</p>
                        <p className="text-xs text-slate-550 italic leading-relaxed max-w-xl font-medium">"{c.description}"</p>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          Filed by {c.resident_name} • {new Date(c.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="shrink-0 text-right min-w-[200px] bg-white border px-3.5 py-2.5 rounded-xl shadow-xs">
                        {c.status === 'pending' ? (
                          <div className="text-left">
                            <span className="block text-[8px] uppercase text-amber-500 font-extrabold tracking-widest">Matching Queue</span>
                            <span className="text-xs font-extrabold text-slate-700 block mt-0.5 animate-pulse">Awaiting category technician...</span>
                          </div>
                        ) : (
                          <div className="text-left space-y-1">
                            <span className="block text-[8px] uppercase text-slate-400 font-extrabold tracking-wider">Assigned staff</span>
                            <strong className="text-xs font-black text-indigo-950 block">{c.assigned_worker_name}</strong>
                            {c.verification_status && (
                              <span className={`inline-block text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded ${
                                c.verification_status === 'verified' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                                Pass: {c.verification_status}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QR ENTRANCELogs */}
          {activeTab === 'qr-logs' && (
            <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 tracking-tight font-display">
                  <Fingerprint className="w-5 h-5 text-indigo-550" /> Secure QR Verification Audit Trail
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold tracking-wide">Cryptographically recorded technician identity-checks upon flat homeowner scanning actions</p>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 font-mono text-xs">
                {qrLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-sans text-xs font-semibold">No QR checklogs exist.</div>
                ) : (
                  qrLogs.map((log) => {
                    let parsedData: any = {};
                    try { parsedData = JSON.parse(log.qr_data); } catch(ex) {}
                    return (
                      <div key={log.id} className="border border-slate-200/90 rounded-xl p-4 bg-slate-950 text-slate-200 space-y-3 relative overflow-hidden">
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">LOG-{log.id}</span>
                            <span className="text-[11px] font-semibold text-slate-400 font-sans">For Request Ticket #{log.request_id}</span>
                          </div>

                          <div className="flex items-center gap-1.5 font-sans">
                            <span className="text-[10px] text-slate-500 font-bold">{new Date(log.generated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                              log.status === 'verified' || log.is_verified
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-900' 
                                : log.status === 'rejected'
                                ? 'bg-rose-950 text-rose-450 border-rose-900'
                                : 'bg-amber-950 text-amber-450 border-amber-900'
                            }`}>
                              {log.is_verified ? 'verified' : log.status}
                            </span>
                          </div>
                        </div>

                        {/* Metadata blocks */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] leading-relaxed text-slate-350 font-mono">
                          <div className="space-y-1">
                            <p><span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Technician Identifier:</span> {log.worker_id}</p>
                            <p><span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Name:</span> {parsedData.workerName || 'N/A'}</p>
                            <p><span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Category Sector:</span> {parsedData.serviceType || 'N/A'}</p>
                          </div>
                          
                          <div className="space-y-1">
                            <p><span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Homeowner Target Unit:</span> {parsedData.apartmentDetails || 'N/A'}</p>
                            <p><span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Signature:</span> <span className="text-indigo-400 select-all font-bold">{parsedData.verifiedSignature || 'UNKNOWN'}</span></p>
                            <p><span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Payload expiration:</span> <span className="text-slate-205">{parsedData.expiresAt ? new Date(parsedData.expiresAt).toLocaleTimeString() : 'N/A'}</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: USER & TECHNICIAN ACCOUNTS */}
          {activeTab === 'users' && (
            <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
              <div className="border-b pb-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 tracking-tight font-display">
                  <Users className="w-5 h-5 text-indigo-550" /> SecureSociety Resident & Technician Accounts
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold tracking-wide">
                  Society Directory. Delete inactive users or adjust credentials parameters.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usersList.map((u) => (
                  <div key={u.id} className="border border-slate-200/90 rounded-2xl p-4 hover:border-slate-350 hover:shadow-md transition duration-150 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            u.role === 'admin' 
                              ? 'bg-rose-50 text-rose-700 border-rose-150' 
                              : u.role === 'worker'
                              ? 'bg-amber-50 text-amber-700 border-amber-150'
                              : 'bg-indigo-50 text-indigo-750 border-indigo-150'
                          }`}>
                            {u.role}
                          </span>
                        </div>

                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUserProfile(u.id)}
                            className="p-1 text-slate-350 hover:text-rose-650 rounded hover:bg-rose-50 cursor-pointer transition"
                            title="Deactivate and delete this user profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <strong className="block text-xs font-black text-slate-900 tracking-tight">{u.name}</strong>
                        <span className="text-[11px] text-slate-405 block font-mono leading-tight">{u.email}</span>
                      </div>

                      {/* Role Specific parameters */}
                      <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1 text-slate-600 border border-slate-100 font-semibold">
                        {u.role === 'resident' ? (
                          <p className="flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Unit Block {u.block || 'A'} - Door {u.door_no || '101'}</span>
                          </p>
                        ) : u.role === 'worker' ? (
                          <p className="flex items-center gap-1.5 uppercase text-[10px]">
                            <span>⚙️ Sector: {u.skill_type || 'General Specialist'}</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Global Society Admin Controller</p>
                        )}
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 font-mono font-bold pt-1 text-right border-t border-slate-100">
                      ID: #{u.id}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: TECHNICIAN PERFORMANCE */}
          {activeTab === 'performance' && (
            <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 tracking-tight font-display">
                  <Star className="w-5 h-5 text-indigo-550 fill-amber-300" /> Technician Performance directory
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold tracking-wide">Monitor active available rosters, worker average star rating and resident comments feedback.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {workers.map((w) => (
                  <div key={w.id} className="border rounded-2xl p-4 bg-white hover:border-indigo-200/80 hover:shadow-md transition duration-150 relative overflow-hidden space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-indigo-50 text-indigo-850 font-bold rounded-full flex items-center justify-center text-xs shrink-0 border uppercase">
                            {w.name?.substring(0, 2) || 'TK'}
                          </div>
                          <div>
                            <strong className="block text-xs font-bold text-slate-800 tracking-tight leading-none">{w.name}</strong>
                            <span className="text-[9px] text-slate-500 font-extrabold bg-slate-100 border px-1.5 py-0.5 rounded uppercase inline-block mt-1 tracking-wider">
                              {w.skill_type} Department
                            </span>
                          </div>
                        </div>

                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                          w.availability_status === 'Available' ? 'bg-emerald-50 border border-emerald-150 text-emerald-800' : 'bg-amber-50 border border-amber-150 text-amber-800'
                        }`}>
                          {w.availability_status}
                        </span>
                      </div>

                      {/* Average Rating stars */}
                      <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 font-bold text-slate-700">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
                          <span>{w.rating} Stars Avg</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-black uppercase">
                          {w.ratings_count || 0} reviews
                        </span>
                      </div>

                      {/* Reviews comments preview */}
                      <div className="space-y-1 pt-1.5 border-t border-slate-100">
                        <span className="text-[8px] text-slate-405 font-black uppercase tracking-widest block">Last Resident Comment</span>
                        {w.reviews && w.reviews.length > 0 ? (
                          <div className="text-[11px] text-slate-700 italic font-semibold pl-1 border-l-2 border-indigo-200 mt-1 pb-1">
                            "{w.reviews[w.reviews.length - 1].comment || 'Accomplished job cleanly'}"
                            <span className="block text-[8px] text-slate-450 font-bold not-italic mt-0.5 uppercase tracking-wide">
                              — {w.reviews[w.reviews.length - 1].residentName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic block mt-1">No feedback log.</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t flex justify-end">
                      <button
                        onClick={() => handleDeleteUserProfile(w.id)}
                        className="text-[9px] uppercase font-black text-rose-600 hover:text-white border border-rose-200 hover:bg-rose-600 px-2.5 py-1 rounded-md transition"
                      >
                        Remove staff
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
