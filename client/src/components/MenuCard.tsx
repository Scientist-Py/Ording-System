import React, { useState } from 'react';
import { Plus, Check, Star, Sparkles, X } from 'lucide-react';
import { MenuItem, SelectedCustomization, CartItem } from '../types';

interface MenuCardProps {
  item: MenuItem;
  onAddToCart: (cartItem: CartItem) => void;
  currencySymbol?: string;
}

export const MenuCard: React.FC<MenuCardProps> = ({
  item,
  onAddToCart,
  currencySymbol = '₹'
}) => {
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, { optionName: string; extraPrice: number }>>({});
  const [customQty, setCustomQty] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);

  const hasCustomizations = item.customizations && item.customizations.length > 0;
  const effectivePrice = item.offer_price !== null && item.offer_price !== undefined ? item.offer_price : item.price;

  // Initialize defaults when opening customization modal
  const handleOpenCustomize = () => {
    if (!item.is_available) return;
    const initial: Record<string, { optionName: string; extraPrice: number }> = {};
    item.customizations.forEach(g => {
      if (g.options.length > 0) {
        initial[g.name] = {
          optionName: g.options[0].name,
          extraPrice: g.options[0].price
        };
      }
    });
    setSelectedOptions(initial);
    setCustomQty(1);
    setShowCustomizeModal(true);
  };

  const handleQuickAdd = () => {
    if (!item.is_available) return;
    if (hasCustomizations) {
      handleOpenCustomize();
      return;
    }

    const cartItem: CartItem = {
      cartItemId: `${item.id}`,
      item,
      quantity: 1,
      selectedCustomizations: [],
      unitPrice: effectivePrice,
      itemSubtotal: effectivePrice
    };

    onAddToCart(cartItem);
    triggerAddedFeedback();
  };

  const handleConfirmCustomization = () => {
    const customizationsArray: SelectedCustomization[] = Object.entries(selectedOptions).map(([groupName, opt]) => ({
      groupName,
      optionName: opt.optionName,
      extraPrice: opt.extraPrice
    }));

    const extraTotal = customizationsArray.reduce((sum, c) => sum + c.extraPrice, 0);
    const unitPrice = effectivePrice + extraTotal;

    const optKey = customizationsArray.map(c => `${c.groupName}:${c.optionName}`).sort().join('|');
    const cartItemId = `${item.id}_${optKey}`;

    const cartItem: CartItem = {
      cartItemId,
      item,
      quantity: customQty,
      selectedCustomizations: customizationsArray,
      unitPrice,
      itemSubtotal: unitPrice * customQty
    };

    onAddToCart(cartItem);
    setShowCustomizeModal(false);
    triggerAddedFeedback();
  };

  const triggerAddedFeedback = () => {
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 900);
  };

  // Calculate live preview total inside modal
  const modalExtraTotal = Object.values(selectedOptions).reduce((sum, o) => sum + o.extraPrice, 0);
  const modalItemTotal = (effectivePrice + modalExtraTotal) * customQty;

  return (
    <>
      <div className={`bg-white rounded-2xl border border-cafe-200/80 p-4 flex gap-4 transition-all hover:shadow-md hover:border-cafe-300 ${
        !item.is_available ? 'opacity-65 grayscale-[30%]' : ''
      }`}>
        
        {/* Left: Info */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            {/* Badges: Veg/Non-Veg & Popular */}
            <div className="flex items-center gap-2 mb-1.5">
              {/* Veg / Non-Veg Indicator */}
              <div
                title={item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
                className={`w-4 h-4 rounded-sm border flex items-center justify-center p-0.5 ${
                  item.is_veg ? 'border-emerald-600' : 'border-rose-600'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
              </div>

              {item.is_popular && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                  Popular
                </span>
              )}

              {item.offer_price !== null && item.offer_price !== undefined && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                  <Sparkles className="w-2.5 h-2.5" />
                  Special Offer
                </span>
              )}
            </div>

            {/* Name */}
            <h3 className="font-serif font-bold text-base text-ink-900 leading-snug">
              {item.name}
            </h3>

            {/* Price */}
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-semibold text-base text-cafe-900">
                {currencySymbol}{effectivePrice}
              </span>
              {item.offer_price !== null && item.offer_price !== undefined && item.offer_price < item.price && (
                <span className="text-xs text-ink-400 line-through">
                  {currencySymbol}{item.price}
                </span>
              )}
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-xs text-ink-500 mt-1 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            )}
          </div>

          {/* Customization label */}
          {hasCustomizations && item.is_available && (
            <div className="mt-2 text-[11px] font-medium text-cafe-700 flex items-center gap-1">
              <span>Customizable options available</span>
            </div>
          )}
        </div>

        {/* Right: Food Image & Add Button */}
        <div className="w-28 flex flex-col items-center justify-between shrink-0 relative">
          <div className="w-28 h-24 rounded-xl overflow-hidden bg-cafe-100 relative shadow-inner">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  // Fallback placeholder
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-cafe-300 text-xs">
                Chapter One
              </div>
            )}

            {!item.is_available && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                <span className="bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow">
                  Sold Out
                </span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="w-full mt-2">
            {!item.is_available ? (
              <button
                disabled
                className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              >
                Sold Out
              </button>
            ) : (
              <button
                onClick={hasCustomizations ? handleOpenCustomize : handleQuickAdd}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all flex items-center justify-center gap-1 shadow-xs active:scale-95 ${
                  addedAnimation
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-cafe-300 text-cafe-900 hover:bg-cafe-950 hover:text-white hover:border-cafe-950'
                }`}
              >
                {addedAnimation ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Added</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{hasCustomizations ? 'Custom' : 'Add'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customization Modal */}
      {showCustomizeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-cafe-200 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-ink-950">{item.name}</h3>
                <p className="text-xs text-cafe-700">Choose your preferences</p>
              </div>
              <button
                onClick={() => setShowCustomizeModal(false)}
                className="w-8 h-8 rounded-full bg-cafe-100 hover:bg-cafe-200 flex items-center justify-center text-ink-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Customization Groups */}
            <div className="p-5 overflow-y-auto space-y-5 divide-y divide-cafe-100">
              {item.customizations.map((group) => (
                <div key={group.name} className="pt-4 first:pt-0">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700 mb-2.5">
                    {group.name}
                  </h4>
                  <div className="space-y-2">
                    {group.options.map((opt) => {
                      const isSelected = selectedOptions[group.name]?.optionName === opt.name;
                      return (
                        <label
                          key={opt.name}
                          onClick={() => {
                            setSelectedOptions(prev => ({
                              ...prev,
                              [group.name]: { optionName: opt.name, extraPrice: opt.price }
                            }));
                          }}
                          className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                            isSelected
                              ? 'border-cafe-700 bg-cafe-50 font-medium text-cafe-950'
                              : 'border-cafe-200 hover:border-cafe-300 text-ink-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name={group.name}
                              checked={isSelected}
                              onChange={() => {}}
                              className="text-cafe-800 focus:ring-cafe-500"
                            />
                            <span>{opt.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-cafe-800">
                            {opt.price > 0 ? `+${currencySymbol}${opt.price}` : 'Free'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Quantity selector */}
              <div className="pt-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-700">Quantity</span>
                <div className="flex items-center gap-3 border border-cafe-200 rounded-lg p-1 bg-cafe-50">
                  <button
                    onClick={() => setCustomQty(q => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded bg-white text-ink-800 font-bold hover:bg-cafe-100 flex items-center justify-center shadow-xs"
                  >
                    -
                  </button>
                  <span className="font-semibold text-sm w-5 text-center">{customQty}</span>
                  <button
                    onClick={() => setCustomQty(q => q + 1)}
                    className="w-7 h-7 rounded bg-white text-ink-800 font-bold hover:bg-cafe-100 flex items-center justify-center shadow-xs"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-cafe-200 bg-cafe-50 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] text-ink-500 uppercase font-semibold">Total Price</p>
                <p className="font-serif font-bold text-lg text-cafe-950">
                  {currencySymbol}{modalItemTotal}
                </p>
              </div>
              <button
                onClick={handleConfirmCustomization}
                className="flex-1 py-3 px-5 rounded-xl bg-cafe-950 text-white font-bold text-sm tracking-wide hover:bg-cafe-900 active:scale-98 transition-all shadow-md"
              >
                Add Item ({currencySymbol}{modalItemTotal})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
