-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ambulances table
CREATE TABLE ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,                          -- e.g., "AMB-001"
  type TEXT CHECK (type IN ('ALS', 'BLS')),
  status TEXT DEFAULT 'available',    -- available | dispatched | returning
  driver_name TEXT,
  location GEOGRAPHY(POINT, 4326),    -- PostGIS geo column
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Hospitals table
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  location GEOGRAPHY(POINT, 4326),
  total_beds INT,
  available_beds INT,
  capabilities TEXT[],                -- e.g., ['trauma_center', 'ICU', 'cardiac', 'burn_unit']
  contact_number TEXT
);

-- Incidents table
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  emergency_text TEXT,
  severity TEXT,
  ambulance_type TEXT,
  patient_summary TEXT,
  triage_reasoning TEXT,
  suspected_conditions TEXT[],
  assigned_ambulance_id UUID REFERENCES ambulances(id),
  assigned_hospital_id UUID REFERENCES hospitals(id),
  status TEXT DEFAULT 'active',       -- active | resolved
  patient_location GEOGRAPHY(POINT, 4326),
  route_geojson JSONB,                -- stored OpenRouteService route
  eta_minutes INT
);

-- Geo indexes for fast nearest-neighbor queries
CREATE INDEX IF NOT EXISTS ambulances_geo_index ON ambulances USING GIST(location);
CREATE INDEX IF NOT EXISTS hospitals_geo_index ON hospitals USING GIST(location);

-- Function to find nearest ambulance with coordinates
CREATE OR REPLACE FUNCTION find_nearest_ambulance(search_type TEXT, search_lng FLOAT, search_lat FLOAT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  status TEXT,
  driver_name TEXT,
  distance_meters FLOAT,
  lng FLOAT,
  lat FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.name, a.type, a.status, a.driver_name,
    ST_Distance(a.location, ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography) AS distance_meters,
    ST_X(a.location::geometry) AS lng,
    ST_Y(a.location::geometry) AS lat
  FROM ambulances a
  WHERE a.status = 'available' AND a.type = search_type
  ORDER BY distance_meters ASC
  LIMIT 1;
END;
$$;

-- Function to find best hospital with coordinates
CREATE OR REPLACE FUNCTION find_best_hospital(req_capabilities TEXT[], search_lng FLOAT, search_lat FLOAT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  available_beds INT,
  capabilities TEXT[],
  distance_meters FLOAT,
  lng FLOAT,
  lat FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT h.id, h.name, h.available_beds, h.capabilities,
    ST_Distance(h.location, ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography) AS distance_meters,
    ST_X(h.location::geometry) AS lng,
    ST_Y(h.location::geometry) AS lat
  FROM hospitals h
  WHERE h.available_beds > 0 AND h.capabilities @> req_capabilities
  ORDER BY distance_meters ASC
  LIMIT 1;
END;
$$;
