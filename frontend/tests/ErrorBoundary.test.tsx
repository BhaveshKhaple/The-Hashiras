/**
 * The Hashiras — Frontend Error Boundary Tests
 * Tests DashboardErrorBoundary isolation & recovery UX.
 *
 * Run: npm test  (from frontend/)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { Component, type ReactNode } from 'react';
import '@testing-library/jest-dom';

// ─── Inline ErrorBoundary class (mirrors DispatcherDashboard implementation) ─
// We test the boundary logic directly here, without importing the full dashboard
// which depends on next/dynamic, leaflet, socket.io etc.
class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // In tests we spy on this; in prod it logs to console.error
    console.error('[DashboardErrorBoundary] Caught error:', error.message);
    console.error('[DashboardErrorBoundary] Component stack:', info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div data-testid="error-ui">
          <h2>Dashboard Error</h2>
          <p data-testid="error-message">{(this.state.error as Error).message}</p>
          <button
            data-testid="retry-btn"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// A component that always throws (return type `never` satisfies JSX component constraint)
function BoomComponent({ message }: { message?: string }): never {
  throw new Error(message || 'Simulated component crash');
}

// Silence console.error noise for tests that intentionally throw
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DashboardErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <DashboardErrorBoundary>
        <div data-testid="child">OK</div>
      </DashboardErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('error-ui')).not.toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <DashboardErrorBoundary>
        <BoomComponent />
      </DashboardErrorBoundary>
    );
    expect(screen.getByTestId('error-ui')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
  });

  it('displays the thrown error message', () => {
    render(
      <DashboardErrorBoundary>
        <BoomComponent message="Leaflet map exploded" />
      </DashboardErrorBoundary>
    );
    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Leaflet map exploded'
    );
  });

  it('Retry button resets error state and re-renders children', () => {
    // First render: throws → shows error UI
    let shouldThrow = true;
    function ConditionalBoom() {
      if (shouldThrow) throw new Error('boom');
      return <div data-testid="recovered">Recovered</div>;
    }

    const { rerender } = render(
      <DashboardErrorBoundary>
        <ConditionalBoom />
      </DashboardErrorBoundary>
    );

    expect(screen.getByTestId('error-ui')).toBeInTheDocument();

    // Stop throwing, then press Retry
    shouldThrow = false;
    fireEvent.click(screen.getByTestId('retry-btn'));

    // After reset, children should re-render without error
    rerender(
      <DashboardErrorBoundary>
        <ConditionalBoom />
      </DashboardErrorBoundary>
    );

    expect(screen.queryByTestId('error-ui')).not.toBeInTheDocument();
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
  });

  it('calls componentDidCatch and logs the error', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    render(
      <DashboardErrorBoundary>
        <BoomComponent message="socket crash" />
      </DashboardErrorBoundary>
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[DashboardErrorBoundary] Caught error:',
      'socket crash'
    );
  });

  it('handles multiple sequential errors gracefully', () => {
    // First error — fresh render
    const { unmount: unmount1 } = render(
      <DashboardErrorBoundary>
        <BoomComponent message="first crash" />
      </DashboardErrorBoundary>
    );
    expect(screen.getByTestId('error-message')).toHaveTextContent('first crash');
    unmount1();

    // Second error — fresh render (new boundary instance)
    render(
      <DashboardErrorBoundary>
        <BoomComponent message="second crash" />
      </DashboardErrorBoundary>
    );
    expect(screen.getByTestId('error-message')).toHaveTextContent('second crash');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Socket data resilience — pure logic tests (no DOM needed)
// ─────────────────────────────────────────────────────────────────────────────
describe('Socket event data guard logic', () => {
  function simulateAmbulanceLocation(
    data: any,
    setAmbulances: (fn: (prev: any[]) => any[]) => void
  ) {
    // Mirrors the DispatcherDashboard socket.on('ambulance:location') handler
    if (!data || typeof data.ambulance_id === 'undefined') return;
    setAmbulances((prev) =>
      prev.map((amb) =>
        amb.id === data.ambulance_id
          ? { ...amb, lat: data.lat, lng: data.lng, heading: data.heading }
          : amb
      )
    );
  }

  it('updates matching ambulance on valid payload', () => {
    const ambulances = [{ id: 'amb-1', lat: 0, lng: 0, heading: 0 }];
    let result = ambulances;
    simulateAmbulanceLocation(
      { ambulance_id: 'amb-1', lat: 19.07, lng: 72.87, heading: 90 },
      (fn) => { result = fn(ambulances); }
    );
    expect(result[0].lat).toBe(19.07);
    expect(result[0].lng).toBe(72.87);
  });

  it('skips update when ambulance_id is missing (BUG-T003)', () => {
    const ambulances = [{ id: 'amb-1', lat: 0, lng: 0 }];
    let updated = false;
    simulateAmbulanceLocation(
      { lat: 19.07, lng: 72.87 }, // missing ambulance_id
      () => { updated = true; }
    );
    expect(updated).toBe(false);
  });

  it('skips update for null data', () => {
    let updated = false;
    simulateAmbulanceLocation(null, () => { updated = true; });
    expect(updated).toBe(false);
  });

  function simulateDispatch(data: any, setAmbulances: (fn: any) => void) {
    // Mirrors the dispatch:ambulance handler
    if (data?.ambulance?.id) {
      setAmbulances((prev: any[]) =>
        prev.map((amb) =>
          amb.id === data.ambulance.id ? { ...amb, status: 'dispatched' } : amb
        )
      );
    }
  }

  it('updates ambulance status on dispatch:ambulance with valid payload', () => {
    const ambulances = [{ id: 'amb-1', status: 'available' }];
    let result = ambulances;
    simulateDispatch(
      { ambulance: { id: 'amb-1' } },
      (fn) => { result = fn(ambulances); }
    );
    expect(result[0].status).toBe('dispatched');
  });

  it('skips dispatch:ambulance update when ambulance.id is missing', () => {
    let updated = false;
    simulateDispatch({ ambulance: {} }, () => { updated = true; });
    expect(updated).toBe(false);
  });

  it('skips dispatch:ambulance update when data is null', () => {
    let updated = false;
    simulateDispatch(null, () => { updated = true; });
    expect(updated).toBe(false);
  });
});
