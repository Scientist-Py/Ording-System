import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CustomerOrdering } from './pages/CustomerOrdering';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { OrderTracking } from './pages/OrderTracking';
import { KitchenDashboard } from './pages/KitchenDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { TableDemoModal } from './components/TableDemoModal';
import { TableInfo, CartItem } from './types';
import { api } from './services/api';
import { storage } from './utils/storage';

export const App: React.FC = () => {
  // Routing state
  const [currentPage, setCurrentPage] = useState<'menu' | 'confirmation' | 'tracking' | 'kitchen' | 'admin'>('menu');
  const [trackedOrderNumber, setTrackedOrderNumber] = useState<number | null>(null);
  const [placedOrderData, setPlacedOrderData] = useState<{
    order: any;
    whatsappMessage: string;
    whatsappUrl: string;
  } | null>(null);

  // Table & QR validation state
  const [tableToken, setTableToken] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>(storage.getSavedCart());
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Parse path or token on initial load
  useEffect(() => {
    handleUrlRouting();
    window.addEventListener('popstate', handleUrlRouting);
    return () => window.removeEventListener('popstate', handleUrlRouting);
  }, []);

  const handleUrlRouting = () => {
    const path = window.location.pathname;

    if (path === '/kitchen' || path === '/pc') {
      setCurrentPage('kitchen');
      return;
    }

    if (path === '/admin') {
      setCurrentPage('admin');
      return;
    }

    const trackMatch = path.match(/^\/track\/(\d+)/);
    if (trackMatch) {
      setTrackedOrderNumber(parseInt(trackMatch[1], 10));
      setCurrentPage('tracking');
      return;
    }

    const tableMatch = path.match(/^\/(?:table|qr)\/([a-zA-Z0-9_-]+)/);
    if (tableMatch) {
      const token = tableMatch[1];
      setTableToken(token);
      validateTableToken(token);
      setCurrentPage('menu');
      return;
    }

    // Default: Check if we have a tableToken or simulate first table if none
    const savedToken = localStorage.getItem('ch1_active_table_token');
    if (savedToken) {
      setTableToken(savedToken);
      validateTableToken(savedToken);
    } else {
      // Fetch default active table for smooth initial demo experience
      fetchDefaultTableToken();
    }
  };

  const fetchDefaultTableToken = async () => {
    try {
      const res = await fetch('/api/tables', { headers: { 'x-admin-pin': '1234' } });
      if (res.ok) {
        const tables = await res.json();
        if (tables.length > 0) {
          // Default to Table 04 as highlighted in spec
          const defaultTable = tables.find((t: any) => t.table_number === 'Table 04') || tables[0];
          setTableToken(defaultTable.qr_token);
          validateTableToken(defaultTable.qr_token);
        }
      }
    } catch (e) {
      console.warn('Default table fetch error:', e);
    }
  };

  const validateTableToken = async (token: string) => {
    setTableError(null);
    try {
      const res = await api.validateQr(token);
      if (res.valid) {
        setTableInfo({
          id: res.table.id,
          tableNumber: res.table.tableNumber,
          status: res.table.status as any,
          qrToken: res.table.qrToken
        });
        localStorage.setItem('ch1_active_table_token', token);
      }
    } catch (err: any) {
      setTableError(err.message || 'Invalid or revoked QR code.');
      setTableInfo(null);
    }
  };

  const handleSelectTableToken = (token: string) => {
    setTableToken(token);
    window.history.pushState({}, '', `/table/${token}`);
    validateTableToken(token);
  };

  const handleOrderSuccess = (data: any) => {
    setPlacedOrderData(data);
    setCartItems([]);
    storage.clearCart();
    setCurrentPage('confirmation');
  };

  const navigateTo = (page: 'menu' | 'kitchen' | 'admin' | 'tracking') => {
    setCurrentPage(page);
    if (page === 'kitchen') window.history.pushState({}, '', '/kitchen');
    else if (page === 'admin') window.history.pushState({}, '', '/admin');
    else if (page === 'menu') {
      if (tableToken) window.history.pushState({}, '', `/table/${tableToken}`);
      else window.history.pushState({}, '', '/');
    }
  };

  return (
    <div className="min-h-screen bg-cafe-50 text-ink-900 font-sans">
      {/* Header (Shown on customer and track pages) */}
      {(currentPage === 'menu' || currentPage === 'confirmation' || currentPage === 'tracking') && (
        <Navbar
          table={tableInfo}
          cartCount={cartItems.reduce((sum, it) => sum + it.quantity, 0)}
          onOpenCart={() => setIsCartOpen(true)}
          onSelectTableDemo={() => setShowTableModal(true)}
          currentPage={currentPage}
          onNavigate={(p) => navigateTo(p as any)}
        />
      )}

      {/* PC Kitchen Header quick escape to customer view if needed */}
      {(currentPage === 'kitchen' || currentPage === 'admin') && (
        <div className="bg-cafe-900 text-cafe-200 text-xs py-1.5 px-4 flex items-center justify-between border-b border-cafe-800">
          <span className="font-semibold">
            {currentPage === 'kitchen' ? 'PC Order Receiver Mode' : 'Admin Console Mode'}
          </span>
          <div className="flex gap-4">
            <button
              onClick={() => navigateTo('menu')}
              className="text-cafe-300 hover:text-white underline font-medium"
            >
              ← Customer Ordering View
            </button>
            <button
              onClick={() => navigateTo(currentPage === 'kitchen' ? 'admin' : 'kitchen')}
              className="text-cafe-300 hover:text-white underline font-medium"
            >
              Switch to {currentPage === 'kitchen' ? 'Admin' : 'PC Kitchen'}
            </button>
          </div>
        </div>
      )}

      {/* Pages */}
      {currentPage === 'menu' && (
        <CustomerOrdering
          tableToken={tableToken}
          tableInfo={tableInfo}
          tableError={tableError}
          onSelectTableDemo={() => setShowTableModal(true)}
          onOrderSuccess={handleOrderSuccess}
          isCartOpen={isCartOpen}
          setIsCartOpen={setIsCartOpen}
          cartItems={cartItems}
          onCartItemsChange={setCartItems}
          currencySymbol="₹"
        />
      )}

      {currentPage === 'confirmation' && placedOrderData && (
        <OrderConfirmation
          order={placedOrderData.order}
          whatsappMessage={placedOrderData.whatsappMessage}
          whatsappUrl={placedOrderData.whatsappUrl}
          onTrackOrder={(orderNum) => {
            setTrackedOrderNumber(orderNum);
            setCurrentPage('tracking');
            window.history.pushState({}, '', `/track/${orderNum}`);
          }}
          onBackToMenu={() => navigateTo('menu')}
          currencySymbol="₹"
        />
      )}

      {currentPage === 'tracking' && trackedOrderNumber && (
        <OrderTracking
          orderNumber={trackedOrderNumber}
          qrToken={tableInfo?.qrToken}
          onBackToMenu={() => navigateTo('menu')}
          currencySymbol="₹"
        />
      )}

      {currentPage === 'kitchen' && (
        <KitchenDashboard currencySymbol="₹" onNavigate={navigateTo} />
      )}

      {currentPage === 'admin' && (
        <AdminDashboard currencySymbol="₹" onNavigate={navigateTo} />
      )}

      {/* Demo Table Selector Modal */}
      <TableDemoModal
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        onSelectToken={handleSelectTableToken}
        currentTableToken={tableToken}
      />
    </div>
  );
};
export default App;
