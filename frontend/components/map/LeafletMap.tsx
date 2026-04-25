"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { MapMarker, OrsRouteResponse } from "@/types";

/* ── Marker icons ─────────────────────────────────────────── */

function createIcon(emoji: string, size: number = 32): L.DivIcon {
  return L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${emoji}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createPulsingDot(color: string = "#22c55e"): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="position:relative;width:20px;height:20px;">
        <div style="
          position:absolute;inset:0;
          border-radius:50%;
          background:${color};
          opacity:0.3;
          animation: ambulance-pulse 1.5s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:4px;left:4px;width:12px;height:12px;
          border-radius:50%;
          background:${color};
          border:2px solid white;
          box-shadow:0 0 8px ${color};
        "></div>
      </div>
      <style>
        @keyframes ambulance-pulse {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      </style>
    `,
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const ICONS: Record<string, L.DivIcon> = {
  patient: createIcon("📍", 30),
  ambulance: createIcon("🚑", 34),
  hospital: createIcon("🏥", 30),
  waypoint: createIcon("📌", 26),
  roadblock: createIcon("🚧", 34),
};

/* ── Component props ──────────────────────────────────────── */

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routeGeoJSON?: OrsRouteResponse | null;
  routeColor?: string;
  ambulancePosition?: [number, number] | null; // live GPS [lat, lng]
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  followAmbulance?: boolean;
}

/* ── LeafletMap (vanilla Leaflet, no SSR issues) ──────────── */

export default function LeafletMap({
  center = [18.52, 73.855],
  zoom = 13,
  markers = [],
  routeGeoJSON = null,
  routeColor = "#ef4444",
  ambulancePosition = null,
  onMapClick,
  className = "",
  followAmbulance = false,
}: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.GeoJSON | null>(null);
  const ambulanceMarkerRef = useRef<L.Marker | null>(null);

  /* ── Initialize map ────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Attribution in bottom-right
    L.control
      .attribution({ position: "bottomright" })
      .addAttribution('&copy; <a href="https://carto.com/">CARTO</a>')
      .addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Force a resize after mount (fixes grey tiles)
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Map click handler ─────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;

    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };

    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onMapClick]);

  /* ── Sync markers ──────────────────────────────────────── */
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    markers.forEach((m) => {
      const icon = ICONS[m.type] || ICONS.waypoint;
      const marker = L.marker(m.position, { icon });
      if (m.label) {
        marker.bindTooltip(m.label, {
          permanent: false,
          className:
            "!bg-[#111827] !text-[#f0f4f8] !border-[rgba(148,163,184,0.2)] !rounded-lg !px-3 !py-1.5 !text-xs !font-medium !shadow-lg",
        });
      }
      marker.addTo(layer);
    });
  }, [markers]);

  /* ── Sync route GeoJSON ────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old route
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (!routeGeoJSON?.features?.length) return;

    const routeLayer = L.geoJSON(routeGeoJSON as unknown as GeoJSON.GeoJsonObject, {
      style: {
        color: routeColor,
        weight: 4,
        opacity: 0.85,
        dashArray: undefined,
        lineCap: "round",
        lineJoin: "round",
      },
    }).addTo(map);

    routeLayerRef.current = routeLayer;

    // Fit map to route bounds
    const bounds = routeLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeGeoJSON, routeColor]);

  /* ── Sync ambulance live position (pulsing dot) ────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!ambulancePosition) {
      // Remove marker if position cleared
      if (ambulanceMarkerRef.current) {
        map.removeLayer(ambulanceMarkerRef.current);
        ambulanceMarkerRef.current = null;
      }
      return;
    }

    if (ambulanceMarkerRef.current) {
      // Smoothly update position
      ambulanceMarkerRef.current.setLatLng(ambulancePosition);
    } else {
      // Create new pulsing dot marker
      ambulanceMarkerRef.current = L.marker(ambulancePosition, {
        icon: createPulsingDot("#22c55e"),
        zIndexOffset: 1000,
      }).addTo(map);
    }

    // Follow ambulance if enabled
    if (followAmbulance) {
      map.panTo(ambulancePosition, { animate: true, duration: 1 });
    }
  }, [ambulancePosition, followAmbulance]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-2xl ${className}`}
      style={{ minHeight: "400px" }}
    />
  );
}
