import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  QrCode,
  UtensilsCrossed,
  Users,
  BarChart3,
  Settings,
  Plus,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  CheckCircle2,
  AlertTriangle,
  X,
  Printer,
  Sparkles,
  Phone,
  DollarSign,
  Monitor
} from 'lucide-react';
import { api } from '../services/api';
import { MenuItem, MenuCategory, CafeSettings } from '../types';

export const AdminDashboard: React.FC<{
  currencySymbol?: string;
  onNavigate?: (page: 'kitchen' | 'admin' | 'menu') => void;
}> = ({ currencySymbol = '₹', onNavigate }) => {
  const [adminPin, setAdminPin] = useState(localStorage.getItem('ch1_admin_pin') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'orders' | 'tables' | 'menu' | 'customers' | 'reports' | 'settings'>('tables');

  // Data states
  const [tables, setTables] = useState<any[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [cafeSettings, setCafeSettings] = useState<CafeSettings>({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals
  const [selectedQrTable, setSelectedQrTable] = useState<any | null>(null);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Item form state
  const [itemForm, setItemForm] = useState({
    name: '',
    categoryId: '',
    description: '',
    price: '',
    offerPrice: '',
    imageUrl: '',
    isVeg: true,
    isPopular: false
  });

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleLogin = async (pinToTest?: string) => {
    const pin = pinToTest || adminPin;
    if (!pin) {
      setAuthError('Please enter admin PIN');
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      // Test credentials against settings or tables endpoint
      await api.getTables(pin);
      setIsAuthenticated(true);
      localStorage.setItem('ch1_admin_pin', pin);
      loadCurrentTabData(activeTab, pin);
    } catch (err: any) {
      setAuthError('Invalid Admin PIN. (Default: 1234)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminPin) {
      handleLogin(adminPin);
    }
  }, []);

  const loadCurrentTabData = async (tab = activeTab, pin = adminPin) => {
    if (!isAuthenticated && !pin) return;
    setLoading(true);
    try {
      if (tab === 'tables') {
        const data = await api.getTables(pin);
        setTables(data);
      } else if (tab === 'menu') {
        const res = await api.getMenu();
        setCategories(res.categories);
        setMenuItems(res.items);
      } else if (tab === 'customers') {
        const data = await api.getCustomers(pin);
        setCustomers(data);
      } else if (tab === 'reports') {
        const data = await api.getReports(pin);
        setReports(data);
      } else if (tab === 'settings') {
        const data = await api.getSettings(pin);
        setCafeSettings(data);
      }
    } catch (err: any) {
      console.error('Load tab data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCurrentTabData(activeTab);
    }
  }, [activeTab, isAuthenticated]);

  // Table actions
  const handleRegenerateQr = async (tableId: string) => {
    if (!confirm('Are you sure you want to regenerate this QR code? The previously printed QR code will immediately stop working.')) return;
    try {
      const res = await api.regenerateQr(adminPin, tableId);
      showToast(res.message);
      loadCurrentTabData('tables');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeQr = async (tableId: string) => {
    if (!confirm('Revoke this table QR code? Customers will be blocked from placing orders until regenerated.')) return;
    try {
      const res = await api.revokeQr(adminPin, tableId);
      showToast(res.message);
      loadCurrentTabData('tables');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCloseSession = async (tableId: string) => {
    if (!confirm('Close this active session and reset the table? Current orders will remain archived.')) return;
    try {
      const res = await api.closeSession(adminPin, tableId);
      showToast(res.message);
      loadCurrentTabData('tables');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return;
    try {
      await api.createTable(adminPin, newTableName.trim());
      setNewTableName('');
      setShowAddTableModal(false);
      showToast('New table added successfully');
      loadCurrentTabData('tables');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Menu actions
  const handleToggleAvailability = async (itemId: string, current: boolean) => {
    try {
      const res = await api.toggleItemAvailability(adminPin, itemId, !current);
      showToast(res.message);
      setMenuItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: !current } : i));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Delete this menu item?')) return;
    try {
      await api.deleteMenuItem(adminPin, itemId);
      showToast('Item deleted');
      setMenuItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenItemModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        name: item.name,
        categoryId: item.category_id,
        description: item.description || '',
        price: String(item.price),
        offerPrice: item.offer_price ? String(item.offer_price) : '',
        imageUrl: item.image_url || '',
        isVeg: item.is_veg,
        isPopular: item.is_popular
      });
    } else {
      setEditingItem(null);
      setItemForm({
        name: '',
        categoryId: categories[0]?.id || '',
        description: '',
        price: '',
        offerPrice: '',
        imageUrl: '',
        isVeg: true,
        isPopular: false
      });
    }
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.price || !itemForm.categoryId) {
      alert('Please fill name, price, and category');
      return;
    }
    try {
      if (editingItem) {
        await api.updateMenuItem(adminPin, editingItem.id, {
          name: itemForm.name,
          categoryId: itemForm.categoryId,
          description: itemForm.description,
          price: parseFloat(itemForm.price),
          offerPrice: itemForm.offerPrice ? parseFloat(itemForm.offerPrice) : null,
          imageUrl: itemForm.imageUrl || null,
          isVeg: itemForm.isVeg,
          isPopular: itemForm.isPopular,
          customizations: editingItem.customizations || []
        });
        showToast('Item updated successfully');
      } else {
        await api.createMenuItem(adminPin, {
          name: itemForm.name,
          categoryId: itemForm.categoryId,
          description: itemForm.description,
          price: parseFloat(itemForm.price),
          offerPrice: itemForm.offerPrice ? parseFloat(itemForm.offerPrice) : null,
          imageUrl: itemForm.imageUrl || null,
          isVeg: itemForm.isVeg,
          isPopular: itemForm.isPopular,
          customizations: []
        });
        showToast('Item created successfully');
      }
      setShowItemModal(false);
      loadCurrentTabData('menu');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await api.createCategory(adminPin, newCategoryName.trim());
      setNewCategoryName('');
      setShowCategoryModal(false);
      showToast('Category created');
      loadCurrentTabData('menu');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Customer actions
  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Delete this customer profile permanently? (GDPR/Privacy)')) return;
    try {
      await api.deleteCustomer(adminPin, customerId);
      showToast('Customer profile deleted');
      setCustomers(prev => prev.filter(c => c.id !== customerId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Settings action
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings(adminPin, cafeSettings);
      showToast('Settings saved successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // PIN Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cafe-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-cafe-200 p-8 shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-cafe-950 text-cafe-300 flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <h2 className="font-serif font-bold text-xl text-cafe-950">Cafe Admin Portal</h2>
            <p className="text-xs text-ink-500 mt-1">Please enter your 4-digit security PIN</p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="Enter PIN (Default: 1234)"
              maxLength={8}
              className="w-full text-center text-lg tracking-widest font-mono p-3 rounded-xl border border-cafe-200 focus:outline-none focus:ring-2 focus:ring-cafe-800"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />

            <button
              onClick={() => handleLogin()}
              disabled={loading}
              className="w-full py-3 bg-cafe-950 hover:bg-cafe-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              {loading ? 'Authenticating...' : 'Unlock Dashboard'}
            </button>
          </div>

          <p className="text-[11px] text-ink-400">Default administrative PIN is 1234</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cafe-50 pb-16">
      
      {/* Admin Header */}
      <header className="bg-cafe-950 text-white border-b border-cafe-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cafe-800 flex items-center justify-center text-cafe-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg leading-tight">Chapter One Cafe — Admin Console</h1>
              <p className="text-[10px] text-cafe-400 font-mono">STANDALONE SECURE SYSTEM</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[
              { key: 'tables', label: 'Tables & QR', icon: QrCode },
              { key: 'menu', label: 'Menu Editor', icon: UtensilsCrossed },
              { key: 'customers', label: 'Customers CRM', icon: Users },
              { key: 'reports', label: 'Analytics', icon: BarChart3 },
              { key: 'settings', label: 'Settings', icon: Settings }
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-cafe-800 text-white'
                      : 'text-cafe-300 hover:bg-cafe-900 hover:text-white'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <button
              onClick={() => onNavigate ? onNavigate('kitchen') : window.location.href = '/kitchen'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm ml-2 whitespace-nowrap transition-colors"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Live Kitchen Screen</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 bg-cafe-950 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in slide-in-from-top">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        
        {/* ======================================= */}
        {/* TAB 1: TABLES & SECURE QR MANAGEMENT */}
        {/* ======================================= */}
        {activeTab === 'tables' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif font-bold text-xl text-cafe-950">Table QR Codes & Sessions</h2>
                <p className="text-xs text-ink-500">Generate, revoke, or regenerate cryptographic table tokens.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddTableModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-cafe-950 text-white rounded-xl text-xs font-bold hover:bg-cafe-900 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Table</span>
                </button>

                <button
                  onClick={() => loadCurrentTabData('tables')}
                  className="p-2 bg-white border border-cafe-200 text-cafe-800 rounded-xl hover:bg-cafe-100"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tables.map(tbl => (
                <div
                  key={tbl.id}
                  className={`bg-white rounded-2xl border p-4 flex flex-col justify-between shadow-xs ${
                    tbl.is_revoked ? 'border-rose-300 bg-rose-50/20' : 'border-cafe-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-serif font-bold text-lg text-ink-950">{tbl.table_number}</h3>
                        <p className="text-[10px] text-ink-400 font-mono truncate max-w-[140px]">
                          Token: {tbl.qr_token.slice(0, 10)}...
                        </p>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        tbl.is_revoked
                          ? 'bg-rose-100 text-rose-700'
                          : tbl.status === 'OCCUPIED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {tbl.is_revoked ? 'Revoked' : tbl.status}
                      </span>
                    </div>

                    {/* Active Session info */}
                    <div className="my-3 p-2.5 rounded-xl bg-cafe-50 border border-cafe-100 text-xs space-y-1">
                      <div className="flex justify-between text-ink-600">
                        <span>Active Session:</span>
                        <span className="font-mono font-bold text-cafe-900">{tbl.session_code || 'None'}</span>
                      </div>
                      <div className="flex justify-between text-ink-600">
                        <span>Orders in sitting:</span>
                        <span className="font-semibold">{tbl.session_order_count || 0}</span>
                      </div>
                      <div className="flex justify-between text-ink-900 font-bold pt-1 border-t border-cafe-200/50">
                        <span>Running Total:</span>
                        <span className="font-serif">{currencySymbol}{tbl.running_total || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: View QR, Regenerate, Close Session */}
                  <div className="space-y-2 pt-2 border-t border-cafe-100">
                    <button
                      onClick={() => setSelectedQrTable(tbl)}
                      className="w-full py-2 bg-cafe-100 hover:bg-cafe-200 text-cafe-900 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>View & Print QR Code</span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => handleRegenerateQr(tbl.id)}
                        className="py-1.5 px-2 bg-white hover:bg-cafe-50 border border-cafe-200 text-[11px] font-semibold text-cafe-800 rounded-lg"
                      >
                        Regen Token
                      </button>

                      {tbl.is_revoked ? (
                        <button
                          onClick={() => handleRegenerateQr(tbl.id)}
                          className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded-lg"
                        >
                          Restore QR
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRevokeQr(tbl.id)}
                          className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold rounded-lg"
                        >
                          Revoke QR
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleCloseSession(tbl.id)}
                      className="w-full py-1 text-[11px] text-cafe-600 hover:text-cafe-900 font-medium"
                    >
                      Close Session & Reset Table
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 2: MENU MANAGEMENT */}
        {/* ======================================= */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif font-bold text-xl text-cafe-950">Menu & Offerings</h2>
                <p className="text-xs text-ink-500">Manage categories, items, prices, and sold-out states.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="px-3 py-2 bg-white border border-cafe-300 text-cafe-900 rounded-xl text-xs font-bold hover:bg-cafe-100"
                >
                  + Add Category
                </button>
                <button
                  onClick={() => handleOpenItemModal()}
                  className="px-3 py-2 bg-cafe-950 text-white rounded-xl text-xs font-bold hover:bg-cafe-900 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Dish / Drink</span>
                </button>
              </div>
            </div>

            {/* Menu Items Table */}
            <div className="bg-white rounded-2xl border border-cafe-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cafe-50 border-b border-cafe-200 text-cafe-800 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cafe-100">
                    {menuItems.map(item => {
                      const catName = categories.find(c => c.id === item.category_id)?.name || 'General';
                      return (
                        <tr key={item.id} className="hover:bg-cafe-50/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                              <div>
                                <span className="font-bold text-sm text-ink-950">{item.name}</span>
                                {item.is_popular && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                                    Popular
                                  </span>
                                )}
                                <p className="text-[11px] text-ink-400 line-clamp-1">{item.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-cafe-800">{catName}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-cafe-900">
                              {currencySymbol}{item.offer_price || item.price}
                            </span>
                            {item.offer_price && (
                              <span className="ml-1 text-[10px] text-ink-400 line-through">
                                {currencySymbol}{item.price}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleAvailability(item.id, item.is_available)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                item.is_available
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                              }`}
                            >
                              {item.is_available ? 'Available' : 'Sold Out'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenItemModal(item)}
                                className="p-1.5 text-cafe-700 hover:text-cafe-950 hover:bg-cafe-100 rounded"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 3: CUSTOMERS CRM & LOYALTY */}
        {/* ======================================= */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif font-bold text-xl text-cafe-950">Customer Profiles & Loyalty</h2>
              <p className="text-xs text-ink-500">Persistent device tokens, visit counts, and lifetime value.</p>
            </div>

            <div className="bg-white rounded-2xl border border-cafe-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-cafe-50 border-b border-cafe-200 text-cafe-800 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Visits</th>
                    <th className="py-3 px-4">Orders Placed</th>
                    <th className="py-3 px-4">Total Spent</th>
                    <th className="py-3 px-4">Loyalty Points</th>
                    <th className="py-3 px-4 text-right">Privacy / GDPR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cafe-100">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-cafe-50/50">
                      <td className="py-3 px-4 font-bold text-ink-900">{c.name}</td>
                      <td className="py-3 px-4 font-mono text-ink-600">{c.phone}</td>
                      <td className="py-3 px-4">{c.total_visits}</td>
                      <td className="py-3 px-4">{c.total_orders}</td>
                      <td className="py-3 px-4 font-semibold text-cafe-900">{currencySymbol}{c.total_spent}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">{c.loyalty_points}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteCustomer(c.id)}
                          title="Delete customer record"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-ink-400">
                        No customer profiles registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 4: ANALYTICS & REPORTS */}
        {/* ======================================= */}
        {activeTab === 'reports' && reports && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif font-bold text-xl text-cafe-950">Analytics & Sales Reports</h2>
              <p className="text-xs text-ink-500">Live cafe insights, turnover, and popular items.</p>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-cafe-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cafe-600">Today's Revenue</span>
                <p className="font-serif font-bold text-2xl text-cafe-950 mt-1">
                  {currencySymbol}{reports.todayRevenue}
                </p>
                <span className="text-[11px] text-ink-500">{reports.todayOrders} orders today</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-cafe-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cafe-600">Average Order Value</span>
                <p className="font-serif font-bold text-2xl text-cafe-950 mt-1">
                  {currencySymbol}{reports.averageOrderValue}
                </p>
                <span className="text-[11px] text-ink-500">Per table sitting</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-cafe-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cafe-600">Total Lifetime Orders</span>
                <p className="font-serif font-bold text-2xl text-cafe-950 mt-1">
                  {reports.totalOrders}
                </p>
                <span className="text-[11px] text-ink-500">All-time database count</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-cafe-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cafe-600">Customer Base</span>
                <p className="font-serif font-bold text-2xl text-cafe-950 mt-1">
                  {reports.customers?.total_customers || 0}
                </p>
                <span className="text-[11px] text-ink-500">
                  {reports.customers?.returning_customers || 0} returning ({Math.round(((reports.customers?.returning_customers || 0) / (reports.customers?.total_customers || 1)) * 100)}%)
                </span>
              </div>
            </div>

            {/* Popular Items & Table Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-cafe-200 space-y-3">
                <h3 className="font-serif font-bold text-base text-cafe-950">Top Selling Delights</h3>
                <div className="space-y-2 text-xs">
                  {reports.popularItems?.map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-cafe-50 last:border-0">
                      <span className="font-medium text-ink-900">{idx + 1}. {it.item_name}</span>
                      <span className="font-bold text-cafe-800">{it.total_sold} sold ({currencySymbol}{it.total_earned})</span>
                    </div>
                  ))}
                  {(!reports.popularItems || reports.popularItems.length === 0) && (
                    <p className="text-ink-400 text-xs">No orders recorded yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-cafe-200 space-y-3">
                <h3 className="font-serif font-bold text-base text-cafe-950">Revenue by Table</h3>
                <div className="space-y-2 text-xs">
                  {reports.ordersByTable?.map((tbl: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-cafe-50 last:border-0">
                      <span className="font-medium text-ink-900">{tbl.table_number}</span>
                      <span className="font-bold text-cafe-800">{tbl.order_count} orders • {currencySymbol}{tbl.revenue}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 5: SYSTEM SETTINGS */}
        {/* ======================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-white p-6 sm:p-8 rounded-3xl border border-cafe-200 shadow-xs space-y-6">
            <div>
              <h2 className="font-serif font-bold text-xl text-cafe-950">System & WhatsApp Settings</h2>
              <p className="text-xs text-ink-500">Configure cafe branding, WhatsApp number, and security.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-ink-700 mb-1">Cafe Name</label>
                <input
                  type="text"
                  value={cafeSettings.cafe_name || ''}
                  onChange={(e) => setCafeSettings(s => ({ ...s, cafe_name: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-cafe-200"
                />
              </div>

              <div>
                <label className="block font-bold text-ink-700 mb-1">
                  Cafe WhatsApp Number (With Country Code) *
                </label>
                <input
                  type="text"
                  value={cafeSettings.whatsapp_number || ''}
                  onChange={(e) => setCafeSettings(s => ({ ...s, whatsapp_number: e.target.value }))}
                  placeholder="919876543210"
                  className="w-full p-2.5 rounded-xl border border-cafe-200 font-mono"
                />
                <p className="text-[10px] text-ink-400 mt-1">
                  Customers will send their prefilled order messages directly to this WhatsApp number.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-ink-700 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={cafeSettings.currency_symbol || '₹'}
                    onChange={(e) => setCafeSettings(s => ({ ...s, currency_symbol: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-cafe-200 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-ink-700 mb-1">Admin PIN</label>
                  <input
                    type="password"
                    value={cafeSettings.admin_pin || ''}
                    onChange={(e) => setCafeSettings(s => ({ ...s, admin_pin: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-cafe-200 font-mono tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="py-3 px-6 bg-cafe-950 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-cafe-900"
              >
                Save Settings
              </button>
            </form>
          </div>
        )}

      </main>

      {/* QR Code Printable Modal */}
      {selectedQrTable && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="font-serif font-bold text-lg text-cafe-950">Table QR Code</h3>
              <button
                onClick={() => setSelectedQrTable(null)}
                className="w-7 h-7 rounded-full bg-cafe-100 flex items-center justify-center text-ink-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable QR Card */}
            <div id="printable-qr" className="p-6 bg-cafe-50 rounded-2xl border-2 border-cafe-300 text-center space-y-3">
              <p className="font-serif font-bold text-xl text-cafe-950">CHAPTER ONE CAFE</p>
              <p className="text-[11px] uppercase tracking-wider font-bold text-cafe-700">Scan to Order from Table</p>
              
              <div className="w-48 h-48 mx-auto bg-white p-2 rounded-xl border border-cafe-200 shadow-sm flex items-center justify-center">
                {selectedQrTable.qrDataUrl ? (
                  <img src={selectedQrTable.qrDataUrl} alt="Table QR" className="w-full h-full" />
                ) : (
                  <QrCode className="w-24 h-24 text-cafe-300" />
                )}
              </div>

              <div className="pt-1">
                <span className="font-serif font-bold text-xl text-cafe-950">{selectedQrTable.table_number}</span>
                <p className="text-[9px] text-ink-400 font-mono mt-0.5">Token: {selectedQrTable.qr_token}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-cafe-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Standee Card</span>
              </button>
              <button
                onClick={() => {
                  window.open(selectedQrTable.qrUrl, '_blank');
                }}
                className="py-2.5 px-4 bg-cafe-100 hover:bg-cafe-200 text-cafe-900 rounded-xl text-xs font-bold"
              >
                Open URL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-serif font-bold text-base text-cafe-950">Add New Cafe Table</h3>
            <input
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="e.g. Table 07, Terrace, Balcony..."
              className="w-full p-2.5 rounded-xl border border-cafe-200 text-xs"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateTable}
                className="flex-1 py-2.5 bg-cafe-950 text-white rounded-xl text-xs font-bold"
              >
                Create Table
              </button>
              <button
                onClick={() => setShowAddTableModal(false)}
                className="py-2.5 px-4 bg-cafe-100 text-ink-700 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal (Create/Edit) */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-cafe-100 pb-3">
              <h3 className="font-serif font-bold text-base text-cafe-950">
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              <button onClick={() => setShowItemModal(false)}>
                <X className="w-4 h-4 text-ink-500" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Item Name *</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Truffle Mushroom Burger"
                  className="w-full p-2.5 rounded-xl border border-cafe-200"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Category *</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-cafe-200 bg-white"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Standard Price ({currencySymbol}) *</label>
                  <input
                    type="number"
                    value={itemForm.price}
                    onChange={(e) => setItemForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="250"
                    className="w-full p-2.5 rounded-xl border border-cafe-200"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Special Offer Price</label>
                  <input
                    type="number"
                    value={itemForm.offerPrice}
                    onChange={(e) => setItemForm(f => ({ ...f, offerPrice: e.target.value }))}
                    placeholder="Optional discount"
                    className="w-full p-2.5 rounded-xl border border-cafe-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Appetizing dish ingredients and details..."
                  className="w-full p-2.5 rounded-xl border border-cafe-200"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Image URL (Unsplash or hosted)</label>
                <input
                  type="url"
                  value={itemForm.imageUrl}
                  onChange={(e) => setItemForm(f => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-xl border border-cafe-200"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.isVeg}
                    onChange={(e) => setItemForm(f => ({ ...f, isVeg: e.target.checked }))}
                    className="rounded text-emerald-600"
                  />
                  <span>Vegetarian</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.isPopular}
                    onChange={(e) => setItemForm(f => ({ ...f, isPopular: e.target.checked }))}
                    className="rounded text-amber-600"
                  />
                  <span>Popular Item</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-cafe-100">
              <button
                onClick={handleSaveItem}
                className="flex-1 py-3 bg-cafe-950 text-white rounded-xl text-xs font-bold uppercase"
              >
                Save Menu Item
              </button>
              <button
                onClick={() => setShowItemModal(false)}
                className="py-3 px-4 bg-cafe-100 text-ink-700 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-serif font-bold text-base text-cafe-950">Add Menu Category</h3>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Artisanal Breads, Mocktails..."
              className="w-full p-2.5 rounded-xl border border-cafe-200 text-xs"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateCategory}
                className="flex-1 py-2.5 bg-cafe-950 text-white rounded-xl text-xs font-bold"
              >
                Save Category
              </button>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="py-2.5 px-4 bg-cafe-100 text-ink-700 rounded-xl text-xs"
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
