import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import App from '../App';

// Mock the useWebSocket hook
vi.mock('../hooks/useWebSocket', () => {
  return {
    useWebSocket: () => ({
      zoneData: [],
      surgeAlert: null,
      setSurgeAlert: vi.fn(),
      clearSurgeAlert: vi.fn(),
      connectionStatus: 'connected',
    }),
  };
});

// Mock WayfindingOverlay WebGL drawing
vi.mock('../components/WayfindingOverlay', () => {
  return {
    WayfindingOverlay: () => <div data-testid="mock-wayfinding" />,
  };
});

describe('App Root Component', () => {
  test('renders header title and layout panels', () => {
    render(<App />);
    
    // Verify main headings are present
    expect(screen.getByRole('heading', { name: /THE FIFA/i })).toBeInTheDocument();
    
    // Verify operational panels exist
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
