import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeLink — AI Emergency Response",
  description:
    "AI-Enabled Smart Emergency Response & Ambulance Coordination System. Real-time triage, dispatch, and routing powered by Gemini AI.",
  keywords: [
    "emergency response",
    "ambulance dispatch",
    "AI triage",
    "real-time tracking",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
