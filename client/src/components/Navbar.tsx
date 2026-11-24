import React from 'react';
import { ShoppingBag, Coffee, QrCode, Monitor, ShieldCheck, ChevronRight } from 'lucide-react';
import { TableInfo } from '../types';

interface NavbarProps {
  table: TableInfo | null;
  cartCount: number;
  onOpenCart: () => void;
  onSelectTableDemo?: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  table,
  cartCount,
  onOpenCart,
  onSelectTableDemo,
  currentPage,
  onNavigate
}) => {
  return (
    <header className="sticky top-0 z-30 bg-cafe-50/95 backdrop-blur-md border-b border-cafe-200 shadow-sm transition-all">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* Brand */}
        <div
          onClick={() => onNavigate('menu')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-cafe-950 flex items-center justify-center text-cafe-300 shadow-sm group-hover:bg-cafe-900 transition-colors">
            <Coffee className="w-5 h-5 text-cafe-300" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg sm:text-xl text-cafe-950 tracking-tight leading-tight">
              Chapter One
            </h1>
            <p className="text-[10px] uppercase font-semibold text-cafe-600 tracking-wider">
              Cafe & Roastery
            </p>
          </div>
        </div>

        {/* Middle: Active Table Badge */}
        {table ? (
          <div
            onClick={onSelectTableDemo}
            title="Click to switch or preview another table QR"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cafe-100 hover:bg-cafe-200 border border-cafe-300 rounded-full text-xs font-semibold text-cafe-950 cursor-pointer transition-colors shadow-inner"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{table.tableNumber}</span>
            <ChevronRight className="w-3 h-3 text-cafe-500" />
          </div>
        ) : (
          <button
            onClick={onSelectTableDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Select Table</span>
          </button>
        )}

        {/* Actions: Navigation & Cart */}
        <div className="flex items-center gap-2">
          {/* Quick links to PC Kitchen and Admin */}
          <div className="hidden md:flex items-center gap-1 mr-2 text-xs font-medium">
            <button
              onClick={() => onNavigate('kitchen')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                currentPage === 'kitchen' ? 'bg-cafe-950 text-white' : 'text-cafe-700 hover:bg-cafe-100'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>PC Kitchen</span>
            </button>
            <button
              onClick={() => onNavigate('admin')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                currentPage === 'admin' ? 'bg-cafe-950 text-white' : 'text-cafe-700 hover:bg-cafe-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>

          {/* Cart Trigger */}
          <button
            onClick={onOpenCart}
            aria-label="View Cart"
            className="relative flex items-center justify-center w-11 h-11 rounded-full bg-cafe-950 text-white hover:bg-cafe-900 active:scale-95 transition-all shadow-md"
          >
            <ShoppingBag className="w-5 h-5 text-cafe-100" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-amber-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-cafe-50 animate-bounce">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
