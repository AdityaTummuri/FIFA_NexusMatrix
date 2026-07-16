import { useEffect, useRef, useState, useCallback } from 'react';

export interface VelocityVector {
  vx: number;
  vy: number;
}

export interface ZoneCoordinates {
  lat: number;
  lon: number;
}

export interface ZoneTelemetry {
  zone_id: string;
  coordinates: ZoneCoordinates;
  density_pax_m2: number;
  velocity_vector: VelocityVector;
  predicted_density_15m: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
}

export interface SurgeAlert {
  event: 'surge_alert';
  timestamp: string;
  zone_id: string;
  severity: 'WARNING' | 'HIGH' | 'CRITICAL';
  predicted_density_15m: number;
  triggers: {
    hvac: {
      action: string;
      zone: string;
      target_temp_c: number;
    };
    restock: {
      action: string;
      concession_point: string;
      items: string[];
    };
    fan_incentive: {
      type: 'WebAR_VOUCHER';
      voucher_code: string;
      discount_pct: number;
      destination_zone: string;
      message: string;
      expires_in_seconds: number;
    };
  };
}

export const useWebSocket = () => {
  const [zoneData, setZoneData] = useState<ZoneTelemetry[]>([]);
  const [surgeAlert, setSurgeAlert] = useState<SurgeAlert | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef<number>(1000);
  const reconnectTimerRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/ops';
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    setConnectionStatus('connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established.');
      setConnectionStatus('connected');
      reconnectDelayRef.current = 1000; // Reset exponential backoff
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'telemetry_tick') {
          setZoneData(data.zones || []);
        } else if (data.event === 'surge_alert') {
          console.warn('SURGE ALERT RECEIVED:', data);
          setSurgeAlert(data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket JSON message:', err);
      }
    };

    ws.onclose = (e) => {
      console.warn(`WebSocket closed: ${e.reason} (code: ${e.code}). Reconnecting...`);
      setConnectionStatus('disconnected');
      
      // Exponential backoff reconnect
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 16000); // Max 16 seconds

      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/api/stadium-state`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.zones) {
            setZoneData(data.zones);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch initial stadium state:', err);
      }
    };

    fetchInitialState();
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on unmount
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  const clearSurgeAlert = useCallback(() => {
    setSurgeAlert(null);
  }, []);

  return {
    zoneData,
    surgeAlert,
    setSurgeAlert, // Expose setter so we can manually trigger surges for Demo Mode
    clearSurgeAlert,
    connectionStatus,
  };
};
