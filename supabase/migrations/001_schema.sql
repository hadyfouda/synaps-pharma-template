-- ============================================================
-- SYNAPS Pharma Template - Database Schema
-- Run this in your Supabase SQL editor to set up the system
-- ============================================================

-- Representatives (Reps, District Managers, Line Managers)
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

-- Rep to Area assignments (with history)
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

-- Pharmacies / HCOs (Healthcare Organizations)
CREATE TABLE IF NOT EXISTS pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  area_id UUID REFERENCES areas(id),
  specialty TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sales Data (aggregated monthly)
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

-- Uploaded files tracking
CREATE TABLE IF NOT EXISTS uploaded_kpi_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  month TEXT NOT NULL,
  uploaded_by UUID REFERENCES representatives(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_kpi_files ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read representatives" ON representatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read areas" ON areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read rep_assignments" ON rep_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read pharmacies" ON pharmacies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read sales_data" ON sales_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read kpi_targets" ON kpi_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read uploaded_kpi_files" ON uploaded_kpi_files FOR SELECT TO authenticated USING (true);

-- Service role can do everything (used by import scripts)
-- No extra policies needed for service role - it bypasses RLS by default

-- ============================================================
-- Helper indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sales_data_rep_month ON sales_data(rep_id, month);
CREATE INDEX IF NOT EXISTS idx_sales_data_month ON sales_data(month);
CREATE INDEX IF NOT EXISTS idx_sales_data_product ON sales_data(product_name);
CREATE INDEX IF NOT EXISTS idx_rep_assignments_rep ON rep_assignments(rep_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rep_assignments_area ON rep_assignments(area_id) WHERE is_active = true;
