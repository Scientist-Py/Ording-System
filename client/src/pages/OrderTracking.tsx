import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, ChefHat, BellRing, UtensilsCrossed, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { OrderRecord } from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/ws';
import { AssistanceBar } from '../components/AssistanceBar';

interface OrderTrackingProps {
  orderNumber: number;
  qrToken?: string;
  onBackToMenu: () => void;
  currencySymbol?: string;
}

const STATUS_STEPS = [
  { key: 'NEW', label: 'Order Received', desc: 'Sent to cafe kitchen', icon: Clock },
  { key: 'ACCEPTED', label: 'Accepted by Cafe', desc: 'Confirmed by counter', icon: CheckCircle2 },
  { key: 'PREPARING', label: 'Preparing', desc: 'Chefs are crafting your order', icon: ChefHat },
  { key: 'READY', label: 'Ready', desc: 'Plated & ready for serving', icon: BellRing },
  { key: 'SERVED', label: 'Served', desc: 'Delivered to your table', icon: UtensilsCrossed },
];

export const OrderTracking: React.FC<OrderTrackingProps> = ({
  orderNumber,
  qrToken,
  onBackToMenu,
  currencySymbol = '₹'
}) => {
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.trackOrder(orderNumber);
      setOrder(res.order);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Could not load order tracking.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Subscribe to real-time status updates via WebSocket
    wsClient.connect('customer', null, orderNumber);
    wsClient.subscribeOrder(orderNumber);

    const unsubscribe = wsClient.on('ORDER_STATUS_CHANGED', (payload: any) => {
      if (payload && payload.order_number == orderNumber) {
        setOrder(prev => prev ? { ...prev, ...payload } : payload);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [orderNumber]);

  const currentStatusIndex = order ? STATUS_STEPS.findIndex(s => s.key === order.status) : 0;
  const isRejected = order?.status === 'REJECTED';

  return (
    <div className="min-h-screen bg-cafe-50 pb-12">
      {/* Assistance Bar for the table */}
      {qrToken && order && (
        <AssistanceBar qrToken={qrToken} tableNumber={order.table_number} />
      )}

      <div className="max-w-xl mx-auto px-4 pt-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBackToMenu}
            className="flex items-center gap-1.5 text-xs font-semibold text-cafe-800 hover:text-cafe-950 bg-white px-3 py-1.5 rounded-full border border-cafe-200 shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Menu</span>
          </button>

          <button
            onClick={fetchStatus}
            aria-label="Refresh status"
            className="p-1.5 rounded-full bg-white border border-cafe-200 text-cafe-700 hover:bg-cafe-100 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && !order ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-cafe-200 p-8 shadow-sm">
            <div className="w-10 h-10 border-4 border-cafe-200 border-t-cafe-800 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-ink-500">Checking order status with cafe...</p>
          </div>
        ) : error || !order ? (
          <div className="bg-white rounded-3xl border border-cafe-200 p-8 text-center shadow-sm">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h2 className="font-serif font-bold text-lg text-ink-900">Order Not Found</h2>
            <p className="text-xs text-ink-500 mt-1">{error || 'Unable to locate order #' + orderNumber}</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-cafe-200/90 p-6 sm:p-8 shadow-sm space-y-6">
            
            {/* Header */}
            <div className="text-center pb-4 border-b border-cafe-100">
              <div className="inline-block px-3 py-1 bg-cafe-100 rounded-full text-xs font-bold text-cafe-800 mb-2 font-mono">
                Order #{order.order_number}
              </div>
              <h2 className="font-serif font-bold text-2xl text-ink-950">
                {order.table_number}
              </h2>
              <p className="text-xs text-ink-500 mt-0.5">
                Customer: <span className="font-semibold text-ink-800">{order.customer_name}</span>
              </p>
            </div>

            {/* Rejection State */}
            {isRejected ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
                <h3 className="font-bold text-sm text-rose-900">Order Declined by Cafe</h3>
                <p className="text-xs text-rose-700">
                  {order.rejection_reason || 'The cafe staff could not accept this order at this moment.'}
                </p>
                <button
                  onClick={onBackToMenu}
                  className="mt-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700"
                >
                  Order Different Items
                </button>
              </div>
            ) : (
              /* Live Progress Stepper */
              <div className="space-y-5 py-2">
                {STATUS_STEPS.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isDone = currentStatusIndex >= idx;
                  const isCurrent = currentStatusIndex === idx;

                  return (
                    <div key={step.key} className="flex items-start gap-4 relative">
                      {/* Vertical line connecting steps */}
                      {idx < STATUS_STEPS.length - 1 && (
                        <div
                          className={`absolute left-4 top-8 -bottom-4 w-0.5 transition-colors ${
                            currentStatusIndex > idx ? 'bg-emerald-500' : 'bg-cafe-200'
                          }`}
                        />
                      )}

                      {/* Icon bubble */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                          isCurrent
                            ? 'bg-cafe-950 text-white ring-4 ring-cafe-200 animate-pulse'
                            : isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-cafe-100 text-cafe-400 border border-cafe-200'
                        }`}
                      >
                        <StepIcon className="w-4 h-4" />
                      </div>

                      {/* Step info */}
                      <div className="flex-1 pt-0.5">
                        <div className="flex items-baseline justify-between">
                          <h4 className={`text-sm font-bold ${isCurrent ? 'text-cafe-950 font-serif' : isDone ? 'text-ink-900' : 'text-ink-400'}`}>
                            {step.label}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              In Progress
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-500 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Order Items Breakdown */}
            <div className="pt-4 border-t border-cafe-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-600 mb-3">
                Items in this order
              </h4>
              <div className="space-y-2 text-xs">
                {order.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-cafe-50 last:border-0">
                    <div>
                      <span className="font-semibold text-ink-900">{it.name || (it as any).item_name}</span>
                      <span className="text-ink-400 font-mono ml-2">× {it.quantity}</span>
                    </div>
                    <span className="font-semibold text-cafe-900">
                      {currencySymbol}{it.subtotal || (it as any).item_subtotal}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-serif font-bold text-base text-cafe-950 pt-2 border-t border-cafe-200">
                  <span>Total</span>
                  <span>{currencySymbol}{order.total}</span>
                </div>
              </div>
            </div>

            {/* Order More CTA */}
            <div className="pt-2">
              <button
                onClick={onBackToMenu}
                className="w-full py-3 px-4 rounded-xl border border-cafe-300 hover:bg-cafe-100 text-cafe-900 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <span>Add More Bites or Drinks to Table</span>
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
