import React, { useState, useEffect } from 'react';
import { User } from './types';
import AuthPage from './components/AuthPage';
import ResidentDashboard from './components/ResidentDashboard';
import WorkerDashboard from './components/WorkerDashboard';
import AdminDashboard from './components/AdminDashboard';
import { 
  ShieldCheck, LogOut, HeartHandshake, Bell, Shield, 
  MapPin, Landmark, Phone, HelpCircle, Flame, CheckCircle, 
  Sparkles, ListCollapse, Home, Wrench, ShieldAlert 
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [panicActive, setPanicActive] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load user session on boot
  useEffect(() => {
    const saved = localStorage.getItem('securesociety_user');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (err) {
        localStorage.removeItem('securesociety_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('securesociety_user', JSON.stringify(user));
    setCurrentUser(user);
    setPanicActive(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('securesociety_user');
    setCurrentUser(null);
    setPanicActive(false);
  };

  const triggerPanic = () => {
    setPanicActive(true);
    // Auto calm-down panic after 15 seconds
    setTimeout(() => {
      setPanicActive(false);
    }, 15000);
  };

  const getRoleHeaderBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'worker':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-emerald-105 text-emerald-800 border-emerald-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-xs font-semibold font-mono">
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping mr-2"></span>
        SecureSociety gate booting up...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      
      {/* SIDEBAR NAVIGATION - VISIBLE WHEN LOGGED IN AND ON MEDIUM SCREENS UP */}
      {currentUser && (
        <aside className="hidden lg:flex w-64 bg-slate-900 flex-col border-r border-slate-800 text-slate-400 shrink-0">
          
          {/* Logo Brand */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800/60">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-white font-extrabold text-lg tracking-tight font-display">SecureSociety</span>
          </div>

          {/* Menus by Role */}
          <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
            {currentUser.role === 'resident' && (
              <div className="space-y-1">
                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest px-2 mb-2">Resident Menu</div>
                <button className="w-full flex items-center gap-3 px-3 py-2 bg-emerald-500/10 text-emerald-450 rounded-lg font-bold text-xs text-left transition-colors">
                  <Home className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Interactive Dashboard</span>
                </button>
                <div className="text-[10px] text-slate-450 p-2.5 leading-normal bg-slate-800/40 rounded-xl mt-4 font-medium border border-slate-800">
                  <span className="text-white font-bold block mb-0.5">Quick Hint</span> Create tickets on the panel, and let AI provide preventive checks.
                </div>
              </div>
            )}

            {currentUser.role === 'worker' && (
              <div className="space-y-1">
                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest px-2 mb-2">Technician Cabinet</div>
                <button className="w-full flex items-center gap-3 px-3 py-2 bg-amber-500/10 text-amber-505 rounded-lg font-bold text-xs text-left transition-colors">
                  <Wrench className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Assigned Workorders</span>
                </button>
                <div className="text-[10px] text-slate-450 p-2.5 leading-normal bg-slate-800/40 rounded-xl mt-4 font-medium border border-slate-800">
                  <span className="text-white font-bold block mb-0.5">Safety Rule</span> Generate secure entrance QR code passes for resident scanners.
                </div>
              </div>
            )}

            {currentUser.role === 'admin' && (
              <div className="space-y-1">
                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest px-2 mb-2">Command Center</div>
                <button className="w-full flex items-center gap-3 px-3 py-2 bg-purple-500/10 text-purple-400 rounded-lg font-bold text-xs text-left transition-colors">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-purple-400" />
                  <span>Scribe Operations</span>
                </button>
                <div className="text-[10px] text-slate-450 p-2.5 leading-normal bg-slate-800/40 rounded-xl mt-4 font-medium border border-slate-800">
                  <span className="text-white font-bold block mb-0.5">Control Info</span> Route dispatches based on technician certifications & workloads.
                </div>
              </div>
            )}

            {/* External Links Info */}
            <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-500 space-y-1.5 px-2">
              <span className="flex items-center gap-1.5 transition hover:text-slate-300">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Gate Server: Connected
              </span>
              <span className="flex items-center gap-1.5 transition hover:text-slate-300">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span> Security Encryption Activated
              </span>
            </div>
          </nav>

          {/* EMERGENCY CARD */}
          <div className="p-4 mt-auto border-t border-slate-800/40">
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-750 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Emergency Help</div>
              <div className="text-sm font-semibold text-white flex items-center gap-1.5 justify-between">
                <span>Guard Desk hotline:</span>
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-xs">108</span>
              </div>
              <button 
                onClick={triggerPanic}
                className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors shadow-md hover:shadow-rose-600/15"
              >
                Panic SOS Button
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* RIGHT SIDE VIEWPORT WRAPPERS */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        
        {/* UPPER DASHBOARD HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-20">
          
          <div className="flex items-center gap-4">
            {/* Embedded Logo for small screens where side-bar is hidden */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-500 rounded flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 border-r pr-3">SecureSociety</span>
            </div>

            {currentUser ? (
              <div className="flex items-center gap-3">
                <h1 className="text-sm sm:text-base font-bold text-slate-850">
                  Welcome back, <span className="text-slate-950 font-extrabold font-display">{currentUser.name}</span>
                </h1>
                <div className="hidden sm:block h-4 w-px bg-slate-200"></div>
                <span className="hidden sm:inline-flex items-center gap-1 text-slate-500 text-xs font-medium">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  {currentUser.role === 'resident' 
                    ? `Block ${currentUser.block}, Flat ${currentUser.door_no}`
                    : currentUser.role === 'worker'
                    ? `${currentUser.skill_type || 'General'} Tech Department`
                    : 'Administration Headquarters'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-650 animate-pulse" />
                <span className="text-sm font-bold text-slate-855 font-display">SecureSociety Gate Console</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Quick emergency Panic trigger button for Mobile / Logged-out views */}
            {currentUser && (
              <button
                onClick={triggerPanic}
                title="Trigger immediate Gate Help desk emergency"
                className="lg:hidden p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition duration-150 active:scale-95"
              >
                <Flame className="w-4 h-4" />
              </button>
            )}

            {/* Notification Bell Badge with Active-ring */}
            {currentUser && (
              <div className="relative">
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full active-ring"></div>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded-xl transition duration-150 relative cursor-pointer"
                >
                  <Bell className="w-5 h-5" />
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
                    <div className="border-b pb-2 mb-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">Alerts Ledger</span>
                      <span className="text-[9px] uppercase font-bold text-slate-400">Real-Time</span>
                    </div>
                    <div className="space-y-2.5 text-xs text-slate-600">
                      <div className="p-2 bg-slate-50 rounded-lg flex gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1 shrink-0"></span>
                        <p>Gate access verification logging active. Always scan worker QR codes before letting them enter your flat.</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg flex gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-505 rounded-full mt-1 shrink-0"></span>
                        <p>AI troubleshooting models synced with direct society logs.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2.5">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name || 'Felix'}`} 
                  className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" 
                  alt="Profile"
                />
                
                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-rose-600 rounded-xl transition shadow-sm bg-white cursor-pointer"
                  title="Logout of current secure session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-semibold bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                <Landmark className="w-4 h-4 text-emerald-600" /> Block Gated Community
              </div>
            )}
          </div>
        </header>

        {/* SEC_EMERGENCY_SOS_PANEL_TOP (Interactive state) */}
        {panicActive && currentUser && (
          <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg font-sans relative overflow-hidden animate-in duration-300">
            <div className="absolute top-0 right-0 p-10 bg-white/5 rounded-full filter blur-xl scale-150"></div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="p-2 bg-white/10 rounded-xl">
                <Flame className="w-5 h-5 text-amber-300 animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-200 block">BROADCASTED SOS PATROL</span>
                <h4 className="text-sm font-bold tracking-tight">
                  Emergency Alert Signal Dispatched for Unit: Block {currentUser.block || 'A'} - {currentUser.door_no || 'Manual'}!
                </h4>
                <p className="text-xs text-rose-100 font-medium">
                  Main guard station 108 dialed securely on behalf of {currentUser.name}. Response vehicle mobilized to doorstep immediately.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setPanicActive(false)}
              className="text-white hover:text-amber-100 font-bold text-xs uppercase bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl border border-white/10 shrink-0 cursor-pointer"
            >
              Cancel Alert
            </button>
          </div>
        )}

        {/* WORKSPACE SCROLL CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentUser ? (
            <div className="animate-in max-w-7xl mx-auto w-full">
              {currentUser.role === 'resident' && (
                <ResidentDashboard user={currentUser} onRefreshProfiles={loadAdminSessionUpdates} />
              )}
              {currentUser.role === 'worker' && (
                <WorkerDashboard user={currentUser} />
              )}
              {currentUser.role === 'admin' && (
                <AdminDashboard user={currentUser} />
              )}
            </div>
          ) : (
            <div className="py-8 sm:py-12 flex justify-center items-center h-full min-h-[450px]">
              <AuthPage onLoginSuccess={handleLoginSuccess} />
            </div>
          )}
        </main>

        {/* SITE FOOTER */}
        <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-slate-400 text-[11px] font-semibold tracking-wide font-sans shrink-0 uppercase">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>
              © 2026 SecureSociety Platform. Built for smart gated spaces & guard modules.
            </span>
            <div className="flex gap-4">
              <span className="hover:text-slate-600 cursor-help" title="Cryptographically linked verification log">QR Secure System Verified</span>
              <span className="hover:text-slate-600">Standard Terms</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );

  function loadAdminSessionUpdates() {
    // Session state sync callback inside society ledger
  }
}

