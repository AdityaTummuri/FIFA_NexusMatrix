import React, { useState, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera';
import { WayfindingOverlay } from './WayfindingOverlay';

interface ARConciergeProps {
  activeVector: { angle_deg: number; distance_m: number } | null;
  onClearVector: () => void;
}

export const ARConcierge: React.FC<ARConciergeProps> = ({ activeVector, onClearVector }) => {
  const { videoRef, canvasRef, captureFrame, isReady, error } = useCamera();
  const [loading, setLoading] = useState(false);
  
  // local state for wayfinding overlay vector
  const [localVector, setLocalVector] = useState<{ angle_deg: number; distance_m: number } | null>(null);
  
  // UI Slide-Up Sheet state
  const [sheetContent, setSheetContent] = useState<{
    title: string;
    mode: 'menu' | 'route' | 'seat' | null;
    items?: Array<{ original: string; translated: string; price_usd: number }>;
    orderUrl?: string | null;
    wayfinding?: { angle_deg: number; distance_m: number } | null;
    fallbackUsed: boolean;
  } | null>(null);

  // Sync activeVector from parent (e.g., when clicking "Navigate Now" on SurgeModal)
  useEffect(() => {
    if (activeVector) {
      setLocalVector(activeVector);
      setSheetContent({
        title: 'NEXUS ROUTING SYSTEM',
        mode: 'route',
        wayfinding: activeVector,
        fallbackUsed: true,
      });
    }
  }, [activeVector]);

  const handleAction = async (mode: 'WAYFINDING' | 'MENU_TRANSLATION' | 'SEAT_DELIVERY') => {
    setLoading(true);
    
    // 1. Capture base64 matrix
    let base64Image = captureFrame();
    
    // If camera is not ready/desktop fallback, generate mock base64 data to allow processing
    if (!base64Image) {
      console.log('Camera frame not captured, feeding mock base64 payload.');
      base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // 1x1 pixel JPEG
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/vision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: `req-${Date.now()}`,
          mode,
          zone_id: 'C3', // Mock active zone
          image_b64: base64Image,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned code ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.result) {
        const res = data.result;
        
        if (mode === 'MENU_TRANSLATION') {
          setLocalVector(null); // Clear routing
          onClearVector();
          setSheetContent({
            title: 'TRANSLATED STALL MENU',
            mode: 'menu',
            items: res.translations,
            orderUrl: res.order_url,
            fallbackUsed: data.fallback_used,
          });
        } else if (mode === 'WAYFINDING') {
          const vec = res.wayfinding_vector;
          setLocalVector(vec);
          setSheetContent({
            title: 'WAYFINDING PATHWAY FOUND',
            mode: 'route',
            wayfinding: vec,
            fallbackUsed: data.fallback_used,
          });
        } else if (mode === 'SEAT_DELIVERY') {
          setLocalVector(null);
          onClearVector();
          setSheetContent({
            title: 'IN-SEAT DINING DELIVERY',
            mode: 'seat',
            orderUrl: res.order_url,
            fallbackUsed: data.fallback_used,
          });
        }
      }
    } catch (err: any) {
      console.error('Vision analysis request failed:', err);
      // Fallback UI alert
      setSheetContent({
        title: 'CONNECTION OFFLINE',
        mode: null,
        fallbackUsed: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const closeSheet = () => {
    setSheetContent(null);
    setLocalVector(null);
    onClearVector();
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. Camera Video Feed */}
      {isReady ? (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      ) : (
        // Camera Permission/Desktop Fallback Graphic
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px',
            textAlign: 'center',
            position: 'absolute',
            top: 0,
            left: 0,
            background: 'radial-gradient(circle, #10162A 0%, #05070D 100%)',
          }}
        >
          <span style={{ fontSize: '48px', marginBottom: '16px' }}>🎥</span>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: '#FFF' }}>
            CAMERA FEED SIMULATOR
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', maxWidth: '300px', marginTop: '8px' }}>
            {error ? `System log: ${error}` : 'Requesting media permissions for 3D wayfinding overlay...'}
          </p>
          <div
            style={{
              marginTop: '20px',
              padding: '8px 16px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              fontSize: '11px',
              color: 'var(--color-accent)',
            }}
          >
            ⚡ Running Mock Canvas Generator
          </div>
        </div>
      )}

      {/* Offscreen Canvas for Snapshot Grabs */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 2. Three.js Wayfinding WebGL Overlay */}
      <WayfindingOverlay vector={localVector} active={!!localVector} />

      {/* 3. Loading Spinner Overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(10, 14, 26, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255,255,255,0.1)',
              borderTop: '3px solid var(--color-accent)',
              borderRadius: '50%',
              animation: 'pulseBorder 1s linear infinite',
            }}
          />
          <span style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-accent)', fontWeight: 500, letterSpacing: '1px' }}>
            GEMINI VISION SCANNING...
          </span>
        </div>
      )}

      {/* 4. Frosted Glass Bottom HUD Panel */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '5%',
          right: '5%',
          padding: '16px',
          zIndex: 50,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          onClick={() => handleAction('MENU_TRANSLATION')}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.07)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            color: '#FFF',
            padding: '12px 6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)')}
        >
          <span>🔍</span>
          <span>Scan Menu</span>
        </button>

        <button
          onClick={() => handleAction('WAYFINDING')}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 165, 80, 0.2)',
            border: '1px solid var(--color-primary)',
            borderRadius: '10px',
            color: '#FFF',
            padding: '12px 6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 165, 80, 0.35)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 165, 80, 0.2)')}
        >
          <span>🗺</span>
          <span>Find Route</span>
        </button>

        <button
          onClick={() => handleAction('SEAT_DELIVERY')}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.07)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            color: '#FFF',
            padding: '12px 6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)')}
        >
          <span>🪑</span>
          <span>Order Seat</span>
        </button>
      </div>

      {/* 5. Slide-Up HUD Info Sheet */}
      {sheetContent && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            maxHeight: '70%',
            borderRadius: '24px 24px 0 0',
            padding: '24px',
            zIndex: 90,
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            overflowY: 'auto',
            borderBottom: 'none',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '12px',
            }}
          >
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.5px' }}>
                {sheetContent.title}
              </h3>
              {sheetContent.fallbackUsed && (
                <span
                  style={{
                    fontSize: '9px',
                    backgroundColor: 'rgba(245, 197, 24, 0.15)',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-accent)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    marginTop: '4px',
                    display: 'inline-block',
                  }}
                >
                  ⚡ Local Fallback
                </span>
              )}
            </div>
            <button
              onClick={closeSheet}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: '20px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          {/* Dynamic Content Body */}
          {sheetContent.mode === 'menu' && sheetContent.items && (
            <div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {sheetContent.items.map((item, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', display: 'block' }}>{item.translated}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{item.original}</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                      ${item.price_usd.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              
              {sheetContent.orderUrl && (
                <button
                  onClick={() => alert(`Redirecting to Seat Delivery: ${sheetContent.orderUrl}`)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--color-accent)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  One-Click Order to Seat
                </button>
              )}
            </div>
          )}

          {sheetContent.mode === 'route' && sheetContent.wayfinding && (
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
                Overlay Arrow is directing you to safe stadium conduits.
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>ANGLE</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {sheetContent.wayfinding.angle_deg}°
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>DISTANCE</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {sheetContent.wayfinding.distance_m}m
                  </span>
                </div>
              </div>
            </div>
          )}

          {sheetContent.mode === 'seat' && sheetContent.orderUrl && (
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <p style={{ fontSize: '14px', marginBottom: '20px' }}>
                Your Seat coordinates have been mapped successfully. Proceed to order checkout.
              </p>
              <button
                onClick={() => alert(`Redirecting to checkout: ${sheetContent.orderUrl}`)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Open Concession Order Checkout
              </button>
            </div>
          )}

          {!sheetContent.mode && (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-danger)' }}>
              ⚠️ The connection to the predictive core has timed out. The local AR Concierge is working offline.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
