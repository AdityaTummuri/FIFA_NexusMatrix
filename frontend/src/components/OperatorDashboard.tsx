import React from 'react';
import { ZoneTelemetry } from '../hooks/useWebSocket';

interface OperatorDashboardProps {
  zoneData: ZoneTelemetry[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({ zoneData, connectionStatus }) => {
  // Hardcoded fallback list of zones to show grid skeleton if no WS tick is active
  const defaultZonesList = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4'];

  const getStatusColor = (density: number) => {
    if (density < 1.5) return 'var(--color-primary)';
    if (density < 2.2) return 'var(--color-accent)';
    return 'var(--color-danger)';
  };

  const getStatusLabel = (density: number) => {
    if (density < 1.5) return 'SAFE';
    if (density < 2.2) return 'WARNING';
    return 'CRITICAL';
  };

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: 'rgba(16, 22, 42, 0.45)',
        borderLeft: '1px solid var(--color-border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Top Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '1px' }}>
            OPERATOR CORE MATRIX
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}>
            15-MIN FLUID DYNAMICS FORECASTS
          </span>
        </div>

        {/* Connection Dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor:
                connectionStatus === 'connected'
                  ? 'var(--color-primary)'
                  : connectionStatus === 'connecting'
                  ? 'var(--color-accent)'
                  : 'var(--color-danger)',
              boxShadow:
                connectionStatus === 'connected'
                  ? '0 0 8px var(--color-primary)'
                  : 'none',
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            {connectionStatus}
          </span>
        </div>
      </div>

      {/* Grid of Stadium Zones */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '16px',
          flex: 1,
        }}
      >
        {defaultZonesList.map((zoneId) => {
          // Find matching data from state
          const telemetry = zoneData.find((z) => z.zone_id === zoneId);
          const density = telemetry ? telemetry.density_pax_m2 : 0.0;
          const predicted = telemetry ? telemetry.predicted_density_15m : 0.0;
          const statusColor = getStatusColor(density);
          const statusLabel = getStatusLabel(density);
          
          // Determine trend (Compare predicted vs current)
          const isUpTrend = predicted > density;
          const isStable = Math.abs(predicted - density) < 0.1;

          return (
            <div
              key={zoneId}
              className="glass-panel"
              style={{
                padding: '16px',
                border: telemetry ? `1px solid ${statusColor}` : '1px solid var(--color-border)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: telemetry
                  ? `linear-gradient(135deg, rgba(16, 22, 42, 0.75) 0%, ${statusColor}15 100%)`
                  : 'rgba(16, 22, 42, 0.45)',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '0.5px' }}>
                  Zone {zoneId}
                </span>
                {telemetry && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 'bold',
                      color: statusColor,
                      border: `1px solid ${statusColor}`,
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {statusLabel}
                  </span>
                )}
              </div>

              {/* Occupancy Data */}
              <div style={{ margin: '12px 0' }}>
                <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>
                  Current Density
                </span>
                <span style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {telemetry ? density.toFixed(2) : '--'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}> pax/m²</span>
              </div>

              {/* 15-Minute Forecast */}
              <div
                style={{
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '8px', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    15m Predict
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {telemetry ? predicted.toFixed(2) : '--'}
                  </span>
                </div>

                {/* Trend Chevron */}
                {telemetry && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>
                      {isStable ? '➔' : isUpTrend ? '🔺' : '🔻'}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 'bold',
                        color: isStable ? 'var(--color-text-muted)' : isUpTrend ? 'var(--color-danger)' : 'var(--color-primary)',
                      }}
                    >
                      {isStable ? 'STABLE' : isUpTrend ? 'RISK' : 'FLOW'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
