import DispatcherDashboard from '@/components/DispatcherDashboard';

// DISP-003 fix: no <main> wrapper — DispatcherDashboard owns its full h-screen container.
// The (roles)/layout.tsx provides the correct viewport frame.
export default function DispatcherPage() {
  return <DispatcherDashboard />;
}

