import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { SurgeModal } from '../components/SurgeModal';
import { SurgeAlert } from '../hooks/useWebSocket';

const mockAlert: SurgeAlert = {
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
      voucher_code: 'NEXUS-C3-20',
      discount_pct: 20,
      destination_zone: 'A2',
      message: 'Crowd surge detected in C3! Stay 15 mins longer to get 20% off at Store 2A.',
      expires_in_seconds: 300,
    },
  },
};

describe('SurgeModal Component', () => {
  test('renders modal warning details and code correctly', () => {
    const handleClose = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <SurgeModal
        alert={mockAlert}
        onClose={handleClose}
        onNavigate={handleNavigate}
      />
    );

    // Verify warnings and discount messages are rendered
    expect(screen.getByText(/NEXUS ALERT — Zone C3/i)).toBeInTheDocument();
    expect(screen.getByText(/NEXUS-C3-20/i)).toBeInTheDocument();
    expect(screen.getByText(/-20% OFF/i)).toBeInTheDocument();
  });

  test('calls onClose handler when Dismiss button is clicked', () => {
    const handleClose = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <SurgeModal
        alert={mockAlert}
        onClose={handleClose}
        onNavigate={handleNavigate}
      />
    );

    const dismissBtn = screen.getByRole('button', { name: /Dismiss crowd surge warning modal/i });
    fireEvent.click(dismissBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('calls onNavigate handler with parameters when Navigate button is clicked', () => {
    const handleClose = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <SurgeModal
        alert={mockAlert}
        onClose={handleClose}
        onNavigate={handleNavigate}
      />
    );

    const navigateBtn = screen.getByRole('button', { name: /Navigate now to Zone A2/i });
    fireEvent.click(navigateBtn);

    expect(handleNavigate).toHaveBeenCalledWith('A2', 'NEXUS-C3-20');
  });
});
