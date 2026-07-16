import { useEffect, useRef, useState } from 'react';

/**
 * Return type interface for the useCamera hook.
 */
export interface UseCameraReturn {
  /** Ref to the HTMLVideoElement displaying the camera stream. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Ref to an offscreen HTMLCanvasElement used for frame capture. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Captures the current video frame as a base64 JPEG string (without MIME prefix). */
  captureFrame: () => string | null;
  /** Whether the camera stream is active and ready. */
  isReady: boolean;
  /** Human-readable error message if camera initialization failed. */
  error: string | null;
}

/**
 * Hook to access and manage the user's camera feed via WebRTC.
 * Falls back to mock camera mode if system permissions are rejected or unavailable.
 * Provides a method to capture base64 snapshots of the current frame.
 */
export const useCamera = (): UseCameraReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;

    const startCamera = async (): Promise<void> => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera APIs are not supported on this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });

        if (active) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((playErr: unknown) => {
              const message = playErr instanceof Error ? playErr.message : 'Unknown playback error';
              console.error('Error playing video stream:', message);
            });
          }
          setIsReady(true);
          setError(null);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to access camera.';
        console.warn('Camera initiation failed, falling back to mock camera mode:', message);
        if (active) {
          setError(message);
          setIsReady(false);
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  /**
   * Captures the current frame from the running video element and returns
   * a base64 encoded JPEG string (excluding MIME prefix).
   */
  const captureFrame = (): string | null => {
    if (!videoRef.current) return null;

    const video = videoRef.current;
    
    // Create an offscreen canvas if the provided ref is not bound yet
    const canvas = canvasRef.current || document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, width, height);

    try {
      // Get base64 JPEG data
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      // Strip off the header "data:image/jpeg;base64," to match expected base64 content
      return dataUrl.split(',')[1] || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown canvas capture error';
      console.error('Failed to capture frame from video canvas:', message);
      return null;
    }
  };

  return {
    videoRef,
    canvasRef,
    captureFrame,
    isReady,
    error,
  };
};
