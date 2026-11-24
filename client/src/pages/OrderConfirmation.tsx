import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, MessageCircle, Copy, Check, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import { OrderRecord } from '../types';
import { api } from '../services/api';

interface OrderConfirmationProps {
  order: OrderRecord;
  whatsappMessage: string;
  whatsappUrl: string;
  onTrackOrder: (orderNumber: number) => void;
  onBackToMenu: () => void;
  currencySymbol?: string;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order,
  whatsappMessage,
  whatsappUrl,
  onTrackOrder,
  onBackToMenu,
  currencySymbol = '₹'
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Launch celebratory confetti burst
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  }, []);

  const handleOpenWhatsApp = () => {
    api.recordWhatsAppOpened(order.id);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-cafe-50 py-8 px-4 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-cafe-200/80 p-6 sm:p-8 shadow-xl text-center relative overflow-hidden">
        
        {/* Top green glow */}
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>

        <h1 className="font-serif font-bold text-2xl text-ink-950 tracking-tight">
          ORDER PLACED SUCCESSFULLY
        </h1>
        <p className="text-xs text-ink-500 mt-1 max-w-sm mx-auto">
          Your order has been received and saved by Chapter One Cafe kitchen.
        </p>

        {/* Order Details Badge Card */}
        <div className="my-6 p-4 rounded-2xl bg-cafe-50/80 border border-cafe-200/90 text-left space-y-3">
          <div className="flex items-center justify-between border-b border-cafe-200/60 pb-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-cafe-600 tracking-wider">Order Number</p>
              <p className="font-mono font-bold text-xl text-cafe-950">#{order.order_number}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-cafe-600 tracking-wider">Assigned Table</p>
              <p className="font-bold text-base text-cafe-950">{order.table_number}</p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-ink-700">
            {order.items && order.items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span>
                  {it.name} <span className="text-ink-400 font-mono">× {it.quantity}</span>
                </span>
                <span className="font-semibold">{currencySymbol}{it.subtotal}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-cafe-200/60 pt-2 flex justify-between items-baseline">
            <span className="font-semibold text-xs text-ink-800">Total Amount</span>
            <span className="font-serif font-bold text-lg text-cafe-950">
              {currencySymbol}{order.total}
            </span>
          </div>
        </div>

        {/* Major WhatsApp Feature Button */}
        <div className="space-y-3">
          <button
            onClick={handleOpenWhatsApp}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all"
          >
            <MessageCircle className="w-5 h-5 fill-white text-emerald-600" />
            <span>SEND ORDER ON WHATSAPP</span>
          </button>

          <button
            onClick={handleCopyMessage}
            className="w-full py-2.5 px-4 rounded-xl border border-cafe-200 hover:bg-cafe-50 text-xs font-semibold text-cafe-900 flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span className="text-emerald-700 font-bold">Message Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cafe-600" />
                <span>Copy Order Message (Fallback)</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-ink-500 leading-relaxed max-w-sm mx-auto">
            Note: Your order is already saved in the cafe's live database. Opening WhatsApp lets you send a formatted summary directly to the cafe's official line.
          </p>
        </div>

        {/* Next Actions: Track & Menu */}
        <div className="mt-6 pt-5 border-t border-cafe-100 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onTrackOrder(order.order_number)}
            className="flex-1 py-3 px-4 rounded-xl bg-cafe-950 hover:bg-cafe-900 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Clock className="w-4 h-4 text-cafe-300" />
            <span>TRACK MY ORDER</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onBackToMenu}
            className="py-3 px-4 rounded-xl border border-cafe-300 hover:bg-cafe-100 text-cafe-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Menu</span>
          </button>
        </div>

      </div>
    </div>
  );
};
