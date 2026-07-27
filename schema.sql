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

-- Doctor financial settings
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS referral_fee_pct NUMERIC(5,2) DEFAULT 0;

-- Doctor earnings per patient
CREATE TABLE IF NOT EXISTS doctor_earnings (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES doctors(id),
  patient_id INTEGER REFERENCES patients(id),
  estimate_id INTEGER REFERENCES cost_estimates(id),
  total_billed_egp NUMERIC(12,2),
  referral_pct NUMERIC(5,2),
  referral_amount_egp NUMERIC(12,2),
  doctor_fees_egp NUMERIC(12,2) DEFAULT 0,
  total_due_egp NUMERIC(12,2),
  transferred_egp NUMERIC(12,2) DEFAULT 0,
  balance_egp NUMERIC(12,2),
  status VARCHAR(20) DEFAULT 'pending',
  month VARCHAR(7),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(estimate_id)
);

-- Transfer records
CREATE TABLE IF NOT EXISTS doctor_transfers (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES doctors(id),
  earning_id INTEGER REFERENCES doctor_earnings(id),
  amount_egp NUMERIC(12,2),
  transfer_date DATE DEFAULT CURRENT_DATE,
  method VARCHAR(50),
  reference VARCHAR(100),
  recorded_by INTEGER REFERENCES admins(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RTT (Radiation Therapist / simulation scheduling) accounts
CREATE TABLE IF NOT EXISTS rtts (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sim order scheduling & documentation by RTT
ALTER TABLE sim_orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;
ALTER TABLE sim_orders ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE sim_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE sim_orders ADD COLUMN IF NOT EXISTS rtt_id INTEGER REFERENCES rtts(id);

-- Medical Physicist (treatment planning) accounts
CREATE TABLE IF NOT EXISTS physicists (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Media attachments (photos / short videos) uploaded by RTT or Medical
-- Physicist alongside their documentation notes
CREATE TABLE IF NOT EXISTS order_attachments (
  id SERIAL PRIMARY KEY,
  order_type VARCHAR(20) NOT NULL, -- 'sim' or 'clinical'
  order_id INTEGER NOT NULL,
  uploaded_by_role VARCHAR(20),
  uploaded_by_id INTEGER,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) NOT NULL, -- 'image' or 'video'
  original_filename VARCHAR(255),
  size_bytes INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_attachments_lookup ON order_attachments(order_type, order_id);

-- Treatment planning scheduling, documentation & replanning
-- (planning_status is separate from clinical_orders.status, which is the
-- doctor's fixed "submitted" flag and is not a general workflow status)
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS planning_scheduled_at TIMESTAMP;
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS planning_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS planning_notes TEXT;
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS planning_completed_at TIMESTAMP;
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS physicist_id INTEGER REFERENCES physicists(id);
ALTER TABLE clinical_orders ADD COLUMN IF NOT EXISTS replan_count INTEGER DEFAULT 0;

-- Two-way messaging on an order (e.g. oncologist <-> medical physicist on a
-- clinical/planning order), supporting typed notes, an urgent "red flag"
-- marker, and attached photo/video/voice-note media (via order_attachments).
CREATE TABLE IF NOT EXISTS order_messages (
  id SERIAL PRIMARY KEY,
  order_type VARCHAR(20) NOT NULL, -- 'sim' or 'clinical'
  order_id INTEGER NOT NULL,
  sender_role VARCHAR(20) NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT,
  is_flagged BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_messages_lookup ON order_messages(order_type, order_id);

-- Link an attachment to a specific chat message (nullable — attachments
-- uploaded from the RTT/physicist documentation panel stay order-level,
-- not tied to any one message)
ALTER TABLE order_attachments ADD COLUMN IF NOT EXISTS message_id INTEGER REFERENCES order_messages(id);

-- Admin can edit a recorded payment's amount/status at any time (e.g. a
-- pending insurance credit later confirmed, or a bounced payment cancelled).
-- Cancelled payments are excluded from billing.amount_paid_egp/balance_egp.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed';

-- Admin can apply a discount to a patient's bill (e.g. on the referring
-- doctor's request). The discount excludes consultation/follow-up fees
-- (QA-003/004/005) — it only reduces the treatment/procedure cost portion.
ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_egp NUMERIC(12,2) DEFAULT 0;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_by INTEGER REFERENCES admins(id);
ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_at TIMESTAMP;
