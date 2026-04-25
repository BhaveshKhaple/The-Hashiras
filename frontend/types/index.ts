// ── API Types ─────────────────────────────────────────────

export interface TriageResult {
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  ambulance_type: "ALS" | "BLS";
  suspected_conditions: string[];
  hospital_requirements: string[];
  patient_summary: string;
  triage_reasoning: string;
}

export interface AssignedAmbulance {
  id: string;
  name: string;
  type: string;
  status: string;
  driver_name: string;
  distance_meters: number;
  lng: number;
  lat: number;
}

export interface AssignedHospital {
  id: string;
  name: string;
  available_beds: number;
  capabilities: string[];
  distance_meters: number;
  lng: number;
  lat: number;
}

export interface Incident {
  id: string;
  created_at: string;
  emergency_text: string;
  severity: string;
  ambulance_type: string;
  patient_summary: string;
  triage_reasoning: string;
  suspected_conditions: string[];
  assigned_ambulance_id: string | null;
  assigned_hospital_id: string | null;
  status: string;
  route_geojson: unknown;
  eta_minutes: number;
}

export interface IntakeResponse {
  success: boolean;
  incident: Incident;
  triage: TriageResult;
  assigned_ambulance: AssignedAmbulance | null;
  assigned_hospital: AssignedHospital | null;
  route: OrsRouteResponse | null;
}

// ── OpenRouteService Types ───────────────────────────────

export interface OrsRouteResponse {
  type: string;
  features: OrsFeature[];
}

export interface OrsFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  properties: {
    summary: {
      distance: number;
      duration: number;
    };
    segments: unknown[];
  };
}

// ── Socket.IO Events ────────────────────────────────────

export interface DispatchEvent {
  incident_id: string;
  ambulance: AssignedAmbulance;
  route: OrsRouteResponse | null;
}

export interface AmbulanceLocationEvent {
  ambulance_id: string;
  incident_id: string;
  lng: number;
  lat: number;
  heading: number;
  speed_kmh: number;
  timestamp: string;
  progress: number; // 0-100
}

export interface RerouteEvent {
  incident_id: string;
  route: OrsRouteResponse;
}

// ── Map Types ───────────────────────────────────────────

export interface MapMarker {
  position: [number, number]; // [lat, lng]
  type: "patient" | "ambulance" | "hospital" | "waypoint" | "roadblock";
  label?: string;
}

