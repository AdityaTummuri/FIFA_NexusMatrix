import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * CameraErrorBoundary Component.
 * A React class-based Error Boundary that wraps the WebRTC camera and WebGL
 * rendering sections. Catches render-time crashes from useCamera / Three.js
 * WebGL context failures and presents a graceful fallback UI instead of a
 * blank white screen.
 */
export class CameraErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      '[CameraErrorBoundary] WebRTC/WebGL render crash intercepted:',
      error,
      errorInfo.componentStack
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            width: '100%',
            height: '100%',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '32px',
            textAlign: 'center',
            background: 'radial-gradient(circle, #10162A 0%, #05070D 100%)',
          }}
        >
          <span role="img" aria-label="Warning icon" style={{ fontSize: '48px', marginBottom: '16px' }}>
            ⚠️
          </span>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              color: 'var(--color-danger)',
              marginBottom: '8px',
            }}
          >
            CAMERA MODULE OFFLINE
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', maxWidth: '340px', lineHeight: 1.5 }}>
            The WebRTC camera or WebGL renderer encountered an unrecoverable error.
            The Operator Dashboard remains fully operational.
          </p>
          {this.state.errorMessage && (
            <code
              style={{
                marginTop: '12px',
                padding: '8px 14px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                maxWidth: '360px',
                wordBreak: 'break-word',
              }}
            >
              {this.state.errorMessage}
            </code>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
