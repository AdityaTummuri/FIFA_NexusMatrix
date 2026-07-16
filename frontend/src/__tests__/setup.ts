import '@testing-library/jest-dom';
import { beforeAll, vi } from 'vitest';

// Mock WebRTC and window media APIs that jsdom doesn't support natively
beforeAll(() => {
  // Mock HTMLMediaElement play
  window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
  
  // Mock mediaDevices getUserMedia
  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockImplementation(() => Promise.resolve({
          getTracks: () => [
            { stop: vi.fn() }
          ]
        })),
      },
    });
  }
});
