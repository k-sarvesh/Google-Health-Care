import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Activity, Shield, MapPin, RefreshCw, Layers, Database } from 'lucide-react';
import Forms from './components/Forms';
import { syncQueue } from './services/syncService';
import { getAllSyncItems } from './db/indexedDB';
import './index.css';

const ALL_PHCS = [
  { id: 'PHC-001', name: 'Central District Hospital', block: 'North Block' },
  { id: 'PHC-002', name: 'Green Valley PHC', block: 'North Block' },
  { id: 'PHC-003', name: 'Lakeview Clinic', block: 'South Block' },
  { id: 'PHC-004', name: 'Hilltop Health Center', block: 'East Block' },
  { id: 'PHC-005', name: 'Riverside Medical', block: 'West Block' },
  { id: 'PHC-006', name: 'Sunrise Care', block: 'North Block' },
  { id: 'PHC-007', name: 'Pine Grove Clinic', block: 'South Block' },
  { id: 'PHC-008', name: 'Maple Leaf Medical', block: 'East Block' },
  { id: 'PHC-009', name: 'Oaktree Health', block: 'West Block' },
  { id: 'PHC-010', name: 'Willow Branch Clinic', block: 'North Block' },
  { id: 'PHC-011', name: 'Cedar Point Center', block: 'South Block' },
  { id: 'PHC-012', name: 'Birchwood Health', block: 'East Block' },
  { id: 'PHC-013', name: 'Elm Street Clinic', block: 'West Block' },
  { id: 'PHC-014', name: 'Ash Grove Medical', block: 'North Block' },
  { id: 'PHC-015', name: 'Chestnut Care', block: 'South Block' },
  { id: 'PHC-016', name: 'Walnut Ridge Clinic', block: 'East Block' },
  { id: 'PHC-017', name: 'Spruce Hollow Health', block: 'West Block' },
  { id: 'PHC-018', name: 'Sycamore Medical', block: 'North Block' },
  { id: 'PHC-019', name: 'Magnolia Health', block: 'South Block' },
  { id: 'PHC-020', name: 'Dogwood Clinic', block: 'East Block' },
];

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [phcId, setPhcId] = useState('PHC-001');
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const selectedPHC = ALL_PHCS.find(p => p.id === phcId) || ALL_PHCS[0];

  const updatePendingCount = async () => {
    const items = await getAllSyncItems();
    setPendingCount(items.length);
  };

  const triggerManualSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    await syncQueue();
    await updatePendingCount();
    setTimeout(() => setSyncing(false), 600);
  };

  useEffect(() => {
    updatePendingCount();

    const handleOnline = async () => {
      setIsOnline(true);
      await syncQueue();
      await updatePendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      updatePendingCount();
      if (navigator.onLine) syncQueue();
    }, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col font-sans">
      
      {/* Sleek Dark KRAFT Header */}
      <header className="bg-[#111111] text-white border-b-2 border-neutral-800 sticky top-0 z-30 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border-2 border-white flex items-center justify-center transform rotate-45 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              <div className="transform -rotate-45 font-black tracking-widest text-[10px]">
                KRAFT
              </div>
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-[0.25em] text-white uppercase flex items-center gap-2">
                <span>Field Terminal</span>
                <span className="px-1.5 py-0.5 bg-red-600/80 text-white text-[9px] rounded font-mono">PWA-V4</span>
              </h1>
              <p className="text-[10px] text-neutral-400 mt-0.5 uppercase tracking-[0.2em] font-light">
                Rural Health Worker Sync Hub
              </p>
            </div>
          </div>

          {/* Status & Sync Badge */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={triggerManualSync}
              disabled={!isOnline || syncing}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded text-[10px] uppercase font-bold tracking-wider text-neutral-300 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              title="Force Sync Now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Sync Queue</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-black font-black rounded-full text-[9px]">
                  {pendingCount}
                </span>
              )}
            </button>

            <div
              className={`px-3 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 border shadow-sm ${
                isOnline
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                  : 'bg-red-950/80 text-red-400 border-red-500/50 animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
              <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-5xl w-full mx-auto pb-24">
        
        {/* Top Command Bar / Facility Selector */}
        <div className="mb-8 bg-[#111111] text-white p-6 rounded-lg shadow-xl border border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded shrink-0 text-red-500 mt-1">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                Assigned Health Center
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1 tracking-wide">
                {selectedPHC.name}
              </h2>
              <div className="text-xs text-neutral-400 mt-1 uppercase tracking-wider font-mono">
                {selectedPHC.id} • {selectedPHC.block} Block
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 shrink-0">
              Switch Facility:
            </label>
            <select
              value={phcId}
              onChange={(e) => setPhcId(e.target.value)}
              className="bg-[#0c0c0c] border border-neutral-700 hover:border-white text-xs text-white uppercase font-bold py-2.5 px-3 rounded focus:outline-none focus:border-cyan-400 transition-colors font-mono cursor-pointer"
            >
              {ALL_PHCS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} - {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sync Queue Warning / Status Box */}
        {!isOnline && (
          <div className="mb-8 bg-neutral-900 border-l-4 border-amber-500 p-5 rounded-r shadow-md text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-[0.15em] text-amber-400 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Offline Local Buffer Active
              </h3>
              <p className="text-xs text-neutral-300 mt-1">
                You are currently disconnected from the command center. All stock, bed, and attendance updates will be saved locally in IndexedDB and automatically synced as soon as network connection is restored.
              </p>
            </div>
          </div>
        )}

        {/* Overview Stats Row (matching dashboard card style) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#111111] text-white p-5 rounded shadow border border-neutral-800">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              Terminal Status
            </div>
            <div className="text-2xl font-black mt-2 text-emerald-400 flex items-center gap-2">
              <span>ACTIVE</span>
            </div>
            <div className="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest font-mono">
              Ready for Field Logging
            </div>
          </div>

          <div className="bg-[#111111] text-white p-5 rounded shadow border border-neutral-800">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              Pending Syncs
            </div>
            <div className="text-2xl font-black mt-2 text-amber-400">
              {pendingCount} <span className="text-xs font-normal text-neutral-400">records</span>
            </div>
            <div className="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest font-mono">
              {pendingCount === 0 ? 'All synced with server' : 'Waiting for network'}
            </div>
          </div>

          <div className="bg-[#111111] text-white p-5 rounded shadow border border-neutral-800">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              Data Protocol
            </div>
            <div className="text-2xl font-black mt-2 text-cyan-400">
              ATOMIC
            </div>
            <div className="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest font-mono">
              PostgreSQL Transactional
            </div>
          </div>
        </div>

        {/* Forms Component */}
        <Forms phcId={phcId} isOnline={isOnline} onSyncTrigger={triggerManualSync} />
      </main>

      {/* Footer */}
      <footer className="bg-[#111111] text-neutral-500 border-t border-neutral-800 py-6 px-4 text-center text-[10px] uppercase font-mono tracking-widest">
        KRAFT District Health • Field Terminal PWA • Offline ServiceWorker Enabled
      </footer>
    </div>
  );
}

export default App;
