import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { OperatorDashboard } from '../components/OperatorDashboard';
import { ZoneTelemetry } from '../hooks/useWebSocket';

const mockZoneData: ZoneTelemetry[] = [
  {
    zone_id: 'A1',
    density_pax_m2: 0.85,
    predicted_density_15m: 0.95,
    coordinates: { lat: 40.8130, lon: -74.0750 },
    velocity_vector: { vx: 0.2, vy: 0.1 },
    status: 'SAFE'
  },
  {
    zone_id: 'C3',
    density_pax_m2: 2.35,
    predicted_density_15m: 2.65,
    coordinates: { lat: 40.8160, lon: -74.0730 },
    velocity_vector: { vx: 0.1, vy: -0.1 },
    status: 'CRITICAL'
  },
];

describe('OperatorDashboard Component', () => {
  test('renders dashboard titles and connection state', () => {
    render(<OperatorDashboard zoneData={mockZoneData} connectionStatus="connected" />);
    
    expect(screen.getByText(/OPERATOR CORE MATRIX/i)).toBeInTheDocument();
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  test('renders list card data correctly for current and predicted densities', () => {
    render(<OperatorDashboard zoneData={mockZoneData} connectionStatus="connected" />);
    
    // Check A1 (Safe density < 1.5)
    expect(screen.getByText(/Zone A1/i)).toBeInTheDocument();
    expect(screen.getByText(/0.85/i)).toBeInTheDocument();
    
    // Check C3 (Critical density > 2.2)
    expect(screen.getByText(/Zone C3/i)).toBeInTheDocument();
    expect(screen.getByText(/2.35/i)).toBeInTheDocument();
  });
});
