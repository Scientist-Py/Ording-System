import React, { useState, useEffect } from 'react';
import {
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Bell,
  Clock,
  CheckCircle2,
  ChefHat,
  BellRing,
  UtensilsCrossed,
  XCircle,
  AlertTriangle,
  User,
  Phone,
  RefreshCw,
  Droplets,
  Receipt,
  UserCheck,
  ShieldCheck,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  Search,
  CheckCheck,
  ShoppingBag
} from 'lucide-react';
import { OrderRecord, CustomerRequest } from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/ws';
import { soundManager } from '../utils/audio';

export const KitchenDashboard: React.FC<{
  currencySymbol?: string;
  onNavigate?: (page: 'kitchen' | 'admin' | 'menu') => void;
}> = ({ currencySymbol = '₹', onNavigate }) => {
  // Navigation tabs: 'active' or 'completed'
  const [currentTab, setCurrentTab] = useState<'active' | 'completed' | 'requests'>('active');

  const [activeOrders, setActiveOrders] = useState<OrderRecord[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderRecord[]>([]);
  const [pendingRequests, setPendingRequests] = useState<CustomerRequest[]>([]);
  const [incomingOrderModal, setIncomingOrderModal] = useState<OrderRecord | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.9);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [rejectingOrder, setRejectingOrder] = useState<OrderRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Item currently out of stock');

  const [completedSearchQuery, setCompletedSearchQuery] = useState('');
  const [networkInfo, setNetworkInfo] = useState<{ customerWebUrl: string; localIp: string } | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  // Load active orders, completed orders, and assistance requests
  const loadData = async () => {
    try {
      const [actives, completeds, requests] = await Promise.all([
        api.getActiveOrders(),
        api.getCompletedOrders(),
        api.getPendingRequests()
      ]);
      setActiveOrders(actives);
      setCompletedOrders(completeds);
      setPendingRequests(requests);
    } catch (e) {
      console.error('[Dashboard] Load error:', e);
    }
  };

  useEffect(() => {
    loadData();

    // Fetch local network info for customer mobile ordering link
    fetch('/api/system/network-info')
      .then(r => r.json())
      .then(d => setNetworkInfo(d))
      .catch(() => {});

    // Register WebSocket as kitchen PC receiver
    wsClient.connect('kitchen');

    const unsubStatus = wsClient.onStatusChange((status) => {
      setConnectionStatus(status);
      if (status === 'connected') {
        loadData();
      }
    });

    // Instant real-time listener for incoming orders
    const unsubNewOrder = wsClient.on('NEW_ORDER', (newOrder: OrderRecord) => {
      setActiveOrders(prev => {
        const exists = prev.some(o => o.id === newOrder.id);
        if (exists) return prev;
        return [newOrder, ...prev];
      });

      // Show modal & start loud repeating audio chime
      setIncomingOrderModal(newOrder);
      if (soundEnabled) {
        soundManager.startRepeatingAlarm(volume);
      }

      // Native Windows Notification & Window Focus
      if ((window as any).electronAPI) {
        (window as any).electronAPI.notifyNewOrder(newOrder);
      }
    });

    // Instant listener for order status changes
    const unsubStatusChange = wsClient.on('ORDER_STATUS_CHANGED', (updated: OrderRecord) => {
      if (updated.status === 'COMPLETED') {
        setActiveOrders(prev => prev.filter(o => o.id !== updated.id));
        setCompletedOrders(prev => {
          const exists = prev.some(o => o.id === updated.id);
          if (exists) return prev.map(o => o.id === updated.id ? { ...o, ...updated } : o);
          return [updated, ...prev];
        });
      } else if (updated.status === 'REJECTED') {
        setActiveOrders(prev => prev.filter(o => o.id !== updated.id));
      } else {
        setActiveOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
      }
    });

    // Customer assistance requests listener
    const unsubRequests = wsClient.on('CUSTOMER_REQUEST', (req: CustomerRequest) => {
      setPendingRequests(prev => [req, ...prev]);
      if (soundEnabled) {
        soundManager.playAssistanceChime(volume);
      }

      if ((window as any).electronAPI) {
        (window as any).electronAPI.notifyAssistance(req);
      }
    });

    const unsubAck = wsClient.on('REQUEST_ACKNOWLEDGED', ({ id }: { id: string }) => {
      setPendingRequests(prev => prev.filter(r => r.id !== id));
    });

    // Dual-sync: Background poll every 2.5s guarantees 100% sync
    const autoSyncTimer = setInterval(() => {
      loadData();
    }, 2500);

    return () => {
      clearInterval(autoSyncTimer);
      unsubStatus();
      unsubNewOrder();
      unsubStatusChange();
      unsubRequests();
      unsubAck();
      soundManager.stopRepeatingAlarm();
    };
  }, [soundEnabled, volume]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
      setIsFullscreen(false);
    }
  };

  const handleAcceptIncomingOrder = async (orderId: string) => {
    soundManager.stopRepeatingAlarm();
    setIncomingOrderModal(null);
    try {
      await api.updateOrderStatus(orderId, 'ACCEPTED');
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleDismissIncomingModal = () => {
    soundManager.stopRepeatingAlarm();
    setIncomingOrderModal(null);
  };

  const handleStatusUpdate = async (orderId: string, nextStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, nextStatus);
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingOrder) return;
    try {
      await api.updateOrderStatus(rejectingOrder.id, 'REJECTED', rejectionReason);
      setRejectingOrder(null);
      if (incomingOrderModal?.id === rejectingOrder.id) {
        soundManager.stopRepeatingAlarm();
        setIncomingOrderModal(null);
      }
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  const handleAcknowledgeRequest = async (requestId: string) => {
    try {
      await api.acknowledgeRequest(requestId);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Acknowledge error:', err);
    }
  };

  // Filter completed orders by search query
  const filteredCompletedOrders = completedOrders.filter(o => {
    if (!completedSearchQuery.trim()) return true;
    const q = completedSearchQuery.toLowerCase();
    return (
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_phone?.includes(q) ||
      o.table_number?.toLowerCase().includes(q) ||
      String(o.order_number).includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-ink-950 text-white flex flex-col font-sans selection:bg-cafe-600">
      
      {/* Top Header Bar */}
      <header className="bg-ink-900 border-b border-ink-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-xl tracking-tight text-white">
                Chapter One Cafe
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cafe-800 text-cafe-200">
                Live Orders
              </span>
            </div>
            <p className="text-[11px] text-ink-400">Order Management & Customer Notifications</p>
          </div>
        </div>

        {/* Action Controls: Sound Test, Volume, Fullscreen, Refresh */}
        <div className="flex items-center gap-2.5">
          {/* Connection status badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            connectionStatus === 'connected'
              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
              : connectionStatus === 'reconnecting'
              ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
              : 'bg-rose-950/80 text-rose-400 border border-rose-800'
          }`}>
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span>{connectionStatus.toUpperCase()}</span>
              </>
            )}
          </div>

          <button
            onClick={() => soundManager.playIncomingOrder(volume)}
            className="px-3 py-1.5 bg-ink-800 hover:bg-ink-700 rounded-lg text-xs font-bold text-cafe-300 border border-ink-700 flex items-center gap-1.5"
            title="Test notification sound chime"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Sound</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-bold ${
              soundEnabled ? 'bg-ink-800 text-emerald-400 border-ink-700' : 'bg-rose-950 text-rose-400 border-rose-800'
            }`}
            title={soundEnabled ? 'Mute Alert Sound' : 'Unmute Sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-ink-800 hover:bg-ink-700 text-white rounded-lg border border-ink-700"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          <button
            onClick={loadData}
            className="p-2 bg-ink-800 hover:bg-ink-700 text-white rounded-lg border border-ink-700"
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('admin')}
              className="px-3 py-1.5 bg-cafe-800 hover:bg-cafe-700 rounded-lg text-xs font-bold text-cafe-100 border border-cafe-700 flex items-center gap-1.5 shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cafe-300" />
              <span>Admin Console</span>
            </button>
          )}
        </div>
      </header>

      {/* Customer Mobile Web Link Banner */}
      <div className="bg-cafe-950/90 border-b border-cafe-800 px-6 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-cafe-300">Customer Mobile Ordering Website:</span>
          <span className="bg-black/60 text-amber-300 px-2 py-0.5 rounded font-mono font-bold select-all border border-amber-500/30">
            {networkInfo?.customerWebUrl || 'http://localhost:4000'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const url = networkInfo?.customerWebUrl || 'http://localhost:4000';
              navigator.clipboard.writeText(url);
              setUrlCopied(true);
              setTimeout(() => setUrlCopied(false), 2000);
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-ink-800 hover:bg-ink-700 text-cafe-200 rounded text-[11px] font-medium border border-ink-700"
          >
            {urlCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{urlCopied ? 'Copied!' : 'Copy Link'}</span>
          </button>
          <a
            href={networkInfo?.customerWebUrl || 'http://localhost:4000'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open in Browser</span>
          </a>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-ink-900 border-b border-ink-800 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentTab('active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'active'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-ink-800 text-ink-300 hover:bg-ink-750'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Orders ({activeOrders.length})</span>
          </button>

          <button
            onClick={() => setCurrentTab('completed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'completed'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-ink-800 text-ink-300 hover:bg-ink-750'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completed Orders ({completedOrders.length})</span>
          </button>

          {pendingRequests.length > 0 && (
            <button
              onClick={() => setCurrentTab('requests')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                currentTab === 'requests'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800 animate-bounce'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Service Calls ({pendingRequests.length})</span>
            </button>
          )}
        </div>

        {/* Quick count summary */}
        <div className="text-xs text-ink-400 font-mono hidden md:block">
          Total Orders Today: <strong className="text-white">{activeOrders.length + completedOrders.length}</strong>
        </div>
      </div>

      {/* Customer Assistance Requests Banner (when not on requests tab) */}
      {pendingRequests.length > 0 && currentTab !== 'requests' && (
        <div className="bg-amber-950/90 border-b border-amber-600/60 px-6 py-2.5 flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider shrink-0">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>Staff Calls ({pendingRequests.length}):</span>
          </div>

          <div className="flex items-center gap-3">
            {pendingRequests.map(req => (
              <div
                key={req.id}
                className="bg-black/60 border border-amber-500/50 rounded-xl px-3 py-1.5 flex items-center gap-3 shrink-0"
              >
                <div className="flex items-center gap-1.5 text-xs">
                  {req.request_type === 'WAITER' && <UserCheck className="w-4 h-4 text-amber-400" />}
                  {req.request_type === 'WATER' && <Droplets className="w-4 h-4 text-sky-400" />}
                  {req.request_type === 'BILL' && <Receipt className="w-4 h-4 text-emerald-400" />}
                  <span className="font-bold text-amber-200">{req.table_number}:</span>
                  <span className="text-white">Needs {req.request_type}</span>
                </div>
                <button
                  onClick={() => handleAcknowledgeRequest(req.id)}
                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold rounded"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        
        {/* ========================================================= */}
        {/* TAB 1: ACTIVE ORDERS */}
        {/* ========================================================= */}
        {currentTab === 'active' && (
          <div>
            {activeOrders.length === 0 ? (
              <div className="text-center py-28 text-ink-500">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-500/70" />
                <h3 className="text-xl font-bold text-ink-200">No Active Orders</h3>
                <p className="text-xs text-ink-400 mt-1 max-w-sm mx-auto">
                  Orders placed by customers on their phones will appear here instantly with sound alerts.
                </p>
                <div className="mt-5">
                  <a
                    href={networkInfo?.customerWebUrl || 'http://localhost:4000'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Place a Test Order as Customer</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeOrders.map(order => {
                  const isNew = order.status === 'NEW';
                  return (
                    <div
                      key={order.id}
                      className={`rounded-2xl border flex flex-col justify-between overflow-hidden transition-all shadow-lg ${
                        isNew
                          ? 'bg-ink-900 border-amber-500 ring-2 ring-amber-500/50'
                          : order.status === 'PREPARING'
                          ? 'bg-ink-900 border-sky-600'
                          : order.status === 'READY'
                          ? 'bg-ink-900 border-emerald-500'
                          : 'bg-ink-900 border-ink-800'
                      }`}
                    >
                      {/* Card Header: Table Number & Status */}
                      <div className={`p-4 flex items-start justify-between border-b ${
                        isNew ? 'bg-amber-500/20 border-amber-500/30' : 'bg-ink-850 border-ink-800'
                      }`}>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400">
                            Order #{order.order_number}
                          </span>
                          <h2 className="font-serif font-bold text-2xl text-white tracking-tight">
                            {order.table_number}
                          </h2>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                            isNew
                              ? 'bg-amber-500 text-black animate-pulse'
                              : order.status === 'ACCEPTED'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : order.status === 'PREPARING'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : order.status === 'READY'
                              ? 'bg-emerald-500 text-black'
                              : 'bg-ink-700 text-ink-300'
                          }`}>
                            {order.status}
                          </span>
                          <span className="text-[10px] text-ink-400 mt-1 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="px-4 py-2 bg-black/30 border-b border-ink-800/60 flex items-center justify-between text-xs text-ink-300">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-cafe-400" />
                          <strong className="text-white">{order.customer_name}</strong>
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-ink-400" />
                          {order.customer_phone}
                        </span>
                      </div>

                      {/* Special Instructions highlight */}
                      {order.special_instructions && (
                        <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-950/60 border border-amber-600/40 text-amber-200 text-xs">
                          <strong className="block text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-0.5">
                            Special Instructions:
                          </strong>
                          {order.special_instructions}
                        </div>
                      )}

                      {/* Items List */}
                      <div className="p-4 flex-1 space-y-2 overflow-y-auto max-h-56">
                        {order.items?.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-start text-sm border-b border-ink-800/40 pb-1.5 last:border-0">
                            <div className="flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono font-bold text-amber-400 text-base">{it.quantity}×</span>
                                <span className="font-semibold text-white">{it.name || (it as any).item_name}</span>
                              </div>
                              {it.customizationsSelected && it.customizationsSelected.length > 0 && (
                                <p className="text-[11px] text-cafe-300 pl-6">
                                  {it.customizationsSelected.map(c => c.optionName).join(', ')}
                                </p>
                              )}
                            </div>
                            <span className="font-mono text-xs text-ink-400 shrink-0">
                              {currencySymbol}{it.subtotal || (it as any).item_subtotal}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Card Footer: Amount & Action Buttons */}
                      <div className="p-4 bg-ink-950/80 border-t border-ink-800 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-ink-400">Total Bill</span>
                          <span className="font-serif font-bold text-lg text-white">
                            {currencySymbol}{order.total}
                          </span>
                        </div>

                        {/* Direct Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {isNew ? (
                            <>
                              <button
                                onClick={() => handleAcceptIncomingOrder(order.id)}
                                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow"
                              >
                                Accept Order
                              </button>
                              <button
                                onClick={() => setRejectingOrder(order)}
                                className="py-2.5 px-3 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold uppercase tracking-wider"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(order.id, 'COMPLETED')}
                                className="col-span-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow"
                              >
                                <CheckCheck className="w-4 h-4" />
                                <span>Mark Completed</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: COMPLETED ORDERS */}
        {/* ========================================================= */}
        {currentTab === 'completed' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif font-bold text-xl text-white">Completed Orders History</h2>
                <p className="text-xs text-ink-400">Fulfilled orders and past customer receipts</p>
              </div>

              {/* Search completed orders */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={completedSearchQuery}
                  onChange={(e) => setCompletedSearchQuery(e.target.value)}
                  placeholder="Search by order #, table, customer..."
                  className="w-full bg-ink-900 border border-ink-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {filteredCompletedOrders.length === 0 ? (
              <div className="text-center py-20 text-ink-500 bg-ink-900/40 rounded-2xl border border-ink-800 p-8">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-ink-700" />
                <p className="text-sm font-semibold text-ink-300">No completed orders found</p>
                <p className="text-xs text-ink-500 mt-1">Orders marked as complete will be saved here.</p>
              </div>
            ) : (
              <div className="bg-ink-900 rounded-2xl border border-ink-800 overflow-hidden shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-850 text-ink-400 uppercase font-bold text-[10px] tracking-wider border-b border-ink-800">
                      <tr>
                        <th className="py-3 px-4">Order #</th>
                        <th className="py-3 px-4">Table</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Items Summary</th>
                        <th className="py-3 px-4">Total Amount</th>
                        <th className="py-3 px-4">Completed Time</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-800/60">
                      {filteredCompletedOrders.map(order => (
                        <tr key={order.id} className="hover:bg-ink-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            #{order.order_number}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {order.table_number}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white block">{order.customer_name}</span>
                            <span className="text-[11px] text-ink-400 font-mono">{order.customer_phone}</span>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="space-y-0.5">
                              {order.items?.map((it, idx) => (
                                <div key={idx} className="text-ink-300 text-[11px] truncate">
                                  {it.quantity}× {it.name || (it as any).item_name}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-serif font-bold text-sm text-white">
                            {currencySymbol}{order.total}
                          </td>
                          <td className="py-3 px-4 text-ink-400 font-mono text-[11px]">
                            {new Date(order.updated_at || order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Completed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: CUSTOMER ASSISTANCE REQUESTS */}
        {/* ========================================================= */}
        {currentTab === 'requests' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="font-serif font-bold text-xl text-white">Customer Service Requests</h2>
            {pendingRequests.length === 0 ? (
              <div className="p-8 bg-ink-900 rounded-2xl border border-ink-800 text-center text-ink-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">No Pending Calls</p>
                <p className="text-xs text-ink-400 mt-0.5">Staff calls from tables will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map(req => (
                  <div
                    key={req.id}
                    className="p-4 bg-ink-900 rounded-2xl border border-amber-500/50 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white">{req.table_number}</h3>
                        <p className="text-xs text-amber-300 font-semibold">Requesting: {req.request_type}</p>
                        <p className="text-[10px] text-ink-400 font-mono">
                          {new Date(req.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAcknowledgeRequest(req.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase"
                    >
                      Acknowledge
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Fullscreen Incoming Order Alert Modal (Pops up immediately on new order) */}
      {incomingOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-ink-900 border-4 border-amber-500 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl space-y-6 animate-pulse-ring">
            
            <div className="w-16 h-16 rounded-full bg-amber-500 text-black flex items-center justify-center mx-auto shadow-lg animate-bounce">
              <Bell className="w-8 h-8 fill-black" />
            </div>

            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400 bg-amber-950 px-3 py-1 rounded-full border border-amber-500/40">
                INCOMING NEW ORDER
              </span>
              <h2 className="font-serif font-black text-4xl text-white mt-2">
                {incomingOrderModal.table_number}
              </h2>
              <p className="text-xs text-ink-400 mt-1 font-mono">
                Order #{incomingOrderModal.order_number} • Customer: {incomingOrderModal.customer_name} ({incomingOrderModal.customer_phone})
              </p>
            </div>

            {/* Items summary */}
            <div className="bg-ink-950 p-4 rounded-2xl border border-ink-800 text-left max-h-48 overflow-y-auto space-y-1.5 text-sm">
              {incomingOrderModal.items?.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="font-medium text-white">{it.quantity}× {it.name || (it as any).item_name}</span>
                  <span className="font-mono text-ink-400">{currencySymbol}{it.subtotal || (it as any).item_subtotal}</span>
                </div>
              ))}
              <div className="border-t border-ink-800 pt-2 flex justify-between font-bold text-white">
                <span>Total</span>
                <span>{currencySymbol}{incomingOrderModal.total}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleAcceptIncomingOrder(incomingOrderModal.id)}
                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base rounded-2xl uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                ACCEPT ORDER
              </button>
              <button
                onClick={handleDismissIncomingModal}
                className="py-4 px-6 bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-sm rounded-2xl border border-ink-700"
              >
                Silence Alarm
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Reject Order Reason Dialog */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Reject Order #{rejectingOrder.order_number}</h3>
            <p className="text-xs text-ink-400">Please provide a reason to inform the customer:</p>
            
            <div className="space-y-2">
              {[
                'Item currently out of stock',
                'Kitchen closing soon',
                'Ingredients unavailable',
                'Excessive kitchen backlog'
              ].map(reason => (
                <label
                  key={reason}
                  onClick={() => setRejectionReason(reason)}
                  className={`block p-2.5 rounded-lg border text-xs cursor-pointer ${
                    rejectionReason === reason
                      ? 'bg-amber-950/70 border-amber-500 text-amber-200'
                      : 'bg-ink-800 border-ink-700 text-ink-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={rejectionReason === reason}
                    onChange={() => {}}
                    className="mr-2 text-amber-500"
                  />
                  {reason}
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold uppercase"
              >
                Confirm Decline
              </button>
              <button
                onClick={() => setRejectingOrder(null)}
                className="py-2.5 px-4 bg-ink-800 text-ink-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
