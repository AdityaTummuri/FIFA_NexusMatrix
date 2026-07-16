/**
 * Centralized Configuration for FIFA Nexus Matrix Frontend.
 * Loads environment variables with safe development defaults.
 */

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/ops';

// Reconnection settings for WebSockets
export const INITIAL_RECONNECT_DELAY = 1000; // ms
export const MAX_RECONNECT_DELAY = 16000;    // ms

// Operational thresholds
export const WARNING_DENSITY_THRESHOLD = 1.5; // pax/m^2
export const CRITICAL_DENSITY_THRESHOLD = 2.2; // pax/m^2
