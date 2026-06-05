import React, { useState, useEffect } from 'react';
import { User, Complaint } from '../types';
import { 
  Check, X, Compass, Clock, BadgeCheck, Phone, MapPin, 
  RefreshCw, Layers, ShieldCheck, Play, CheckSquare, Sparkles, 
  Star, Calendar, Filter, ChevronRight, MessageSquare, AlertTriangle 
} from 'lucide-react';

const API_URL = "https://securesociety-smart-apartment-service.onrender.com";

interface WorkerDashboardProps {
  user: User;
}

interface WorkerProfileMetrics {
  id: string;
  name: string;
  phone: string;
  skill_type: string;
  availability_status: string;
  rating: number;
  ratings_count: number;
  reviews: { residentName: string; rating: number; comment?: string; date: string }[];
}

export default function WorkerDashboard({ user }: WorkerDashboardProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMetrics, setProfileMetrics] = useState<WorkerProfileMetrics | null>(null);
  
  // Tab control: 'available' | 'active' | 'completed' | 'reviews'
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'completed' | 'reviews'>('available');

  // Multi-criteria filters
  const [filterServiceType, setFilterServiceType] = useState<string>(user.skill_type || 'all');
  const [filterBlock, setFilterBlock] = useState<string>('all');
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateSort, setFilterDateSort] = useState<'latest' | 'earliest'>('latest');

  // Clock-in morning safety indicator
  const [isClockedIn, setIsClockedIn] = useState(() => {
    return localStorage.getItem(`clocked_in_${user.id}`) === 'true';
  });
  const [clockInTime, setClockInTime] = useState(() => {
    return localStorage.getItem(`clock_time_${user.id}`) || null;
  });

  // Active QR generation modal state
  const [activeQRJob, setActiveQRJob] = useState<Complaint | null>(null);
  const [qrCodeURI, setQrCodeURI] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<any | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Load complaints and worker metrics profile
  const fetchWorkerData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${user.id}` };
      
      const [resComplaints, resProfile] = await Promise.all([
        fetch(`${API_URL}/api/complaints/worker`, { headers })
        fetch(`${API_URL}/api/worker/profile`, { headers })

      ]);

      if (resComplaints.ok) {
        const data = await resComplaints.json();
        setComplaints(data);
      }
      
      if (resProfile.ok) {
        const metrics = await resProfile.json();
        setProfileMetrics(metrics);
      }
    } catch (err) {
      console.error('Failed to load technician dashboard datasets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkerData();
    // Poll updates every 5 seconds for immediate automatic matching state
    const interval = setInterval(fetchWorkerData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle clocking in reporting
  const handleClockIn = () => {
    setIsClockedIn(true);
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setClockInTime(`${timeNow} Tracked`);
    localStorage.setItem(`clocked_in_${user.id}`, 'true');
    localStorage.setItem(`clock_time_${user.id}`, `${timeNow} Tracked`);
  };

  // Direct Category Accept & Release actions
  const handleRespondJob = async (complaintId: string, action: 'accept' | 'reject') => {
    try {
      const response = await fetch(`${API_URL}/api/complaints/${complaintId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({ response: action })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to handle action: ${action}`);
      }

      alert(action === 'accept' 
        ? `Successfully accepted job #${complaintId}! Secure entry QR pass has been generated.` 
        : `Released job #${complaintId}. It is now back on the public board for other technicians.`
      );
      
      fetchWorkerData();
      if (action === 'accept') {
        setActiveTab('active');
      } else {
        setActiveTab('available');
      }
    } catch (err: any) {
      alert(err.message || 'Workflow assignment error.');
    }
  };

  // Generate QR pass details from backend payload
  const handleShowQR = async (job: Complaint) => {
    setActiveQRJob(job);
    setQrLoading(true);
    setQrCodeURI(null);
    setQrPayload(null);
    try {
      const res = await fetch(`${API_URL}/api/complaints/${job.id}/qr-code`,  {
        headers: { 'Authorization': `Bearer ${user.id}` }
      });
      const data = await res.json();
      if (res.ok) {
        setQrCodeURI(data.qrCodeDataUrl);
        setQrPayload(data.rawPayload);
      } else {
        alert(data.error || 'Server failed to build QR Entry Pass');
      }
    } catch (e) {
      alert('Error fetching secure QR credentials token');
    } finally {
      setQrLoading(false);
    }
  };

  // Progress job status (Accepted -> In Progress -> Completed)
  const handleUpdateStatus = async (complaintId: string, nextStatus: 'in_progress' | 'completed') => {
    try {
      const res = await fetch(`${API_URL}/api/complaints/${complaintId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Task status updated: ${nextStatus.toUpperCase().replace('_', ' ')}`);
      fetchWorkerData();
      if (nextStatus === 'completed') {
        setActiveTab('completed');
      }
    } catch (err: any) {
      alert(err.message || 'Workflow error: Check resident verification check.');
    }
  };

  // Extract unique blocks and floors from current dataset for smart filters
  const uniqueBlocks = Array.from(new Set(complaints.map(c => c.block))).filter(Boolean);
  const uniqueFloors = Array.from(new Set(complaints.map(c => c.floor))).filter(Boolean);

  // Apply robust 5-criteria filters: Service Type, Block, Floor, Status, Date
  const filteredComplaints = complaints.filter(c => {
    // 1. Service Type filter
    if (filterServiceType !== 'all' && c.service_type?.toLowerCase() !== filterServiceType.toLowerCase()) return false;
    
    // 2. Block filter
    if (filterBlock !== 'all' && c.block?.toLowerCase() !== filterBlock.toLowerCase()) return false;
    
    // 3. Floor filter
    if (filterFloor !== 'all' && c.floor !== filterFloor) return false;
    
    // 4. Status filter (can be customized, but partitioned tabs usually separate them first)
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;

    // Filter by partition active state
    if (activeTab === 'available') {
      return c.status === 'pending';
    } else if (activeTab === 'active') {
      return c.status === 'accepted' || c.status === 'in_progress';
    } else if (activeTab === 'completed') {
      return c.status === 'completed';
    }
    
    return true;
  }).sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return filterDateSort === 'latest' ? db - da : da - db;
  });

  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      
      {/* Profile Metrics and Clock-In Panel */}
      <div className="glass-effect p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-indigo-650 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
              SecureSociety Worker Pass
            </span>
            {isClockedIn && (
              <span className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded uppercase border border-emerald-100">
                Gate Active
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight">{user.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-semibold">
            <span className="bg-amber-100 text-amber-800 px-3 py-1 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-wider">
              👷 Certified {user.skill_type || 'General'}
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 font-bold">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> {user.phone || '+1 (555) 012-3456'}
            </span>
            {profileMetrics && (
              <span className="flex items-center gap-1 text-slate-700 bg-slate-100 border px-2 py-0.5 rounded-lg font-extrabold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {profileMetrics.rating} ★ ({profileMetrics.ratings_count} rates)
              </span>
            )}
          </div>
        </div>

        {/* Dispatch Clock In Indicator */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-6 min-w-[240px]">
          <div>
            <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">Security Shift Logging</span>
            {isClockedIn ? (
              <div className="space-y-0.5">
                <span className="text-xs font-black text-emerald-650 flex items-center gap-1 mt-1">
                  <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" /> Checked In
                </span>
                <span className="text-[9px] text-slate-400 block font-semibold">{clockInTime}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-extrabold block mt-1">Shift Offline</span>
            )}
          </div>
          {!isClockedIn ? (
            <button
              onClick={handleClockIn}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              Clock In Shift
            </button>
          ) : (
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50 px-2 py-1.5 rounded-lg border">
              Logged
            </div>
          )}
        </div>
      </div>

      {/* Partitions Tabs Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-0.5">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'available' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📋 Available Board ({complaints.filter(c => c.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'active' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🛡️ Active Jobs ({complaints.filter(c => c.assigned_worker_id === user.id && c.status !== 'completed').length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'completed' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ✅ My Resolved Archive ({complaints.filter(c => c.assigned_worker_id === user.id && c.status === 'completed').length})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'reviews' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⭐️ Reviews & Comments Feed ({profileMetrics?.reviews?.length || 0})
          </button>
        </div>

        <button 
          onClick={fetchWorkerData} 
          className="p-2 border text-slate-500 hover:text-slate-800 rounded-xl bg-white hover:bg-slate-50 shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-bold"
          title="Refresh Workorders Board"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Board</span>
        </button>
      </div>

      {/* MULTI-CRITERIA FILTERING PANEL (Required: Service Type, Block, Floor, Status, Date) */}
      {activeTab !== 'reviews' && (
        <div className="bg-white border rounded-2xl p-4 shadow-sm grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* 1. Skill/Service Type Department */}
          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Service Type</label>
            <select
              value={filterServiceType}
              onChange={(e) => setFilterServiceType(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border p-2 rounded-lg text-slate-700 cursor-pointer focus:ring-1 focus:ring-slate-900 outline-none"
            >
              <option value="all">All Service types</option>
              <option value="Electrician">Electricians</option>
              <option value="Plumber">Plumbers</option>
              <option value="Carpenter">Carpenters</option>
              <option value="Other">Other / General</option>
            </select>
          </div>

          {/* 2. Block Filter */}
          <div className="space-y-1">
            <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Apartment Block</label>
            <select
              value={filterBlock}
              onChange={(e) => setFilterBlock(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border p-2 rounded-lg text-slate-700 cursor-pointer focus:ring-1 focus:ring-slate-900 outline-none"
            >
              <option value="all">All Blocks</option>
              {uniqueBlocks.map(b => (
                <option key={b} value={b}>Block {b}</option>
              ))}
              <option value="A">Block A</option>
              <option value="B">Block B</option>
              <option value="C">Block C</option>
            </select>
          </div>

          {/* 3. Floor Filter */}
          <div className="space-y-1">
            <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Floor Level</label>
            <select
              value={filterFloor}
              onChange={(e) => setFilterFloor(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border p-2 rounded-lg text-slate-700 cursor-pointer focus:ring-1 focus:ring-slate-900 outline-none"
            >
              <option value="all">All Floors</option>
              {uniqueFloors.map(f => (
                <option key={f} value={f}>Floor {f}</option>
              ))}
              <option value="1">1st Floor</option>
              <option value="2">2nd Floor</option>
              <option value="3">3rd Floor</option>
              <option value="4">4th Floor</option>
            </select>
          </div>

          {/* 4. Status Filter */}
          <div className="space-y-1">
            <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Status Step</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border p-2 rounded-lg text-slate-700 cursor-pointer focus:ring-1 focus:ring-slate-900 outline-none"
            >
              <option value="all">Any Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* 5. Date Sort */}
          <div className="space-y-1">
            <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Filing Date</label>
            <select
              value={filterDateSort}
              onChange={(e: any) => setFilterDateSort(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border p-2 rounded-lg text-slate-700 cursor-pointer focus:ring-1 focus:ring-slate-900 outline-none"
            >
              <option value="latest">Latest First</option>
              <option value="earliest">Earliest First</option>
            </select>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      {loading ? (
        <div className="flex justify-center items-center py-24 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-xs font-bold">Synchronizing shift ledger...</span>
        </div>
      ) : activeTab === 'reviews' ? (
        /* REVIEWS CABINET LIST */
        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 font-display tracking-tight">
              <MessageSquare className="w-5 h-5 text-indigo-550" />
              Resident Ratings & Verification History
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">Audit log of customer satisfaction stars and review comments left by flat homeowners.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Average Star Rating</span>
              <strong className="text-3xl font-extrabold text-slate-900 font-display">
                {profileMetrics?.rating || '5.0'}
              </strong>
              <div className="flex justify-center gap-0.5 mt-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-4 h-4 ${(profileMetrics?.rating || 5) > i ? 'fill-amber-400 text-amber-500' : 'text-slate-200'}`} 
                  />
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center col-span-2 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Feedback Policy</span>
              <p className="text-xs text-slate-600 leading-relaxed font-semibold max-w-md mx-auto">
                Ratings are collected automatically from residents' secure dashboards upon mark of task resolution. Feedback score forms a baseline for certification renewals.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {!profileMetrics?.reviews || profileMetrics.reviews.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-dashed rounded-xl">
                <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold">No feedback reviews recorded yet.</p>
              </div>
            ) : (
              profileMetrics.reviews.slice().reverse().map((rev, index) => (
                <div key={index} className="p-4 bg-slate-50/50 border rounded-xl hover:border-slate-300 transition duration-150 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <strong className="text-slate-800 text-xs font-black block">{rev.residentName}</strong>
                      <span className="text-[10px] text-slate-400 font-bold">{rev.date}</span>
                    </div>
                    <div className="flex gap-0.5 bg-white border px-2 py-0.5 rounded-lg items-center shadow-xs">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span className="text-xs font-extrabold text-slate-700">{rev.rating}/5</span>
                    </div>
                  </div>
                  {rev.comment ? (
                    <p className="text-xs text-slate-700 leading-relaxed font-medium capitalize select-all italic bg-white p-3 rounded-lg border border-slate-100">
                      "{rev.comment}"
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No detailed remarks provided with this rating.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* WORKORDERS BOARD CONTAINER */
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-100 px-4 py-2.5 rounded-xl text-slate-700 text-xs font-bold tracking-wide">
            <span>Result matching active partition filters: {filteredComplaints.length} tickets</span>
            <span className="text-[10px] uppercase text-indigo-650 bg-indigo-50 border border-indigo-100 px-2 rounded">
              Current Skill Category: {user.skill_type}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredComplaints.length === 0 ? (
              <div className="col-span-2 text-center py-20 bg-white border border-dashed rounded-2xl p-6">
                <Compass className="w-10 h-10 text-slate-350 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700">No complaints found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                  There are currently no repair requests matching your exact status or criteria here. Make sure to toggle filters or change categories if you're looking for global list.
                </p>
              </div>
            ) : (
              filteredComplaints.map((job) => (
                <div 
                  key={job.id} 
                  className={`border rounded-2xl p-5 bg-white relative hover:shadow-lg transition-all duration-200 space-y-4 flex flex-col justify-between ${
                    job.assigned_worker_id === user.id ? 'border-indigo-400 shadow-md shadow-indigo-100/50' : 'border-slate-205'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Header ID & Status */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold bg-slate-100 select-all border text-slate-800 px-2.5 py-0.5 rounded-md uppercase text-[10px]">
                          TKT-{job.id}
                        </span>
                        <span className={`status-pill uppercase text-[9px] font-black tracking-wider px-2 py-0.5 rounded border ${
                          job.status === 'completed' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                            : job.status === 'in_progress'
                            ? 'bg-sky-50 text-sky-800 border-sky-100 animate-pulse'
                            : 'bg-indigo-50 text-indigo-800 border-indigo-101'
                        }`}>
                          {job.status}
                        </span>
                      </div>

                      {/* Display Created Date */}
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase tracking-wide">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Complaint Category and description text */}
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        🔧 {job.service_type} Maintenance
                      </h4>
                      <p className="text-xs text-slate-650 leading-relaxed font-semibold italic bg-slate-50/50 p-3.5 rounded-xl border border-slate-100/50 mt-1.5">
                        "{job.description}"
                      </p>
                    </div>

                    {/* Apartment Details Box */}
                    <div className="bg-slate-50 border p-3 rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-200 text-slate-700 font-black text-[9px] rounded-full flex items-center justify-center uppercase shrink-0">
                            {job.resident_name?.substring(0, 2) || 'R'}
                          </div>
                          <span className="font-extrabold text-slate-800">{job.resident_name}</span>
                        </div>
                        <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1.5 rounded uppercase font-bold border">Resident</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] font-bold text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          Block {job.block}
                        </span>
                        <span>Floor {job.floor}</span>
                        <span className="text-right">Flat {job.door_no}</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational flow controls depending on status */}
                  <div className="pt-2">
                    {/* Tab 1 Available pending check: Clicking Accept immediately claims job */}
                    {job.status === 'pending' && (
                      <div className="space-y-2 border-t pt-3">
                        <div className="text-[10px] text-indigo-650 font-bold flex items-center gap-1 bg-indigo-50/70 p-2 rounded-lg border border-indigo-100">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse text-indigo-600" />
                          <span>This ticket requires immediate {job.service_type} department skill. First technician to accept claims the job order.</span>
                        </div>
                        
                        <button
                          onClick={() => handleRespondJob(job.id, 'accept')}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-3 bg-slate-900 border border-transparent text-white font-extrabold text-xs rounded-xl shadow-md hover:bg-slate-850 active:scale-95 transition duration-150 cursor-pointer uppercase tracking-wider"
                        >
                          <Check className="w-4 h-4" />
                          Accept Complaint & Lock-In ID
                        </button>
                      </div>
                    )}

                    {/* Tab 2 Active Accepted status: Generates secure QR badge pass and awaits resident scans */}
                    {job.status === 'accepted' && (
                      <div className="space-y-3.5 border-t pt-3.5">
                        
                        <div className="flex gap-2">
                          {/* Option to Release Task */}
                          <button
                            onClick={() => handleRespondJob(job.id, 'reject')}
                            className="bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-750 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition active:scale-95 flex items-center justify-center gap-1"
                            title="Release this complaint back to other technicians"
                          >
                            <X className="w-4 h-4" />
                            Release Job
                          </button>

                          {/* Present entry QR Code Badge key pass to occupants */}
                          <button
                            onClick={() => handleShowQR(job)}
                            className="flex-1 bg-indigo-650 hover:bg-indigo-750 border border-transparent text-white font-extrabold text-xs py-2.5 rounded-xl shadow-md cursor-pointer transition active:scale-95 flex items-center justify-center gap-1.5 animate-pulse"
                          >
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            Display Security Pass QR
                          </button>
                        </div>

                        {/* Resident scanner gate warnings */}
                        {job.verification_status === 'pending' ? (
                          <div className="bg-amber-50 border border-amber-150 rounded-xl p-3 text-[10px] text-amber-800 font-extrabold leading-normal flex gap-1.5 items-center">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 animate-bounce" />
                            <span>ENTRY PASS PENDING: Resident must scan and click 'Allow Entry' from their dashboard before you can start.</span>
                          </div>
                        ) : job.verification_status === 'rejected' ? (
                          <div className="bg-rose-50 border border-rose-150 rounded-xl p-3 text-[10px] text-rose-800 font-extrabold leading-normal">
                            🛑 LOCK SECURITY DENIED. Homeowner rejected your entry ticket pass. Exit apartment immediately.
                          </div>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 text-[10px] text-emerald-800 font-extrabold leading-normal flex items-center gap-1.5">
                            <BadgeCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0 animate-bounce" />
                            ENTRY VALIDATED! Flat entry pass verification successful. Tap below to begin repair work.
                          </div>
                        )}

                        {job.verification_status === 'verified' && (
                          <button
                            onClick={() => handleUpdateStatus(job.id, 'in_progress')}
                            className="w-full inline-flex items-center justify-center gap-1 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition duration-150 cursor-pointer uppercase tracking-wider"
                          >
                            <Play className="w-4 h-4" /> Start Active Work
                          </button>
                        )}
                      </div>
                    )}

                    {/* Tab 2 Active In Progress: displays execution logs check and resolves repair */}
                    {job.status === 'in_progress' && (
                      <div className="space-y-3.5 border-t pt-3.5 animate-fadeIn">
                        <div className="bg-sky-50 border border-sky-100 p-3 rounded-lg text-sky-850 text-[10px] uppercase font-black flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-sky-600 rounded-full animate-ping mr-1"></span>
                          Repair Work in Progress inside Unit flat
                        </div>

                        <button
                          onClick={() => handleUpdateStatus(job.id, 'completed')}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-3 bg-emerald-650 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition duration-150 cursor-pointer uppercase tracking-wider"
                        >
                          <CheckSquare className="w-4 h-4" /> Mark as Repair Resolved
                        </button>
                      </div>
                    )}

                    {/* Tab 3 Completed archive check */}
                    {job.status === 'completed' && (
                      <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-150 text-xs font-semibold flex items-center justify-between border-t pt-3">
                        <span className="font-bold flex items-center gap-1">
                          <BadgeCheck className="w-4.5 h-4.5 text-emerald-600" /> Job Completed successfully
                        </span>
                        {job.rating && (
                          <span className="font-extrabold flex items-center gap-1 text-amber-500 bg-white border px-2.5 py-1 rounded-lg text-[11px] shadow-sm">
                            ★ {job.rating} ★
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

      {/* SECURE PASS QR CODE MODAL POPUP DIALOG */}
      {activeQRJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-sm w-full shadow-2xl p-6 text-white relative">
            <button 
              onClick={() => setActiveQRJob(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-1 bg-indigo-500/10 px-3 py-1 rounded-full text-indigo-405 font-black text-[9px] uppercase tracking-wider border border-indigo-500/20">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Security Entrance key pass
              </div>
              <h3 className="text-base font-extrabold tracking-tight font-display">Scan Identity Ticket Code</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
                Present this digital gate pass to the occupant of <b>Block {activeQRJob.block}, flat {activeQRJob.door_no}</b>. Residents will scan this to run credentials verification.
              </p>

              {/* QR Image with elegant background scan-lines */}
              <div className="bg-white p-5 rounded-2xl inline-block mx-auto border-2 border-slate-850 shadow-inner relative overflow-hidden">
                <div className="absolute inset-0.5 rounded-2xl bg-gradient-to-tr from-slate-100 to-white/0 opacity-15 pointer-events-none"></div>
                {qrLoading ? (
                  <div className="w-40 aspect-square flex flex-col items-center justify-center text-slate-900 text-xs font-bold relative z-10">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-650 mb-1.5" />
                    Generating QR pass Code...
                  </div>
                ) : qrCodeURI ? (
                  <img 
                    src={qrCodeURI} 
                    alt="Gate Entry QR" 
                    className="w-40 h-40 object-contain block mx-auto relative z-10 select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-40 aspect-square flex items-center text-slate-400 text-[10px] p-2 leading-relaxed justify-center relative z-10">
                    QR build error. Ensure internet connection is active.
                  </div>
                )}
              </div>

              {/* Secure QR Decoded payload metrics */}
              {qrPayload && (
                <div className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-xl text-left space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center text-[9px] text-slate-450 border-b border-slate-800 pb-1.5 font-sans font-bold">
                    <span>SECTOR: {qrPayload.serviceType.toUpperCase()}</span>
                    <span>TICKET: #{qrPayload.requestId}</span>
                  </div>

                  <div className="space-y-1.5 text-slate-350">
                    <p className="flex justify-between">
                      <span className="text-slate-500 text-[11px] font-sans">Worker:</span>
                      <strong className="text-white font-bold text-[11px] font-sans">{qrPayload.workerName}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-500 text-[11px] font-sans">Telephone:</span>
                      <span className="text-slate-300 font-sans">{qrPayload.phoneNumber}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-500 text-[11px] font-sans">Expires At:</span>
                      <span className="text-amber-400 font-black font-sans">{new Date(qrPayload.expiresAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-500 leading-normal max-w-xs mx-auto font-medium">
                Pass code expires 1 hour from generation. Signature: cryptographically verified by Smart Society Gate.
              </p>

              <button
                type="button"
                onClick={() => setActiveQRJob(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer uppercase tracking-wider"
              >
                Close Ticket pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
