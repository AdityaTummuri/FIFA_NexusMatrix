import { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { ARConcierge } from './components/ARConcierge';
import { OperatorDashboard } from './components/OperatorDashboard';
import { SurgeModal } from './components/SurgeModal';

function App() {
  const {
    zoneData,
    surgeAlert,
    setSurgeAlert,
    clearSurgeAlert,
    connectionStatus,
  } = useWebSocket();

  // Selected navigation vector from surge alert vouchers
  const [activeVector, setActiveVector] = useState<{ angle_deg: number; distance_m: number } | null>(null);

  const handleNavigate = (destinationZone: string, voucherCode: string) => {
    console.log(`User starting navigation redirection route to ${destinationZone} using voucher ${voucherCode}`);
    
    // Simulate a target orientation pointing towards the alternative zone
    const targetAngle = destinationZone === 'A1' ? 45 : (destinationZone === 'B2' ? 135 : 225);
    setActiveVector({
      angle_deg: targetAngle,
      distance_m: 110,
    });
    
    // Close modal
    clearSurgeAlert();
  };

  const triggerDemoSurge = () => {
    console.log('Triggering mock evaluator surge alert manually.');
    setSurgeAlert({
      event: 'surge_alert',
      timestamp: new Date().toISOString(),
      zone_id: 'C3',
      severity: 'CRITICAL',
      predicted_density_15m: 2.84,
      triggers: {
        hvac: {
          action: 'LOWER_THRESHOLD',
          zone: 'C3',
          target_temp_c: 19.5,
        },
        restock: {
          action: 'DISPATCH_ALERT',
          concession_point: 'Stand-C3',
          items: ['water', 'isotonic_drinks', 'ice'],
        },
        fan_incentive: {
          type: 'WebAR_VOUCHER',
          voucher_code: 'NEXUS-DEMO-20OFF',
          discount_pct: 20,
          destination_zone: 'A2',
          message: 'Crowd surge detected in C3! Stay 15 mins longer to get 20% off at Store 2A.',
          expires_in_seconds: 300,
        },
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
      {/* 1. Header Bar */}
      <header className="header-bar">
        <div>
          <h1 className="header-title">
            THE FIFA <span style={{ color: 'var(--color-accent)' }}>NEXUS MATRIX</span>
          </h1>
          <span className="header-subtitle">Closed-Loop Crowd Dynamics & WebAR HUD</span>
        </div>

        {/* Demo Button */}
        <button
          onClick={triggerDemoSurge}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--color-accent)',
            border: '1px dashed var(--color-accent)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(245, 197, 24, 0.15)';
            e.currentTarget.style.borderStyle = 'solid';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderStyle = 'dashed';
          }}
        >
          ⚡ Trigger Demo Surge
        </button>
      </header>

      {/* 2. Main Split View Layout */}
      <main className="app-container" style={{ flex: 1 }}>
        {/* Left: AR Camera HUD Overlay */}
        <section style={{ position: 'relative', minHeight: '450px', height: '100%' }}>
          <ARConcierge
            activeVector={activeVector}
            onClearVector={() => setActiveVector(null)}
          />
        </section>

        {/* Right: Operational Status Grid */}
        <section style={{ height: '100%' }}>
          <OperatorDashboard
            zoneData={zoneData}
            connectionStatus={connectionStatus}
          />
        </section>
      </main>

      {/* 3. Safety Voucher Alert Pop-up */}
      {surgeAlert && (
        <SurgeModal
          alert={surgeAlert}
          onClose={clearSurgeAlert}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}

export default App;
