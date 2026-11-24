import React, { useState, useEffect } from 'react';
import { UserCheck, Droplets, Receipt, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { soundManager } from '../utils/audio';

interface AssistanceBarProps {
  qrToken: string;
  tableNumber: string;
}

export const AssistanceBar: React.FC<AssistanceBarProps> = ({ qrToken, tableNumber }) => {
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [loadingType, setLoadingType] = useState<string | null>(null);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldowns(prev => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v > 1) {
            next[k] = v - 1;
            changed = true;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRequest = async (type: 'WAITER' | 'BILL' | 'WATER') => {
    if (cooldowns[type] || loadingType) return;

    setLoadingType(type);
    try {
      const res = await api.requestAssistance(qrToken, type);
      soundManager.playAssistanceChime(0.6);
      setToast(res.message);
      setCooldowns(prev => ({ ...prev, [type]: 45 })); // 45s cooldown
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast(err.message || 'Assistance request failed');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="bg-white border-b border-cafe-200 py-2.5 px-4 sticky top-[61px] z-20 shadow-xs">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <span className="text-xs font-semibold text-cafe-700 uppercase tracking-wider shrink-0 hidden sm:inline">
          {tableNumber} Assistance:
        </span>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          {/* Call Staff */}
          <button
            onClick={() => handleRequest('WAITER')}
            disabled={Boolean(cooldowns['WAITER']) || loadingType === 'WAITER'}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              cooldowns['WAITER']
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-cafe-50 border-cafe-300 text-cafe-900 hover:bg-cafe-100 active:scale-95'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-cafe-700" />
            <span>Call Staff</span>
            {cooldowns['WAITER'] ? (
              <span className="text-[10px] text-gray-500 font-mono">({cooldowns['WAITER']}s)</span>
            ) : null}
          </button>

          {/* Request Water */}
          <button
            onClick={() => handleRequest('WATER')}
            disabled={Boolean(cooldowns['WATER']) || loadingType === 'WATER'}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              cooldowns['WATER']
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100 active:scale-95'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-sky-600" />
            <span>Water</span>
            {cooldowns['WATER'] ? (
              <span className="text-[10px] text-gray-500 font-mono">({cooldowns['WATER']}s)</span>
            ) : null}
          </button>

          {/* Request Bill */}
          <button
            onClick={() => handleRequest('BILL')}
            disabled={Boolean(cooldowns['BILL']) || loadingType === 'BILL'}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              cooldowns['BILL']
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100 active:scale-95'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bill</span>
            {cooldowns['BILL'] ? (
              <span className="text-[10px] text-gray-500 font-mono">({cooldowns['BILL']}s)</span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Floating feedback toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-cafe-950 text-white text-xs px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
