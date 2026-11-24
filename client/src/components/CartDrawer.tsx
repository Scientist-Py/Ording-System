import React, { useState } from 'react';
import { X, Trash2, ShoppingBag, ShieldCheck, UserCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { CartItem, CustomerProfile, TableInfo } from '../types';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import { soundManager } from '../utils/audio';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  table: TableInfo | null;
  customer: CustomerProfile | null;
  onCustomerUpdated: (profile: CustomerProfile | null) => void;
  specialInstructions: string;
  onSpecialInstructionsChange: (note: string) => void;
  onOrderSuccess: (orderData: any) => void;
  currencySymbol?: string;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  table,
  customer,
  onCustomerUpdated,
  specialInstructions,
  onSpecialInstructionsChange,
  onOrderSuccess,
  currencySymbol = '₹'
}) => {
  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [consentSaved, setConsentSaved] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if customer profile loads
  React.useEffect(() => {
    if (customer) {
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone);
    }
  }, [customer]);

  if (!isOpen) return null;

  const totalAmount = items.reduce((sum, item) => sum + item.itemSubtotal, 0);

  const handleForgetDevice = async () => {
    const token = storage.getDeviceToken();
    if (token) {
      await api.forgetCustomer(token);
    }
    storage.clearDeviceToken();
    onCustomerUpdated(null);
    setCustomerName('');
    setCustomerPhone('');
  };

  const handlePlaceOrder = async () => {
    setErrorMsg(null);

    if (!table) {
      setErrorMsg('No table selected. Please scan a table QR code.');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Your cart is empty. Please add items to order.');
      return;
    }

    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');

    if (!cleanName) {
      setErrorMsg('Please enter your name.');
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Identify or register customer profile
      let customerId = customer?.id;
      let activeDeviceToken = storage.getDeviceToken();

      const idRes = await api.identifyCustomer({
        deviceToken: activeDeviceToken,
        name: cleanName,
        phone: cleanPhone,
        consentSaved
      });

      if (idRes.customer) {
        customerId = idRes.customer.id;
        onCustomerUpdated(idRes.customer);
      }
      if (idRes.deviceToken && consentSaved) {
        storage.setDeviceToken(idRes.deviceToken);
      }

      // 2. Format items for server payload
      const orderPayloadItems = items.map(ci => ({
        menuItemId: ci.item.id,
        quantity: ci.quantity,
        customizations: ci.selectedCustomizations.map(c => ({
          groupName: c.groupName,
          optionName: c.optionName
        }))
      }));

      // 3. Generate client idempotency key to prevent accidental double orders
      const idempotencyKey = crypto.randomUUID();

      // 4. Place order with server price validation
      const result = await api.placeOrder({
        qrToken: table.qrToken,
        customerId,
        customerName: cleanName,
        customerPhone: cleanPhone,
        items: orderPayloadItems,
        specialInstructions,
        idempotencyKey
      });

      // 5. Sound feedback & clear cart
      soundManager.playOrderSuccess();
      storage.clearCart();
      onClose();
      onOrderSuccess(result);

    } catch (err: any) {
      console.error('[Cart] Place order error:', err);
      setErrorMsg(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-cafe-200 flex items-center justify-between bg-cafe-50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-cafe-900" />
            <h2 className="font-serif font-bold text-lg text-cafe-950">Your Order</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Cart"
            className="w-8 h-8 rounded-full bg-cafe-200/70 hover:bg-cafe-300 flex items-center justify-center text-ink-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Assigned Table Banner */}
        <div className="bg-cafe-100/70 px-4 py-2 border-b border-cafe-200 flex items-center justify-between text-xs">
          <span className="text-cafe-700 font-medium">Assigned Table:</span>
          <span className="font-bold text-cafe-950 bg-white px-2 py-0.5 rounded border border-cafe-200">
            {table ? table.tableNumber : 'No Table Assigned'}
          </span>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cart Items */}
          {items.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-12 h-12 text-cafe-300 mx-auto mb-3" />
              <p className="font-serif font-bold text-base text-cafe-900">Your cart is empty</p>
              <p className="text-xs text-ink-500 mt-1">Browse the menu to add delicious bites & brews.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600">
                Order Items ({items.length})
              </h3>

              <div className="divide-y divide-cafe-100 border border-cafe-200 rounded-xl overflow-hidden bg-white">
                {items.map((ci) => (
                  <div key={ci.cartItemId} className="p-3 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ci.item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                        <h4 className="font-semibold text-sm text-ink-900">{ci.item.name}</h4>
                      </div>

                      {/* Customizations summary */}
                      {ci.selectedCustomizations.length > 0 && (
                        <p className="text-[11px] text-cafe-700 mt-0.5">
                          {ci.selectedCustomizations.map(c => c.optionName).join(', ')}
                        </p>
                      )}

                      <p className="text-xs font-semibold text-cafe-900 mt-1">
                        {currencySymbol}{ci.unitPrice} each
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2 border border-cafe-200 rounded-lg p-0.5 bg-cafe-50">
                        <button
                          onClick={() => {
                            if (ci.quantity > 1) {
                              onUpdateQuantity(ci.cartItemId, -1);
                            } else {
                              onRemoveItem(ci.cartItemId);
                            }
                          }}
                          className="w-6 h-6 rounded bg-white text-ink-700 hover:bg-cafe-100 flex items-center justify-center text-xs font-bold shadow-xs"
                        >
                          {ci.quantity === 1 ? <Trash2 className="w-3 h-3 text-rose-500" /> : '-'}
                        </button>
                        <span className="font-bold text-xs w-4 text-center">{ci.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(ci.cartItemId, 1)}
                          className="w-6 h-6 rounded bg-white text-ink-700 hover:bg-cafe-100 flex items-center justify-center text-xs font-bold shadow-xs"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-bold text-xs text-ink-900">
                        {currencySymbol}{ci.itemSubtotal}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {items.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-600 mb-1.5">
                Special Kitchen Instructions (Optional)
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => onSpecialInstructionsChange(e.target.value)}
                placeholder="E.g., No onions, extra spicy, sauce on the side..."
                rows={2}
                maxLength={200}
                className="w-full text-xs p-3 rounded-xl border border-cafe-200 focus:outline-none focus:ring-1 focus:ring-cafe-600 bg-cafe-50/50"
              />
            </div>
          )}

          {/* Customer Recognition / Details */}
          {items.length > 0 && (
            <div className="p-4 rounded-xl border border-cafe-200 bg-cafe-50/60 space-y-3">
              {customer?.id ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span>Welcome back, {customer.name}!</span>
                    </div>
                    <button
                      onClick={handleForgetDevice}
                      className="text-[10px] text-cafe-700 underline hover:text-cafe-900"
                    >
                      Not you?
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-1">
                    Visit #{customer.totalVisits || 1} • {customer.loyaltyPoints || 0} Loyalty Points
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cafe-950">
                    <ShieldCheck className="w-4 h-4 text-cafe-700" />
                    <span>Customer Details</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink-600 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full text-xs p-2.5 rounded-lg border border-cafe-200 focus:outline-none focus:ring-1 focus:ring-cafe-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink-600 mb-1">
                      WhatsApp Mobile Number *
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      className="w-full text-xs p-2.5 rounded-lg border border-cafe-200 focus:outline-none focus:ring-1 focus:ring-cafe-600 bg-white font-mono"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={consentSaved}
                      onChange={(e) => setConsentSaved(e.target.checked)}
                      className="rounded text-cafe-800 focus:ring-cafe-600"
                    />
                    <span className="text-[11px] text-ink-600">
                      Save profile securely on this device for faster future orders
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer / Checkout CTA */}
        {items.length > 0 && (
          <div className="p-4 border-t border-cafe-200 bg-cafe-50 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-ink-600">
                <span>Subtotal</span>
                <span>{currencySymbol}{totalAmount}</span>
              </div>
              <div className="flex justify-between font-serif font-bold text-base text-cafe-950 pt-1 border-t border-cafe-200">
                <span>Total Amount</span>
                <span>{currencySymbol}{totalAmount}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || items.length === 0}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-md ${
                isSubmitting
                  ? 'bg-cafe-800 text-cafe-200 cursor-wait'
                  : 'bg-cafe-950 text-white hover:bg-cafe-900 active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Validating & Placing Order...</span>
                </>
              ) : (
                <>
                  <span>PLACE ORDER</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-ink-400">
              Validated server-side • Kitchen alerts instantly triggered
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
