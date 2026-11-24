export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  offer_price: number | null;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  is_popular: boolean;
  customizations: CustomizationGroup[];
  sort_order: number;
}

export interface CustomizationOption {
  name: string;
  price: number;
}

export interface CustomizationGroup {
  name: string;
  options: CustomizationOption[];
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  items?: MenuItem[];
}

export interface SelectedCustomization {
  groupName: string;
  optionName: string;
  extraPrice: number;
}

export interface CartItem {
  cartItemId: string; // unique key combining item id and selected customizations
  item: MenuItem;
  quantity: number;
  selectedCustomizations: SelectedCustomization[];
  unitPrice: number;
  itemSubtotal: number;
}

export interface TableInfo {
  id: string;
  tableNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  qrToken: string;
}

export interface TableSessionInfo {
  id: string;
  sessionCode: string;
  runningTotal: number;
  startedAt: string;
}

export interface CustomerProfile {
  id?: string;
  name: string;
  phone: string;
  totalVisits?: number;
  totalOrders?: number;
  loyaltyPoints?: number;
}

export interface OrderItemRecord {
  id?: string;
  menuItemId?: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  customizationsSelected?: SelectedCustomization[];
}

export interface OrderRecord {
  id: string;
  order_number: number;
  table_id: string;
  table_number: string;
  table_session_id?: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  total: number;
  status: 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'REJECTED';
  rejection_reason?: string;
  special_instructions?: string;
  created_at: string;
  updated_at?: string;
  items: OrderItemRecord[];
}

export interface CustomerRequest {
  id: string;
  table_id: string;
  table_number: string;
  request_type: 'WAITER' | 'BILL' | 'WATER';
  status: 'PENDING' | 'ACKNOWLEDGED';
  created_at: string;
}

export interface CafeSettings {
  cafe_name?: string;
  cafe_tagline?: string;
  whatsapp_number?: string;
  currency_symbol?: string;
  admin_pin?: string;
  notification_sound?: string;
  sound_volume?: string;
}
