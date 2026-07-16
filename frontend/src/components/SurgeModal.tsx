import React, { useEffect, useState } from 'react';
import { SurgeAlert } from '../hooks/useWebSocket';

interface SurgeModalProps {
  alert: SurgeAlert;
  onClose: () => void;
  onNavigate: (destinationZone: string, voucherCode: string) => void;
}

export const SurgeModal: React.FC<SurgeModalProps> = ({ alert, onClose, onNavigate }) => {
  const [timeLeft, setTimeLeft] = useState(alert.triggers.fan_incentive.expires_in_seconds);

  useEffect(() => {
    setTimeLeft(alert.triggers.fan_incentive.expires_in_seconds);
  }, [alert]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleNavigateClick = () => {
    onNavigate(
      alert.triggers.fan_incentive.destination_zone,
      alert.triggers.fan_incentive.voucher_code
    );
  };

  const modalRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the modal container on mount for screen readers and keyboard accessibility
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="surge-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(10, 14, 26, 0.93)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '24px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '32px',
          border: '2px solid var(--color-danger)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(232, 50, 10, 0.2)',
          position: 'relative',
          outline: 'none', // Remove default focus outline since we handle container focus
        }}
      >
        {/* Pulsing Alert Indicator */}
        <div
          role="presentation"
          style={{
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--color-danger)',
            borderRadius: '50%',
            margin: '0 auto 16px auto',
            animation: 'pulseBorder 1.5s infinite',
          }}
        />

        <h2
          id="surge-modal-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '36px',
            color: 'var(--color-danger)',
            letterSpacing: '1px',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}
        >
          ⚡ NEXUS ALERT — Zone {alert.zone_id}
        </h2>
        
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '14px',
            marginBottom: '24px',
            lineHeight: 1.6,
          }}
        >
          Crowd density is forecasted to peak shortly. Let's redirect our routing parameters to maintain safe stadium flow rates.
        </p>

        {/* Voucher Card Container */}
        <div
          role="region"
          aria-label="Voucher Details"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 165, 80, 0.15) 0%, rgba(245, 197, 24, 0.15) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '28px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-accent)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
              FIFA WEBAR VOUCHER
            </span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFF' }}>
              -{alert.triggers.fan_incentive.discount_pct}% OFF
            </span>
          </div>

          <h3
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: '#FFF',
              marginBottom: '16px',
              lineHeight: 1.4,
            }}
          >
            {alert.triggers.fan_incentive.message}
          </h3>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
              padding: '10px 14px',
              borderRadius: '8px',
            }}
          >
            <div>
              <span style={{ display: 'block', fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Voucher Code
              </span>
              <code style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--color-accent)', fontWeight: 'bold' }}>
                {alert.triggers.fan_incentive.voucher_code}
              </code>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Redeem Within
              </span>
              <span 
                role="timer"
                aria-live="assertive"
                aria-label={`Time remaining: ${timeLeft > 0 ? formatTime(timeLeft) : 'expired'}`}
                style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-danger)', fontFamily: 'monospace' }}
              >
                {timeLeft > 0 ? formatTime(timeLeft) : 'EXPIRED'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            id="btn-modal-navigate"
            onClick={handleNavigateClick}
            disabled={timeLeft <= 0}
            aria-label={`Navigate now to Zone ${alert.triggers.fan_incentive.destination_zone} to redeem voucher`}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              opacity: timeLeft <= 0 ? 0.5 : 1,
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#008a43')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
          >
            🗺 Navigate Now
          </button>
          
          <button
            id="btn-modal-dismiss"
            onClick={onClose}
            aria-label="Dismiss crowd surge warning modal"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Dismiss Alert
          </button>
        </div>
      </div>
    </div>

  );
};
