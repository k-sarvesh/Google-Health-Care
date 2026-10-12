import React, { useState, useEffect } from 'react';
import { addSyncItem, getAllSyncItems } from '../db/indexedDB';
import { syncQueue } from '../services/syncService';
import { Pill, Bed, Users, Send, CheckCircle2, AlertCircle, Clock, ArrowRight } from 'lucide-react';

const MEDICINE_LIST = [
  "Paracetamol 500mg",
  "Amoxicillin 250mg",
  "ORS Packets",
  "Anti-venom",
  "IV Fluids",
  "Syringes",
  "Bandages",
  "Ibuprofen 400mg",
  "N95 Respirator Mask",
  "Nitrile Exam Gloves",
  "Azithromycin 500mg",
  "Ciprofloxacin 500mg",
  "Metformin 500mg",
  "Amlodipine 10mg",
  "Insulin Glargine",
  "Omeprazole 20mg",
  "Cetirizine 10mg",
  "Losartan 50mg",
  "Atorvastatin 20mg",
  "Albuterol Inhaler",
  "Ceftriaxone 1g",
  "Morphine 10mg",
  "Dexamethasone 4mg",
  "Epinephrine Auto-injector",
  "Hydrocortisone Cream"
];

export default function Forms({ phcId, isOnline, onSyncTrigger }) {
  const [updateType, setUpdateType] = useState('Medicine'); // Medicine, Beds, Attendance
  const [medicine, setMedicine] = useState(MEDICINE_LIST[0]);
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success'); // success, warning, error
  const [hasPendingItems, setHasPendingItems] = useState(false);

  const checkPending = async () => {
    const items = await getAllSyncItems();
    setHasPendingItems(items.length > 0);
  };

  useEffect(() => {
    checkPending();
  }, [isOnline]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (quantity === '' || isNaN(quantity) || Number(quantity) < 0) {
      setMessage('Please enter a valid positive number.');
      setMessageType('error');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      let payload = {
        phc_id: phcId,
        update_type: updateType,
        timestamp: new Date().toISOString()
      };

      if (updateType === 'Medicine') {
        payload.medicine_name = medicine;
        payload.quantity = Number(quantity);
      } else if (updateType === 'Beds') {
        payload.available_beds = Number(quantity);
      } else if (updateType === 'Attendance') {
        payload.doctors_present = Number(quantity);
      }

      await addSyncItem(payload);
      
      let itemDesc = updateType === 'Medicine' 
        ? `${quantity} units of ${medicine}` 
        : updateType === 'Beds' 
        ? `${quantity} available beds` 
        : `${quantity} doctors present`;
      
      setQuantity('');
      
      // Attempt to sync immediately if online
      if (isOnline) {
        await syncQueue();
        if (onSyncTrigger) onSyncTrigger();
        const items = await getAllSyncItems();
        if (items.length > 0) {
          setMessage(`Logged ${itemDesc} locally. Queued for server transmission.`);
          setMessageType('warning');
        } else {
          setMessage(`Successfully transmitted ${itemDesc} to command center.`);
          setMessageType('success');
        }
      } else {
        setMessage(`Logged ${itemDesc} locally. Will auto-sync when online.`);
        setMessageType('warning');
      }
      checkPending();
    } catch (err) {
      setMessage('Error saving terminal data. Please check local storage.');
      setMessageType('error');
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div className="bg-[#111111] text-white rounded-lg shadow-2xl p-6 sm:p-8 border border-neutral-800 relative overflow-hidden">
      
      {/* Top Banner / Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-neutral-800 mb-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 flex items-center gap-2">
            <span>Data Entry Interface</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white mt-1 flex items-center gap-3">
            {updateType === 'Medicine' && <Pill className="w-6 h-6 text-red-500 shrink-0" />}
            {updateType === 'Beds' && <Bed className="w-6 h-6 text-cyan-400 shrink-0" />}
            {updateType === 'Attendance' && <Users className="w-6 h-6 text-emerald-400 shrink-0" />}
            <span>Log {updateType} Status</span>
          </h2>
        </div>

        {hasPendingItems && (
          <div className="px-3 py-1.5 bg-amber-950/80 border border-amber-500/50 rounded text-amber-300 text-[10px] font-mono uppercase font-bold flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Local Buffer Pending</span>
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
        {[
          { id: 'Medicine', label: 'Medicine Stock', icon: Pill, color: 'text-red-500', border: 'border-red-500' },
          { id: 'Beds', label: 'Bed Capacity', icon: Bed, color: 'text-cyan-400', border: 'border-cyan-400' },
          { id: 'Attendance', label: 'Doctor Roster', icon: Users, color: 'text-emerald-400', border: 'border-emerald-400' }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = updateType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setUpdateType(tab.id); setQuantity(''); setMessage(''); }}
              className={`p-4 rounded border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer font-sans ${
                isActive
                  ? `bg-neutral-900 ${tab.border} shadow-[0_0_15px_rgba(255,255,255,0.05)]`
                  : 'bg-[#0a0a0a] border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? tab.color : 'text-neutral-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status Banner */}
      {message && (
        <div className={`mb-6 p-4 rounded border text-xs flex items-center gap-3 animate-fade-in font-mono ${
          messageType === 'success' ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300' :
          messageType === 'warning' ? 'bg-amber-950/80 border-amber-500/60 text-amber-300' :
          'bg-red-950/80 border-red-500/60 text-red-300'
        }`}>
          {messageType === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {messageType === 'warning' && <Clock className="w-4 h-4 text-amber-400 shrink-0" />}
          {messageType === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {updateType === 'Medicine' && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2.5">
              Select Medicine / Consumable Item
            </label>
            <select
              value={medicine}
              onChange={(e) => setMedicine(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-neutral-700 hover:border-neutral-500 focus:border-red-500 px-4 py-3.5 rounded text-xs text-white font-mono uppercase font-bold focus:outline-none transition-colors cursor-pointer"
            >
              {MEDICINE_LIST.map((item) => (
                <option key={item} value={item} className="bg-[#111111] text-white py-1">
                  {item}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2.5">
            {updateType === 'Medicine' ? 'Current Available Units / Quantity' :
             updateType === 'Beds' ? 'Total Available Vacant Beds' :
             'Number of Doctors Currently Present on Duty'}
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 500"
              className="w-full bg-[#0a0a0a] border border-neutral-700 focus:border-white px-4 py-3.5 text-sm font-mono text-white placeholder-neutral-600 rounded focus:outline-none transition-colors"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-neutral-500 text-xs font-mono uppercase">
              {updateType === 'Medicine' ? 'UNITS' : updateType === 'Beds' ? 'BEDS' : 'DOCS'}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-white hover:bg-neutral-200 text-[#111111] font-black text-xs uppercase tracking-[0.25em] transition-all rounded shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 mt-4"
        >
          {loading ? (
            <span>TRANSMITTING DATA...</span>
          ) : (
            <>
              <span>Transmit Field Update</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

      </form>

    </div>
  );
}
