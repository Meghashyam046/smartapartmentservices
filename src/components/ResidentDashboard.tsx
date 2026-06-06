import React, { useState, useEffect } from 'react';
import { User, Complaint } from '../types';
import {  
  AlertTriangle, Hammer, Wrench, Sparkles, Send, CheckCircle, 
  Clock, Scan, ArrowRight, Star, HeartHandshake, ShieldAlert, X
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface ResidentDashboardProps {
  user: User;
  onRefreshProfiles: () => void;
}
const API_URL = "https://securesociety-smart-apartment-service.onrender.com";

export default function ResidentDashboard({ user, onRefreshProfiles }: ResidentDashboardProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Complaint form state
  const [serviceType, setServiceType] = useState<'Electrician' | 'Plumber' | 'Carpenter' | 'Other'>('Electrician');
  const [description, setDescription] = useState('');
  const [block, setBlock] = useState(user.block || 'A');
  const [floor, setFloor] = useState(user.floor || '1');
  const [doorNo, setDoorNo] = useState(user.door_no || '101');

  // AI safety guidelines state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  // QR scanner states
  const [scanningComplaint, setScanningComplaint] = useState<Complaint | null>(null);
  const [qrDetails, setQrDetails] = useState<any | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Rating States
  const [ratingComplaint, setRatingComplaint] = useState<Complaint | null>(null);
  const [selectedStars, setSelectedStars] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  const loadComplaints = () => {
fetch(`${API_URL}/api/complaints/resident`, {
      headers: { 'Authorization': `Bearer ${user.id}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then(data => setComplaints(data.reverse()))
      .catch(err => console.error('Failed to load complaints', err));
  };

  useEffect(() => {
    loadComplaints();
    // Poll complaints every 8 seconds for real-time secure status progression
    const interval = setInterval(loadComplaints, 8000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Please specify some details of the maintenance problem.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setErrorMsg('');

    try {
      const response = await fetch(`${API_URL}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({
          service_type: serviceType,
          description,
          block,
          floor,
          door_no: doorNo
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to place complaint');
      }

      setMessage('Complaint raised successfully!');
      setDescription('');
      setAiAdvice(null);
      loadComplaints();
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failure');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe server-side Gemini advice
  const fetchAIDiagnosis = async () => {
    if (!description.trim()) {
      setErrorMsg('Please type the description of your issue first to get AI troubleshooting support!');
      return;
    }
    setAiLoading(true);
    setAiAdvice(null);
    try {
      const response = await fetch(`${API_URL}/api/ai/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({
          description,
          service_type: serviceType
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAiAdvice(data.diagnostic);
      } else {
        setAiAdvice(`Safety Tip: Carefully inspect the ${serviceType} leak or socket, isolate the line, and wait for professional technician.`);
      }
    } catch (e) {
      setAiAdvice('Safety Standard Tip: Isolate water/electric valves immediately and protect nearby furnishings.');
    } finally {
      setAiLoading(false);
    }
  };

  // Launch QR scanner modal
  const handleOpenScanner = (complaint: Complaint) => {
    setScanningComplaint(complaint);
    setQrDetails(null);
    setManualCode('');
    setCameraError(null);

    // Initialize scanner asynchronously
    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'qr-reader-element',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render(
          (decodedText) => {
            try {
              const details = JSON.parse(decodedText);
              if (details.requestId === complaint.id) {
                setQrDetails(details);
                scanner.clear();
              } else {
                alert(`This QR code belongs to complaint ID ${details.requestId}. It is invalid for current repair #${complaint.id}`);
              }
            } catch (err) {
              // Not a JSON format but plain text string, show raw
              setQrDetails({
                requestId: complaint.id,
                workerName: complaint.assigned_worker_name,
                phoneNumber: complaint.assigned_worker_phone,
                serviceType: complaint.service_type,
                rawText: decodedText
              });
              scanner.clear();
            }
          },
          (errorMessage) => {
            // Quiet log to prevent console spam
          }
        );

        // Keep a ref to scanner to clear on unmount/close
        (window as any).currScanner = scanner;
      } catch (err: any) {
        setCameraError(err.message || 'Webcam access denied or unavailable.');
      }
    }, 100);
  };

  const handleCloseScanner = () => {
    if ((window as any).currScanner) {
      try {
        (window as any).currScanner.clear();
      } catch (e) {}
    }
    setScanningComplaint(null);
    setQrDetails(null);
  };

  // Simulate scanning of QR (Retrieving the backend worker QR log details directly)
  const handleSimulateQRScan = async () => {
    if (!scanningComplaint) return;
    try {
      const response = await fetch(
  `${API_URL}/api/complaints/${scanningComplaint.id}/qr-code`,
  {
        headers: { 'Authorization': `Bearer ${user.id}` }
      });
      const data = await response.json();
      if (response.ok && data.rawPayload) {
        setQrDetails(data.rawPayload);
      } else {
        alert('Could not simulate scan. Has the assigned worker accepted this job first?');
      }
    } catch (e) {
      alert('Simulation failed to fetch QR details.');
    }
  };

  // Verify Worker verification flow
  const handleVerifyWorker = async (status: 'verified' | 'rejected') => {
    if (!scanningComplaint) return;
    try {
      const res = await fetch(
  `${API_URL}/api/complaints/${scanningComplaint.id}/verify-worker`,
  {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({ status })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Worker security verification processed as: ${status.toUpperCase()}`);
      handleCloseScanner();
      loadComplaints();
    } catch (err: any) {
      alert(err.message || 'Failed to submit verification status');
    }
  };

  // Submit Feedback Rating
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingComplaint) return;

    try {
      const res = await fetch(
  `${API_URL}/api/complaints/${ratingComplaint.id}/feedback`,
  {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({
          rating: selectedStars,
          comment: feedbackComment
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('Thank you for rating our society service!');
      setRatingComplaint(null);
      setSelectedStars(5);
      setFeedbackComment('');
      onRefreshProfiles(); // Refresh scores on profile Switch bar
      loadComplaints();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'in_progress': return 'bg-sky-50 text-sky-700 border-sky-100 animate-pulse';
      case 'accepted': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'assigned': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Electrician': return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'Plumber': return <Wrench className="w-4 h-4 text-indigo-600" />;
      default: return <Hammer className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header and User Profile banner */}
      <div className="glass-effect p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold text-indigo-650 uppercase tracking-widest block mb-1">Resident Area</span>
          <h1 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight">Welcome, {user.name}</h1>
          <p className="text-xs text-slate-500 font-semibold tracking-wide mt-0.5">
            Apartment Unit: Block {user.block}, Floor {user.floor}, Door No. {user.door_no}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-slate-900 rounded-xl text-center shadow-lg shadow-slate-900/10 min-w-24">
            <span className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Open Issues</span>
            <span className="text-base font-extrabold text-white">
              {complaints.filter(c => c.status !== 'completed').length}
            </span>
          </div>
          <div className="px-4 py-2 bg-white border border-slate-205 rounded-xl text-center shadow-sm min-w-24">
            <span className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Resolved Tasks</span>
            <span className="text-base font-extrabold text-slate-900">
              {complaints.filter(c => c.status === 'completed').length}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Create Complaint Form */}
        <div className="lg:col-span-12 xl:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            File New Maintenance Complaint
          </h2>

          <form onSubmit={handleSubmitComplaint} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Service Department Needed</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as any)}
                className="w-full text-xs bg-slate-50/80 border border-slate-200 p-3 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer font-bold tracking-wide"
              >
                <option value="Electrician">🔌 Electrician Department</option>
                <option value="Plumber">🚰 Plumber Department</option>
                <option value="Carpenter">🪚 Carpenter Department</option>
                <option value="Other">🛠️ Other General Maintenance</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Problem Description</label>
                <button
                  type="button"
                  onClick={fetchAIDiagnosis}
                  disabled={aiLoading || !description.trim()}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-650 hover:text-indigo-850 disabled:text-slate-350 font-extrabold transition-all duration-150 uppercase tracking-wider"
                >
                  
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specify failure symptoms (e.g., bathroom mixer faucet leaking, bedroom master switch sparking, ceiling fan humming loudly)"
                className="w-full text-xs border border-slate-200 p-3.5 rounded-lg min-h-24 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-transparent font-medium leading-relaxed"
              />
            </div>

            {/* Locked default apartment detail but allow custom overrides if needed */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100/60">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-450 mb-0.5">Block</label>
                <input
                  type="text"
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-205 px-2 py-1.5 rounded text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-450 mb-0.5">Floor</label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-205 px-2 py-1.5 rounded text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-450 mb-0.5">Door No</label>
                <input
                  type="text"
                  value={doorNo}
                  onChange={(e) => setDoorNo(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-205 px-2 py-1.5 rounded text-slate-800 font-bold"
                />
              </div>
            </div>

            {message && <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 font-semibold">{message}</p>}
            {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100 font-semibold">{errorMsg}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-lg text-xs font-bold shadow-md transition-all duration-150 active:scale-98 disabled:bg-slate-300 cursor-pointer uppercase tracking-wider"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Raising Ticket...' : 'File Complaint'}
            </button>
          </form>

          {/* AI Advice Output Bubble */}
          {(aiAdvice || aiLoading) && (
            <div className="bg-indigo-50/70 border border-indigo-100/60 rounded-xl p-4 mt-3 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-indigo-900 font-extrabold text-[10px] uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-550 shrink-0" />
                Gemini Troubleshooter Diagnostic Advice
              </div>
              {aiLoading ? (
                <div className="space-y-1.5 py-1">
                  <div className="h-3 bg-indigo-200/50 rounded animate-pulse w-3/4"></div>
                  <div className="h-3 bg-indigo-200/50 rounded animate-pulse w-5/6"></div>
                  <div className="h-3 bg-indigo-200/50 rounded animate-pulse w-1/2"></div>
                </div>
              ) : (
                <div className="text-xs text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap">
                  {aiAdvice}
                </div>
              )}
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                Safety Note: Verify main circuit breaker isolate checks prior to inspection.
              </div>
            </div>
          )}
        </div>

        {/* Complaints Tracking and Status Lifecycle */}
        <div className="lg:col-span-12 xl:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Registered Complaint History</h2>
            <button 
              onClick={loadComplaints} 
              className="text-xs font-bold text-indigo-600 hover:text-indigo-805 cursor-pointer uppercase tracking-wider"
            >
              Refresh Logs
            </button>
          </div>

          <div className="space-y-4 max-h-[580px] overflow-y-auto pr-2">
            {complaints.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <h4 className="text-sm font-bold text-slate-700">No active repair tickets raised</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                  Submit a query from the creation form. Our management desk registers incoming requests instantly for society workers.
                </p>
              </div>
            ) : (
              complaints.map((c) => (
                <div 
                  key={c.id} 
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/50 transition-all duration-150 gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded">
                          #TKT-{c.id}
                        </span>
                        <span className={`status-pill ${getStatusStyle(c.status)}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg w-fit">
                        {getIcon(c.service_type)}
                        <span>{c.service_type} Department</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                        "{c.description}"
                      </p>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Filed: {new Date(c.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Action checkpoints depending on Status */}
                  {c.status === 'pending' && (
                    <div className="bg-slate-50 px-3.5 py-3 rounded-lg border border-slate-100 text-slate-500 text-xs flex items-center gap-2.5 font-bold">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      Status: Pending Acceptance. The complaint has been sent to a worker and is awaiting acceptance.
                    </div>
                  )}

                  {(c.status === 'assigned' || c.status === 'accepted') && (
                    <div className="bg-slate-50 border border-slate-200/50 rounded-lg p-4 space-y-3">
                      
                      {/* Slick Profile card from Design HTML */}
                      <div className="flex gap-4 bg-white p-3 rounded-xl border border-slate-150 shadow-sm justify-between items-center">
                        <div className="flex gap-3">
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                            <img 
                              src={`https://api.dicebear.com/7.x/initials/svg?seed=${c.assigned_worker_name || 'Amir'}&backgroundColor=10b981`} 
                              className="w-full h-full" 
                              alt="Worker Profile"
                            />
                          </div>
                          <div>
                            <span className="block text-[8px] text-indigo-650 uppercase font-bold tracking-wider">Accepted by Worke</span>
                            <div className="text-xs font-black text-slate-800 leading-tight">
                              {c.assigned_worker_name || 'Amir Khan'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              📞 {c.assigned_worker_phone || '+1 (555) 019-2831'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold uppercase tracking-wider px-2 py-1 rounded border border-emerald-100">
                          Active Pass Verified
                        </span>
                      </div>

                      {c.status === 'assigned' && (
                        <div className="bg-amber-50 border border-amber-100 text-amber-805 p-2.5 rounded text-xs font-bold flex items-center gap-2 animate-fadeIn">
                          <Clock className="w-4 h-4 shrink-0 text-amber-500" />
                          Workorder queued. Contractor checking instructions before gate dispatch.
                        </div>
                      )}

                      {c.status === 'accepted' && (
                        <div className="bg-indigo-50 border border-indigo-100 text-indigo-805 p-3 rounded-lg space-y-2 animate-fadeIn">
                          <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900 uppercase tracking-wide">
                            <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
                            Safety Inspection Required
                          </div>
                          <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                            Worker is en route. For complete confidence, tap below and verify the digital QR badge displayed on the worker's device when they knock.
                          </p>
                          <button
                            onClick={() => handleOpenScanner(c)}
                            className="w-full inline-flex items-center justify-center gap-1.5 text-xs bg-slate-900 border border-transparent text-white font-bold py-2 rounded-lg hover:bg-slate-800 transition active:scale-95 cursor-pointer uppercase tracking-wider shadow"
                          >
                            <Scan className="w-3.5 h-3.5" />
                            Perform Secure QR Scan Check
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {c.status === 'in_progress' && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl text-xs space-y-1.5 animate-fadeIn">
                      <div className="font-extrabold flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        Technician Active in Unit (QR Access Match Verified)
                      </div>
                      <p className="text-[11px] text-emerald-700 font-semibold">
                        Worker verification stamp logged successfully. Worker is currently fixing issues inside your home.
                      </p>
                    </div>
                  )}

                  {c.status === 'completed' && (
                    <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                      <div>
                        {c.rating ? (
                          <div className="space-y-1">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`w-3.5 h-3.5 ${(c.rating && i < c.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                                />
                              ))}
                            </div>
                            {c.review && <p className="text-xs text-slate-500 italic font-medium">"{c.review}"</p>}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-600 font-bold flex items-center gap-1.5">
                            <HeartHandshake className="w-4 h-4 text-slate-500 shrink-0" />
                            Job processed. Please submit technician rating to finalize file.
                          </div>
                        )}
                      </div>
                      {!c.rating && (
                        <button
                          onClick={() => setRatingComplaint(c)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg active:scale-95 transition cursor-pointer uppercase tracking-wider shadow"
                        >
                          Provide Rating
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RATING MODAL POPUP */}
      {ratingComplaint && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border rounded-3xl max-w-md w-full shadow-2xl p-6 relative">
            <button 
              onClick={() => setRatingComplaint(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-2">Technician Satisfaction Rating</h3>
            <p className="text-xs text-slate-500 mb-4 font-normal">
              Please rate worker <b>{ratingComplaint.assigned_worker_name}</b> for solving complaint request #ID <b>{ratingComplaint.id}</b>.
            </p>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div className="flex flex-col items-center py-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-450 uppercase mb-2">Give Stars</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button
                      key={stars}
                      type="button"
                      onClick={() => setSelectedStars(stars)}
                      className="transition-transform active:scale-90"
                    >
                      <Star 
                        className={`w-8 h-8 ${stars <= selectedStars ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-extrabold text-amber-500 mt-2">
                  {selectedStars === 5 ? 'Exceptional Service' : selectedStars === 4 ? 'Great Service' : selectedStars === 3 ? 'Satisfactory' : selectedStars === 2 ? 'Needs Improvement' : 'Unsatisfactory'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Optional Feedback Comments</label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Share details about the technician's politeness, punctuality, and workmanship quality..."
                  className="w-full text-xs border border-slate-200 p-2.5 rounded-xl min-h-20 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-950 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRatingComplaint(null)}
                  className="px-4 py-2 border rounded-xl font-medium text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 border border-transparent hover:bg-slate-800 text-white font-bold rounded-xl shadow transition cursor-pointer"
                >
                  Submit Rating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR ENTRY VERIFICATION MODAL */}
      {scanningComplaint && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border rounded-3xl max-w-lg w-full shadow-2xl p-6 relative">
            <button 
              onClick={handleCloseScanner} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <Scan className="w-5 h-5 text-indigo-500 h" />
              Scan Entry Pass Checkpoint
            </h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-normal font-sans font-normal">
              Position the technician's SecureID QR code in your camera view or use our secure simulator below.
            </p>

            <div className="space-y-4">
              {/* Webcam Scanning Surface */}
              {!qrDetails && (
                <div className="border border-slate-200 bg-slate-50 rounded-2xl overflow-hidden p-4 flex flex-col items-center">
                  <div id="qr-reader-element" className="w-full max-w-xs aspect-square bg-black mb-3 rounded-lg overflow-hidden border border-slate-300"></div>
                  {cameraError && (
                    <div className="text-[10px] text-slate-500 px-3 py-1.5 text-center font-medium leading-relaxed bg-amber-50 rounded border border-amber-100 max-w-sm mb-2.5">
                      Webcam block detected. (Typical browser restriction inside sandboxed iframe). Please use the Sandbox Simulator below!
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSimulateQRScan}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 border border-transparent text-white font-bold text-xs rounded-xl shadow hover:bg-blue-700 hover:shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 hover:animate-spin" />
                    Sandbox Simulator: Scan QR Details
                  </button>
                </div>
              )}

              {/* Show decoded Verification Card */}
              {qrDetails ? (
                <div className="animate-in zoom-in-95 duration-200 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Security Gate pass</span>
                    <span className="px-2.5 py-0.5 text-[10px] uppercase font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">
                      Signature Verified
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-sans text-xs">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-450 font-bold">Worker Name</span>
                      <strong className="text-slate-800 text-sm">{qrDetails.workerName}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-450 font-bold">Phone Number</span>
                      <strong className="text-slate-800">{qrDetails.phoneNumber}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-450 font-bold">Category</span>
                      <strong className="text-slate-800">{qrDetails.serviceType}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-450 font-bold">Complaint ID</span>
                      <strong className="text-slate-500">#{qrDetails.requestId}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[10px] uppercase text-slate-450 font-bold">Destination Residence</span>
                      <strong className="text-slate-800">{qrDetails.apartmentDetails}</strong>
                    </div>
                    {qrDetails.expiresAt && (
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase text-slate-450 font-bold text-rose-500">Validity Window Expiry</span>
                        <strong className="text-rose-600 text-xs font-semibold">{new Date(qrDetails.expiresAt).toLocaleString()}</strong>
                      </div>
                    )}
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-slate-700 text-xs font-medium space-y-1">
                    <div className="text-indigo-900 font-bold">Resident Identity Attestation:</div>
                    <p className="text-[11px] text-indigo-700">
                      Does the technician's uniform and identity match the security details displayed on your screen?
                    </p>
                  </div>

                  <div className="flex gap-2.5 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleVerifyWorker('rejected')}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold p-3 rounded-xl transition duration-150 active:scale-95 cursor-pointer"
                    >
                      🚨 REJECT ENTRY
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyWorker('verified')}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 border-transparent text-white font-bold p-3 rounded-xl shadow-lg transition duration-150 active:scale-95 cursor-pointer animate-pulse"
                    >
                      🛡️ VERIFY & ALLOW ENTRY
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center font-medium font-sans text-xs text-slate-400 py-2">
                  Waiting for secure QR contents...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
