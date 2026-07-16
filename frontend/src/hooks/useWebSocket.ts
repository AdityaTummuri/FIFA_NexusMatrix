import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL, BACKEND_URL, INITIAL_RECONNECT_DELAY, MAX_RECONNECT_DELAY } from '../config';

/**
 * 2D Velocity components of crowd flow.
 */
export interface VelocityVector {
  vx: number;
  vy: number;
}

/**
 * Geographic GPS location of stadium zone.
 */
export interface ZoneCoordinates {
  lat: number;
  lon: number;
}

/**
 * Telemetry details for a stadium zone.
 */
export interface ZoneTelemetry {
  zone_id: string;
  coordinates: ZoneCoordinates;
  density_pax_m2: number;
  velocity_vector: VelocityVector;
  predicted_density_15m: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
  is_medical_override?: boolean;
}

/**
 * Operational surge warning alert event.
 */
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

/**
 * Return type interface for the useWebSocket hook.
 */
export interface UseWebSocketReturn {
  /** Live telemetry data for all stadium zones. */
  zoneData: ZoneTelemetry[];
  /** Active surge alert, or null if no alert is active. */
  surgeAlert: SurgeAlert | null;
  /** Setter to manually inject a surge alert (used for demo mode). */
  setSurgeAlert: React.Dispatch<React.SetStateAction<SurgeAlert | null>>;
  /** Clears the active surge alert. */
  clearSurgeAlert: () => void;
  /** Current WebSocket connection status. */
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

/**
 * Hook to manage real-time WebSocket connection to the predictive operator core.
 * Handles automatic reconnects using exponential backoff, parses state telemetry ticks,
 * and tracks crowd surge alerts.
 */
export const useWebSocket = (): UseWebSocketReturn => {
  const [zoneData, setZoneData] = useState<ZoneTelemetry[]>([]);
  const [surgeAlert, setSurgeAlert] = useState<SurgeAlert | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [medicalOverrides, setMedicalOverrides] = useState<string[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef<number>(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    console.log(`Connecting to WebSocket: ${WS_URL}`);
    setConnectionStatus('connecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established.');
      setConnectionStatus('connected');
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY; // Reset exponential backoff
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'telemetry_tick') {
          const zones = (data.zones || []).map((z: any) => ({
            ...z,
            is_medical_override: medicalOverrides.includes(z.zone_id)
          }));
          setZoneData(zones);
        } else if (data.event === 'surge_alert') {
          console.warn('SURGE ALERT RECEIVED:', data);
          setSurgeAlert(data);
        } else if (data.event === 'medical_override') {
          console.warn('MEDICAL OVERRIDE RECEIVED:', data);
          setMedicalOverrides((prev) => {
            const next = [...new Set([...prev, data.zone_id])];
            setZoneData((currentZones) =>
              currentZones.map((z) =>
                z.zone_id === data.zone_id ? { ...z, is_medical_override: true } : z
              )
            );
            return next;
          });
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
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);

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
        const response = await fetch(`${BACKEND_URL}/api/stadium-state`);
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

