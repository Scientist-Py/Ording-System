import {
  MenuCategory,
  MenuItem,
  OrderRecord,
  CustomerRequest,
  CafeSettings
} from '../types';

const CUSTOM_API_URL = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE || '';
const API_BASE = CUSTOM_API_URL ? `${CUSTOM_API_URL.replace(/\/$/, '')}/api` : '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const api = {
  // Validate QR Token
  validateQr: async (token: string) => {
    const res = await fetch(`${API_BASE}/tables/validate-qr/${encodeURIComponent(token)}`);
    return handleResponse<{
      valid: boolean;
      table: { id: string; tableNumber: string; status: string; qrToken: string };
      session: { id: string; sessionCode: string; runningTotal: number; startedAt: string };
    }>(res);
  },

  // Get Menu
  getMenu: async () => {
    const res = await fetch(`${API_BASE}/menu`);
    return handleResponse<{
      categories: MenuCategory[];
      items: MenuItem[];
      menuByCategory: (MenuCategory & { items: MenuItem[] })[];
    }>(res);
  },

  // Customer Recognition
  identifyCustomer: async (payload: {
    deviceToken?: string | null;
    name?: string;
    phone?: string;
    consentSaved?: boolean;
  }) => {
    const res = await fetch(`${API_BASE}/customers/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<{
      recognized: boolean;
      deviceToken: string | null;
      customer: {
        id: string;
        name: string;
        phone: string;
        totalVisits: number;
        totalOrders: number;
        loyaltyPoints: number;
      } | null;
    }>(res);
  },

  // Forget Device
  forgetCustomer: async (deviceToken: string) => {
    const res = await fetch(`${API_BASE}/customers/forget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceToken })
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Place Order (Server authoritative price validation + Idempotent)
  placeOrder: async (payload: {
    qrToken: string;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      customizations: Array<{ groupName: string; optionName: string }>;
    }>;
    specialInstructions?: string;
    idempotencyKey: string;
  }) => {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<{
      success: boolean;
      isDuplicate?: boolean;
      order: OrderRecord;
      whatsappMessage: string;
      whatsappUrl: string;
    }>(res);
  },

  // Track Order
  trackOrder: async (orderNumber: number | string) => {
    const res = await fetch(`${API_BASE}/orders/track/${orderNumber}`);
    return handleResponse<{ order: OrderRecord }>(res);
  },

  // Record WhatsApp click
  recordWhatsAppOpened: async (orderId: string) => {
    try {
      await fetch(`${API_BASE}/orders/${orderId}/whatsapp-opened`, { method: 'POST' });
    } catch {}
  },

  // Customer Request Assistance (Waiter, Bill, Water)
  requestAssistance: async (qrToken: string, requestType: 'WAITER' | 'BILL' | 'WATER') => {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken, requestType })
    });
    return handleResponse<{ success: boolean; requestId: string; message: string }>(res);
  },

  // Kitchen/Admin: Get Active Orders
  getActiveOrders: async () => {
    const res = await fetch(`${API_BASE}/orders/active`);
    return handleResponse<OrderRecord[]>(res);
  },

  // Kitchen/Admin: Get Completed Orders
  getCompletedOrders: async () => {
    const res = await fetch(`${API_BASE}/orders/completed`);
    return handleResponse<OrderRecord[]>(res);
  },

  // Kitchen/Admin: Update Order Status
  updateOrderStatus: async (orderId: string, status: string, rejectionReason?: string) => {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectionReason })
    });
    return handleResponse<{ success: boolean; order: OrderRecord }>(res);
  },

  // Kitchen/Admin: Pending Requests
  getPendingRequests: async () => {
    const res = await fetch(`${API_BASE}/requests/pending`);
    return handleResponse<CustomerRequest[]>(res);
  },

  // Acknowledge Request
  acknowledgeRequest: async (requestId: string) => {
    const res = await fetch(`${API_BASE}/requests/${requestId}/acknowledge`, { method: 'PATCH' });
    return handleResponse<{ success: boolean }>(res);
  },

  // Settings
  getSettings: async (adminPin?: string) => {
    const headers: Record<string, string> = {};
    if (adminPin) headers['x-admin-pin'] = adminPin;
    const res = await fetch(`${API_BASE}/settings`, { headers });
    return handleResponse<CafeSettings>(res);
  },

  updateSettings: async (adminPin: string, updates: CafeSettings) => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPin
      },
      body: JSON.stringify(updates)
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Admin Tables Management
  getTables: async (adminPin: string) => {
    const res = await fetch(`${API_BASE}/tables`, {
      headers: { 'x-admin-pin': adminPin }
    });
    return handleResponse<any[]>(res);
  },

  createTable: async (adminPin: string, tableNumber: string) => {
    const res = await fetch(`${API_BASE}/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPin
      },
      body: JSON.stringify({ tableNumber })
    });
    return handleResponse<{ success: boolean; table: any }>(res);
  },

  regenerateQr: async (adminPin: string, tableId: string) => {
    const res = await fetch(`${API_BASE}/tables/${tableId}/regenerate-qr`, {
      method: 'POST',
      headers: { 'x-admin-pin': adminPin }
    });
    return handleResponse<{ success: boolean; newToken: string; message: string }>(res);
  },

  revokeQr: async (adminPin: string, tableId: string) => {
    const res = await fetch(`${API_BASE}/tables/${tableId}/revoke-qr`, {
      method: 'POST',
      headers: { 'x-admin-pin': adminPin }
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  closeSession: async (adminPin: string, tableId: string) => {
    const res = await fetch(`${API_BASE}/tables/${tableId}/close-session`, {
      method: 'POST',
      headers: { 'x-admin-pin': adminPin }
    });
    return handleResponse<{ success: boolean; message: string; newSessionCode: string }>(res);
  },

  // Admin Menu Management
  createMenuItem: async (adminPin: string, itemData: any) => {
    const res = await fetch(`${API_BASE}/menu/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPin
      },
      body: JSON.stringify(itemData)
    });
    return handleResponse<{ success: boolean; itemId: string }>(res);
  },

  updateMenuItem: async (adminPin: string, itemId: string, itemData: any) => {
    const res = await fetch(`${API_BASE}/menu/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPin
      },
      body: JSON.stringify(itemData)
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  toggleItemAvailability: async (adminPin: string, itemId: string, isAvailable: boolean) => {
    const res = await fetch(`${API_BASE}/menu/items/${itemId}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPin
      },
      body: JSON.stringify({ isAvailable })
    });
    return handleResponse<{ success: boolean; isAvailable: boolean; message: string }>(res);
  },

  deleteMenuItem: async (adminPin: string, itemId: string) => {
    const res = await fetch(`${API_BASE}/menu/items/${itemId}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': adminPin }
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  createCategory: async (adminPin: string, name: string) => {
    const res = await fetch(`${API_BASE}/menu/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPin
      },
      body: JSON.stringify({ name })
    });
    return handleResponse<{ success: boolean; category: any }>(res);
  },

  // Admin Customers
  getCustomers: async (adminPin: string) => {
    const res = await fetch(`${API_BASE}/customers`, {
      headers: { 'x-admin-pin': adminPin }
    });
    return handleResponse<any[]>(res);
  },

  deleteCustomer: async (adminPin: string, customerId: string) => {
    const res = await fetch(`${API_BASE}/customers/${customerId}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': adminPin }
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Admin Reports
  getReports: async (adminPin: string) => {
    const res = await fetch(`${API_BASE}/analytics/reports`, {
      headers: { 'x-admin-pin': adminPin }
    });
    return handleResponse<any>(res);
  }
};
