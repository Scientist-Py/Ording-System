import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, AlertOctagon, RefreshCw, QrCode } from 'lucide-react';
import { MenuCategory, MenuItem, CartItem, TableInfo, CustomerProfile } from '../types';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import { MenuCard } from '../components/MenuCard';
import { CartDrawer } from '../components/CartDrawer';
import { AssistanceBar } from '../components/AssistanceBar';

interface CustomerOrderingProps {
  tableToken: string | null;
  tableInfo: TableInfo | null;
  tableError: string | null;
  onSelectTableDemo: () => void;
  onOrderSuccess: (data: any) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  onCartItemsChange: (items: CartItem[]) => void;
  cartItems: CartItem[];
  currencySymbol?: string;
}

export const CustomerOrdering: React.FC<CustomerOrderingProps> = ({
  tableToken,
  tableInfo,
  tableError,
  onSelectTableDemo,
  onOrderSuccess,
  isCartOpen,
  setIsCartOpen,
  onCartItemsChange,
  cartItems,
  currencySymbol = '₹'
}) => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Customer recognition
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState(storage.getSpecialInstructions());

  // Load menu & customer profile
  useEffect(() => {
    loadMenu();
    identifySavedCustomer();
  }, []);

  const loadMenu = async () => {
    try {
      setLoading(true);
      const res = await api.getMenu();
      setCategories(res.categories);
      setItems(res.items);
    } catch (err) {
      console.error('[Menu] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const identifySavedCustomer = async () => {
    const deviceToken = storage.getDeviceToken();
    if (deviceToken) {
      try {
        const res = await api.identifyCustomer({ deviceToken });
        if (res.recognized && res.customer) {
          setCustomer(res.customer);
          storage.setCustomerProfile(res.customer);
        }
      } catch (e) {
        console.warn('Customer identify failed:', e);
      }
    }
  };

  // Cart operations
  const handleAddToCart = (itemToAdd: CartItem) => {
    const existingIndex = cartItems.findIndex(ci => ci.cartItemId === itemToAdd.cartItemId);
    let updated: CartItem[];
    if (existingIndex > -1) {
      updated = [...cartItems];
      updated[existingIndex].quantity += itemToAdd.quantity;
      updated[existingIndex].itemSubtotal = updated[existingIndex].unitPrice * updated[existingIndex].quantity;
    } else {
      updated = [...cartItems, itemToAdd];
    }
    onCartItemsChange(updated);
    storage.saveCart(updated);
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    const updated = cartItems.map(ci => {
      if (ci.cartItemId === cartItemId) {
        const newQty = Math.max(1, ci.quantity + delta);
        return {
          ...ci,
          quantity: newQty,
          itemSubtotal: ci.unitPrice * newQty
        };
      }
      return ci;
    });
    onCartItemsChange(updated);
    storage.saveCart(updated);
  };

  const handleRemoveItem = (cartItemId: string) => {
    const updated = cartItems.filter(ci => ci.cartItemId !== cartItemId);
    onCartItemsChange(updated);
    storage.saveCart(updated);
  };

  const handleSpecialInstructionsChange = (text: string) => {
    setSpecialInstructions(text);
    storage.saveSpecialInstructions(text);
  };

  // Filter items
  const filteredItems = items.filter(it => {
    if (activeCategory !== 'all' && it.category_id !== activeCategory) return false;
    if (vegOnly && !it.is_veg) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = it.name.toLowerCase().includes(q);
      const matchDesc = it.description?.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  // Calculate cart count & subtotal for floating button
  const totalCartCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);
  const totalCartSubtotal = cartItems.reduce((sum, it) => sum + it.itemSubtotal, 0);

  // If table QR is invalid or revoked, show secure error screen
  if (tableError) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 p-8 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <h2 className="font-serif font-bold text-xl text-ink-950">Invalid or Expired Table QR</h2>
          <p className="text-xs text-ink-600 leading-relaxed">{tableError}</p>
          <div className="pt-2">
            <button
              onClick={onSelectTableDemo}
              className="w-full py-3 px-4 rounded-xl bg-cafe-950 text-white text-xs font-semibold hover:bg-cafe-900 transition-colors"
            >
              Select Active Table / Simulate QR Scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* Table Assistance Bar */}
      {tableInfo && (
        <AssistanceBar qrToken={tableInfo.qrToken} tableNumber={tableInfo.tableNumber} />
      )}

      {/* Hero / Greeting Bar */}
      <section className="bg-gradient-to-b from-cafe-100/80 to-cafe-50 border-b border-cafe-200/60 pt-4 pb-5 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-cafe-700">
              Welcome to Chapter One Cafe
            </span>
            <h2 className="font-serif font-bold text-xl sm:text-2xl text-ink-950">
              {customer?.name ? `Delighted to have you, ${customer.name}` : 'Order from your table in seconds'}
            </h2>
          </div>

          {!tableInfo && (
            <button
              onClick={onSelectTableDemo}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-900 rounded-lg text-xs font-bold border border-amber-300 hover:bg-amber-200 transition-colors shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Table Not Selected • Tap to Pick</span>
            </button>
          )}
        </div>
      </section>

      {/* Search & Veg/Non-Veg Filter Bar */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, burgers, coffee, desserts..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-cafe-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-cafe-600 shadow-xs placeholder:text-ink-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 hover:text-ink-700"
              >
                Clear
              </button>
            )}
          </div>

          {/* Veg Only Toggle */}
          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all shrink-0 shadow-xs ${
              vegOnly
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                : 'bg-white border-cafe-200 text-ink-700 hover:bg-cafe-50'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>Veg Only</span>
          </button>
        </div>

        {/* Categories Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-3 mt-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
              activeCategory === 'all'
                ? 'bg-cafe-950 text-white'
                : 'bg-white border border-cafe-200 text-ink-700 hover:bg-cafe-100'
            }`}
          >
            All Items
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
                activeCategory === cat.id
                  ? 'bg-cafe-950 text-white'
                  : 'bg-white border border-cafe-200 text-ink-700 hover:bg-cafe-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <main className="max-w-5xl mx-auto px-4 mt-2">
        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 text-cafe-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-ink-500">Curating the Chapter One menu...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-cafe-200 p-12 text-center my-6">
            <p className="font-serif font-bold text-base text-cafe-900">No items match your search</p>
            <p className="text-xs text-ink-500 mt-1">Try resetting the filters or searching for something else.</p>
            <button
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
                setVegOnly(false);
              }}
              className="mt-3 text-xs font-bold text-cafe-700 underline"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                onAddToCart={handleAddToCart}
                currencySymbol={currencySymbol}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (Sticky Mobile CTA) */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 max-w-md mx-auto">
          <div
            onClick={() => setIsCartOpen(true)}
            className="bg-cafe-950 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between cursor-pointer hover:bg-cafe-900 transition-all border border-cafe-800 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-cafe-800 text-white text-xs font-bold flex items-center justify-center">
                {totalCartCount}
              </span>
              <div>
                <p className="text-[10px] uppercase font-bold text-cafe-400 leading-none">View Cart</p>
                <p className="font-serif font-bold text-sm text-white mt-0.5">
                  {currencySymbol}{totalCartSubtotal}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-cafe-200">
              <span>Review Order</span>
              <span className="text-base">→</span>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        table={tableInfo}
        customer={customer}
        onCustomerUpdated={setCustomer}
        specialInstructions={specialInstructions}
        onSpecialInstructionsChange={handleSpecialInstructionsChange}
        onOrderSuccess={onOrderSuccess}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
