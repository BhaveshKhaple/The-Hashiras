/**
 * Layout for all role-based dashboards: /dispatcher, /driver, /hospital, /traffic-police
 *
 * DISP-001 fix: provides an isolated full-screen container that correctly inherits
 * viewport height without being clipped by the root layout's `overflow-hidden body`.
 * This lets Leaflet maps and h-screen dashboard containers render at full height.
 */
export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}
      className="bg-black text-white"
    >
      {children}
    </div>
  );
}
