// Robust WebSocket service with auto-reconnect and subscriptions

type WSCallback = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<WSCallback>> = new Map();
  private statusListeners: Set<(status: 'connected' | 'reconnecting' | 'disconnected') => void> = new Set();
  private role: string = 'guest';
  private tableId: string | null = null;
  private orderNumber: number | null = null;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  public connectionStatus: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';

  public connect(role = 'guest', tableId: string | null = null, orderNumber: number | null = null) {
    this.role = role;
    this.tableId = tableId;
    this.orderNumber = orderNumber;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.registerRole();
      return;
    }

    this.setStatus('reconnecting');

    const customWs = (import.meta as any).env?.VITE_WS_URL;
    let wsUrl = '';
    if (customWs) {
      wsUrl = customWs;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.registerRole();
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type) {
            this.notifyListeners(data.type, data.payload || data);
          }
        } catch (e) {
          console.error('[WS] Parse message error:', e);
        }
      };

      this.ws.onclose = () => {
        this.cleanup();
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Socket error:', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  private registerRole() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'REGISTER_ROLE',
        role: this.role,
        tableId: this.tableId,
        orderNumber: this.orderNumber
      }));
    }
  }

  public subscribeOrder(orderNumber: number) {
    this.orderNumber = orderNumber;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'SUBSCRIBE_ORDER',
        orderNumber
      }));
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'PING' }));
      }
    }, 20000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[WS] Attempting reconnection...');
      this.connect(this.role, this.tableId, this.orderNumber);
    }, 3000);
  }

  private cleanup() {
    this.stopPing();
    this.ws = null;
  }

  private setStatus(status: 'connected' | 'reconnecting' | 'disconnected') {
    this.connectionStatus = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  public onStatusChange(callback: (status: 'connected' | 'reconnecting' | 'disconnected') => void) {
    this.statusListeners.add(callback);
    callback(this.connectionStatus);
    return () => this.statusListeners.delete(callback);
  }

  public on(event: string, callback: WSCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[WS] Error in listener for ${event}:`, e);
        }
      });
    }
  }

  public disconnect() {
    this.cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
    }
    this.setStatus('disconnected');
  }
}

export const wsClient = new WebSocketClient();
