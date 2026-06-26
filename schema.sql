-- ACMC Radiotherapy Portal — Full Schema

CREATE TABLE doctors (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(30),
  specialty VARCHAR(100),
  clinic_affiliation VARCHAR(200),
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(300) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  per_fraction BOOLEAN DEFAULT false,
  price_egp NUMERIC(10,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES doctors(id),
  full_name VARCHAR(200) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10),
  national_id VARCHAR(30),
  phone VARCHAR(30),
  diagnosis TEXT,
  icd10_code VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Simulation orders
CREATE TABLE sim_orders (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id),
  doctor_id INTEGER REFERENCES doctors(id),
  positioning VARCHAR(100),
  fixation VARCHAR(100),
  shields TEXT[], -- array of selected shields
  bolus VARCHAR(10),
  bolus_thickness VARCHAR(20),
  ct_contrast VARCHAR(50),
  ct_slice_thickness VARCHAR(20),
  ct_scan_region VARCHAR(200),
  ct_4d VARCHAR(10),
  sgrt VARCHAR(10),
  rpm VARCHAR(10),
  mri VARCHAR(10),
  mri_sequence VARCHAR(100),
  mri_contrast VARCHAR(10),
  mri_slice_thickness VARCHAR(20),
  pet_ct VARCHAR(10),
  special_orders TEXT[],
  notes_to_physics TEXT,
  sim_date_requested DATE,
  status VARCHAR(30) DEFAULT 'pending',
  order_ref VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Clinical treatment orders
CREATE TABLE clinical_orders (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id),
  doctor_id INTEGER REFERENCES doctors(id),
  clinical_history TEXT,
  total_dose_gy NUMERIC(6,2),
  fractions INTEGER,
  duration_weeks INTEGER,
  dose_per_fraction_gy NUMERIC(5,2),
  technique VARCHAR(100),
  treatment_site VARCHAR(200),
  sgrt VARCHAR(10),
  dibh VARCHAR(10),
  igrt VARCHAR(50),
  intent VARCHAR(50),
  sequence VARCHAR(50),
  special_instructions TEXT,
  notes_to_team TEXT,
  prescription_text TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  order_ref VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cost estimates
CREATE TABLE cost_estimates (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id),
  doctor_id INTEGER REFERENCES doctors(id),
  total_egp NUMERIC(12,2) DEFAULT 0,
  has_tbd BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'pending',
  order_ref VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cost_estimate_items (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER REFERENCES cost_estimates(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  quantity INTEGER DEFAULT 1,
  unit_price_egp NUMERIC(10,2),
  subtotal_egp NUMERIC(12,2)
);

-- Treatment progress milestones (linked to patient)
CREATE TABLE milestones (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id),
  simulation_done BOOLEAN DEFAULT false,
  simulation_date DATE,
  planning_done BOOLEAN DEFAULT false,
  planning_date DATE,
  treatment_started BOOLEAN DEFAULT false,
  treatment_start_date DATE,
  treatment_completed BOOLEAN DEFAULT false,
  treatment_end_date DATE,
  notes TEXT,
  updated_by INTEGER REFERENCES admins(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Billing (linked to cost estimate)
CREATE TABLE billing (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER REFERENCES cost_estimates(id),
  patient_id INTEGER REFERENCES patients(id),
  total_amount_egp NUMERIC(12,2),
  amount_paid_egp NUMERIC(12,2) DEFAULT 0,
  balance_egp NUMERIC(12,2),
  status VARCHAR(20) DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  billing_id INTEGER REFERENCES billing(id),
  amount_egp NUMERIC(12,2),
  payment_date DATE DEFAULT CURRENT_DATE,
  method VARCHAR(50),
  reference VARCHAR(100),
  recorded_by INTEGER REFERENCES admins(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
