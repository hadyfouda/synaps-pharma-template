-- SYNAPS Pharma Template - Database Schema
-- Run this in your Supabase SQL editor to set up the system

-- Representatives (Reps and Managers)
CREATE TABLE IF NOT EXISTS representatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  mr_code TEXT UNIQUE,
  manager_id UUID REFERENCES representatives(id),
  role TEXT CHECK (role IN ('line_manager', 'district_manager', 'rep')) DEFAULT 'rep',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Areas / Territories / Bricks
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rep to Area assignments
CREATE TABLE IF NOT EXISTS rep_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID REFERENCES representatives(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('rep', 'manager')) DEFAULT 'rep',
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(rep_id, area_id)
);

-- Pharmacies / HCOs
CREATE TABLE IF NOT EXISTS pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  area_id UUID REFERENCES areas(id),
  specialty TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sales Data
CREATE TABLE IF NOT EXISTS sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID REFERENCES representatives(id),
  pharmacy_id UUID REFERENCES pharmacies(id),
  area_id UUID REFERENCES areas(id),
  product_name TEXT NOT NULL,
  month TEXT NOT NULL, -- Format: YYYY-MM
  net_sales NUMERIC DEFAULT 0,
  target NUMERIC DEFAULT 0,
  units INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- KPI Monthly Targets
CREATE TABLE IF NOT EXISTS kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID REFERENCES representatives(id),
  month TEXT NOT NULL,
  product_name TEXT,
  target NUMERIC DEFAULT 0,
  target_units INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;

-- Basic read policies (customize as needed)
CREATE POLICY "Allow authenticated read" ON representatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON rep_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON pharmacies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON sales_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON kpi_targets FOR SELECT TO authenticated USING (true);
