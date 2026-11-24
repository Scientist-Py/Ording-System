import React, { useEffect, useState } from 'react';
import { QrCode, X, CheckCircle, ShieldAlert, Sparkles, ChevronRight } from 'lucide-react';

interface TableDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: string) => void;
  currentTableToken?: string | null;
}

export const TableDemoModal: React.FC<TableDemoModalProps> = ({
  isOpen,
  onClose,
  onSelectToken,
  currentTableToken
}) => {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTables();
    }
  }, [isOpen]);

  const loadTables = async () => {
    setLoading(true);
    try {
      // Fetch public list of active tables for demo picker
      const res = await fetch('/api/tables', {
        headers: { 'x-admin-pin': '1234' }
      });
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } catch (e) {
      console.warn('Failed to fetch table list:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-cafe-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cafe-100 text-cafe-900 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-cafe-950">Table QR Scanner Simulation</h3>
              <p className="text-[11px] text-ink-500">Pick a table or test security validation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-cafe-100 flex items-center justify-center text-ink-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tables list */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          <p className="text-[10px] uppercase font-bold tracking-wider text-cafe-600 mb-1">
            Available Cafe Tables:
          </p>
          {loading ? (
            <div className="text-center py-8 text-xs text-ink-400">Loading tables...</div>
          ) : (
            tables.map(tbl => {
              const isSelected = currentTableToken === tbl.qr_token;
              return (
                <div
                  key={tbl.id}
                  onClick={() => {
                    onSelectToken(tbl.qr_token);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cafe-900 bg-cafe-100 text-cafe-950 font-bold'
                      : 'border-cafe-200 hover:border-cafe-300 hover:bg-cafe-50 text-ink-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-xs font-bold">{tbl.table_number}</p>
                      <p className="text-[10px] text-ink-400 font-mono">Token: {tbl.qr_token.slice(0, 12)}...</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-cafe-700">
                    <span>Scan</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Security Test Presets */}
        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
            <span>Security Testing Triggers:</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                onSelectToken('invalid_token_12345');
                onClose();
              }}
              className="flex-1 py-1.5 px-2 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-[10px] font-semibold"
            >
              Simulate Invalid QR
            </button>
            <button
              onClick={() => {
                onSelectToken('revoked_test_token_abc');
                onClose();
              }}
              className="flex-1 py-1.5 px-2 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-[10px] font-semibold"
            >
              Simulate Revoked QR
            </button>
          </div>
        </div>

        {/* Manual Token Entry */}
        <div className="pt-1">
          <label className="block text-[11px] font-medium text-ink-600 mb-1">
            Or paste custom QR token:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste 32-character token"
              className="flex-1 p-2 rounded-xl border border-cafe-200 text-xs font-mono"
            />
            <button
              onClick={() => {
                if (manualToken.trim()) {
                  onSelectToken(manualToken.trim());
                  onClose();
                }
              }}
              className="py-2 px-3 bg-cafe-950 text-white rounded-xl text-xs font-bold"
            >
              Verify
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
