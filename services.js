const services = [
  // Simulation
  { code: "SIM-001", name: "CT-sim without contrast", unit: "Per session", category: "Simulation", perFraction: false },
  { code: "SIM-002", name: "CT-sim with contrast", unit: "Per session", category: "Simulation", perFraction: false },
  { code: "SIM-003", name: "MRI-sim with contrast", unit: "Per session", category: "Simulation", perFraction: false },
  { code: "SIM-004", name: "PET-CT-sim", unit: "Per patient", category: "Simulation", perFraction: false },
  // Immobilization
  { code: "IMM-001", name: "Head mask", unit: "Per patient", category: "Immobilization", perFraction: false },
  { code: "IMM-002", name: "Head & neck mask", unit: "Per patient", category: "Immobilization", perFraction: false },
  { code: "IMM-003", name: "Open head mask", unit: "Per patient", category: "Immobilization", perFraction: false },
  { code: "IMM-004", name: "Open head and chest mask", unit: "Per patient", category: "Immobilization", perFraction: false },
  { code: "IMM-005", name: "SRS brain mask", unit: "Per patient", category: "Immobilization", perFraction: false },
  { code: "IMM-006", name: "Pelvis mask", unit: "Per patient", category: "Immobilization", perFraction: false },
  { code: "IMM-007", name: "Prone breast board", unit: "Per patient", category: "Immobilization", perFraction: false },
  { code: "IMM-008", name: "Vac-Lok cushion", unit: "Per patient", category: "Immobilization", perFraction: false },
  // Special Techniques
  { code: "TECH-001", name: "Surface Guided RT – SGRT (Identify)", unit: "Per plan", category: "Special Technique", perFraction: false },
  { code: "TECH-002", name: "Respiratory Gating (ARMS)", unit: "Per plan", category: "Special Technique", perFraction: false },
  // Planning
  { code: "PLAN-001", name: "IMRT/VMAT Plan", unit: "Per plan", category: "Planning", perFraction: false },
  { code: "PLAN-002", name: "SRS / SBRT Plan", unit: "Per plan", category: "Planning", perFraction: false },
  { code: "PLAN-003", name: "3D Conformal Plan (3D-CRT)", unit: "Per plan", category: "Planning", perFraction: false },
  { code: "PLAN-004", name: "Physics QA – IMRT/VMAT/SBRT/SRS", unit: "Per plan", category: "Planning", perFraction: false },
  // Treatment Delivery
  { code: "DEL-001", name: "Treatment Delivery – 3D-CRT", unit: "Per fraction", category: "Treatment Delivery", perFraction: true },
  { code: "DEL-002", name: "Treatment Delivery – IMRT/VMAT", unit: "Per fraction", category: "Treatment Delivery", perFraction: true },
  { code: "DEL-003", name: "IGRT – HyperSight Cone Beam (CBCT)", unit: "Per fraction", category: "Treatment Delivery", perFraction: true },
  { code: "DEL-004", name: "Electron Beam", unit: "Per fraction", category: "Treatment Delivery", perFraction: true, notes: "Max 2 fields" },
  { code: "DEL-005", name: "TSE – Stanford Technique", unit: "Per fraction", category: "Treatment Delivery", perFraction: true },
  // SBRT/SRS Packages
  { code: "PKG-001", name: "SBRT 1–5 Fractions – Prostate", unit: "Package", category: "SBRT/SRS Package", perFraction: false, notes: "Fixation, SGRT, QA, CT/MRI-sim, HyperSight, Auto-tracking, 6DoF Couch" },
  { code: "PKG-002", name: "SBRT 1–5 Fractions – Lung", unit: "Package", category: "SBRT/SRS Package", perFraction: false, notes: "Fixation, SGRT, QA, Respiratory Gating, CT-sim, HyperSight, Auto-tracking, 6DoF Couch" },
  { code: "PKG-003", name: "SBRT 1–5 Fractions – Liver / Pancreas / Suprarenal", unit: "Package", category: "SBRT/SRS Package", perFraction: false, notes: "Fixation, SGRT, QA, Respiratory Gating, CT-sim, HyperSight, Auto-tracking, 6DoF Couch" },
  { code: "PKG-004", name: "SBRT 1–5 Fractions – Spine", unit: "Package", category: "SBRT/SRS Package", perFraction: false, notes: "Fixation, SGRT, QA, Respiratory Gating, CT-sim, HyperSight, Auto-tracking, 6DoF Couch" },
  { code: "PKG-005", name: "SBRT 1–5 Fractions – Head & Neck", unit: "Package", category: "SBRT/SRS Package", perFraction: false, notes: "Fixation, SGRT, QA, CT/MRI-sim, HyperSight, Auto-tracking, 6DoF Couch" },
  { code: "PKG-006", name: "SBRT 1–5 Fractions – Oligometastases", unit: "Package", category: "SBRT/SRS Package", perFraction: false, notes: "Fixation, SGRT, QA, Respiratory Gating, CT-sim, HyperSight, Auto-tracking, 6DoF Couch" },
  { code: "PKG-007", name: "SRS 1–5 Fractions – Brain Metastases", unit: "Package", category: "SBRT/SRS Package", perFraction: false, notes: "Fixation, SGRT, QA, MRI/CT-sim, HyperArc, HyperSight, Auto-tracking, 6DoF Couch" },
  { code: "PKG-008", name: "SRS 1–5 Fractions – Benign Lesions", unit: "Package", category: "SBRT/SRS Package", perFraction: false, notes: "Fixation, SGRT, QA, MRI/CT-sim, HyperArc, HyperSight, Auto-tracking, 6DoF Couch" },
  // Special Procedures
  { code: "SPEC-001", name: "Palliative RT (1–5 Fractions)", unit: "Package", category: "Special Procedure", perFraction: false, notes: "Includes sim, plan, and delivery" },
  { code: "SPEC-002", name: "Emergency RT (Same-day sim + delivery)", unit: "Package", category: "Special Procedure", perFraction: false, notes: "Same-day urgent setup" },
  { code: "SPEC-003", name: "Total Body Irradiation (TBI)", unit: "Package", category: "Special Procedure", perFraction: false },
  { code: "SPEC-004", name: "Anesthesia (General)", unit: "Per event", category: "Special Procedure", perFraction: false },
  // Quality & Review
  { code: "QA-001", name: "Velocity – Adaptive RT / Re-irradiation / Plan Sum", unit: "Per plan", category: "Quality & Review", perFraction: false },
  { code: "QA-002", name: "Peer Review", unit: "Per plan", category: "Quality & Review", perFraction: false },
  { code: "QA-003", name: "Initial Consultation (Oncologist)", unit: "Per plan", category: "Quality & Review", perFraction: false, notes: "Online review and plan acceptance" },
  { code: "QA-004", name: "Follow-up Consultation", unit: "Per event", category: "Quality & Review", perFraction: false },
  { code: "QA-005", name: "Multidisciplinary Board Review", unit: "Per patient", category: "Quality & Review", perFraction: false },
];
module.exports = services;
