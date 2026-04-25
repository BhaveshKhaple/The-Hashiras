"use client";

import { Siren, ArrowRight, Ambulance, Building2, ShieldCheck, Radio } from "lucide-react";
import Link from "next/link";

const ROLES = [
  {
    title: "Dispatcher",
    description: "Emergency intake, AI triage, ambulance dispatch & route management",
    href: "/dispatcher",
    icon: Radio,
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    ready: true,
  },
  {
    title: "Driver",
    description: "Real-time navigation, status updates & patient delivery",
    href: "/driver/demo",
    icon: Ambulance,
    color: "#22c55e",
    gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    ready: false,
  },
  {
    title: "Hospital",
    description: "Pre-alerts, bed management & incoming patient tracking",
    href: "/hospital/demo",
    icon: Building2,
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    ready: false,
  },
  {
    title: "Traffic Police",
    description: "Green corridor control & roadblock management",
    href: "/traffic-police",
    icon: ShieldCheck,
    color: "#eab308",
    gradient: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
    ready: false,
  },
];

export default function HomePage() {
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
      }}
    >
      {/* Logo + Title */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 0 30px rgba(239,68,68,0.3)",
          }}
        >
          <Siren className="w-8 h-8 text-white" />
        </div>
        <h1
          style={{
            fontSize: "2.2rem",
            fontWeight: 800,
            margin: "0 0 8px",
            letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #f0f4f8 0%, #94a3b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          LifeLink
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: 0, maxWidth: 420, lineHeight: 1.6 }}>
          AI-Enabled Smart Emergency Response &amp; Ambulance Coordination System
        </p>
      </div>

      {/* Role cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          maxWidth: 1100,
          width: "100%",
        }}
      >
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <Link
              key={role.title}
              href={role.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                opacity: role.ready ? 1 : 0.5,
                pointerEvents: role.ready ? "auto" : "none",
              }}
            >
              <div
                className="glass-panel"
                style={{
                  padding: "28px 24px",
                  cursor: role.ready ? "pointer" : "default",
                  transition: "all 0.3s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  if (role.ready) {
                    e.currentTarget.style.borderColor = role.color;
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = `0 8px 32px ${role.color}22`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.transform = "";
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: role.gradient,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  {role.ready ? (
                    <ArrowRight className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                      Coming Soon
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px" }}>{role.title}</h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  {role.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
