import { Ambulance, Construction } from "lucide-react";
import Link from "next/link";

export default function DriverPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--bg-primary)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <Ambulance className="w-8 h-8 text-white" />
      </div>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 8px" }}>Driver Dashboard</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", marginBottom: 24 }}>
        <Construction className="w-4 h-4" />
        <p style={{ fontSize: "0.9rem", margin: 0 }}>Under construction — Phase 4.2</p>
      </div>
      <Link
        href="/"
        style={{
          color: "var(--accent-primary)",
          fontSize: "0.85rem",
          textDecoration: "none",
          borderBottom: "1px solid transparent",
        }}
      >
        ← Back to LifeLink
      </Link>
    </div>
  );
}
