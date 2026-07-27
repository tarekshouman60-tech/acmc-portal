from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import asyncpg, jwt, bcrypt, os, random, string, asyncio, uuid, pathlib
from datetime import datetime, date, timedelta

app = FastAPI(title="ACMC Radiotherapy Portal")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], max_age=600)

DB_URL = os.getenv("DATABASE_URL", "postgresql://acmc:acmc_pass@db:5432/acmc")
SECRET  = os.getenv("JWT_SECRET", "change_this_in_production")
bearer  = HTTPBearer()

UPLOAD_DIR = pathlib.Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ATTACHMENT_KINDS = {
    "image": {".jpg", ".jpeg"},
    "video": {".mp4", ".mov", ".webm"},
    "audio": {".mp3", ".m4a", ".wav", ".ogg", ".webm"},
}
ATTACHMENT_MAX_BYTES = {"image": 8*1024*1024, "video": 30*1024*1024, "audio": 15*1024*1024}

# ── helpers ───────────────────────────────────────────────────────────────────
def gen_ref(prefix):
    return f"{prefix}-{datetime.now().year}-{''.join(random.choices(string.digits,k=4))}"

def gen_password(length=12):
    alphabet = string.ascii_letters + string.digits
    while True:
        pw = ''.join(random.choices(alphabet, k=length))
        if any(c.islower() for c in pw) and any(c.isupper() for c in pw) and any(c.isdigit() for c in pw):
            return pw

async def get_db():
    conn = await asyncpg.connect(DB_URL)
    try: yield conn
    finally: await conn.close()

def make_token(sub, role):
    return jwt.encode({"sub":str(sub),"role":role,"exp":datetime.utcnow()+timedelta(days=7)}, SECRET, algorithm="HS256")

def decode_token(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    try: return jwt.decode(creds.credentials, SECRET, algorithms=["HS256"])
    except: raise HTTPException(401, "Invalid or expired token")

def doctor_or_admin(tok=Depends(decode_token)):
    if tok["role"] not in ("doctor","admin"): raise HTTPException(403)
    return tok

def admin_only(tok=Depends(decode_token)):
    if tok["role"] != "admin": raise HTTPException(403)
    return tok

def rtt_or_admin(tok=Depends(decode_token)):
    if tok["role"] not in ("rtt","admin"): raise HTTPException(403)
    return tok

def physicist_or_admin(tok=Depends(decode_token)):
    if tok["role"] not in ("physicist","admin"): raise HTTPException(403)
    return tok

ROLE_TABLE = {"admin":"admins","doctor":"doctors","rtt":"rtts","physicist":"physicists"}

# ── models ────────────────────────────────────────────────────────────────────
class LoginReq(BaseModel):
    email: str; password: str

class DoctorCreate(BaseModel):
    full_name: str; email: EmailStr; phone: Optional[str]=None
    specialty: Optional[str]=None; clinic_affiliation: Optional[str]=None; password: str

class RttCreate(BaseModel):
    full_name: str; email: EmailStr; password: str

class RttSimUpdate(BaseModel):
    scheduled_at: Optional[datetime]=None
    status: Optional[str]=None
    completion_notes: Optional[str]=None

class PhysicistCreate(BaseModel):
    full_name: str; email: EmailStr; password: str

class PhysicistPlanningUpdate(BaseModel):
    planning_scheduled_at: Optional[datetime]=None
    status: Optional[str]=None
    planning_notes: Optional[str]=None
    replan: Optional[bool]=False

class MessageCreate(BaseModel):
    order_type: str
    order_id: int
    body: Optional[str]=None
    is_flagged: bool=False

class PatientCreate(BaseModel):
    full_name: str; date_of_birth: Optional[date]=None; gender: Optional[str]=None
    national_id: Optional[str]=None; phone: Optional[str]=None
    diagnosis: Optional[str]=None; icd10_code: Optional[str]=None

class SimOrderCreate(BaseModel):
    patient_id: int; positioning: Optional[str]=None; fixation: Optional[str]=None
    shields: Optional[List[str]]=None; bolus: Optional[str]=None; bolus_thickness: Optional[str]=None
    ct_contrast: Optional[str]=None; ct_slice_thickness: Optional[str]=None
    ct_scan_region: Optional[str]=None; ct_4d: Optional[str]=None
    sgrt: Optional[str]=None; rpm: Optional[str]=None
    mri: Optional[str]=None; mri_sequence: Optional[str]=None
    mri_contrast: Optional[str]=None; mri_slice_thickness: Optional[str]=None
    pet_ct: Optional[str]=None; special_orders: Optional[List[str]]=None
    notes_to_physics: Optional[str]=None; sim_date_requested: Optional[date]=None

class ClinicalOrderCreate(BaseModel):
    patient_id: int; clinical_history: Optional[str]=None
    total_dose_gy: Optional[float]=None; fractions: Optional[int]=None
    duration_weeks: Optional[int]=None; dose_per_fraction_gy: Optional[float]=None
    technique: Optional[str]=None; treatment_site: Optional[str]=None
    sgrt: Optional[str]=None; dibh: Optional[str]=None; igrt: Optional[str]=None
    intent: Optional[str]=None; sequence: Optional[str]=None
    special_instructions: Optional[str]=None; notes_to_team: Optional[str]=None
    prescription_text: Optional[str]=None

class EstimateItem(BaseModel):
    service_id: int; quantity: int=1; unit_price: Optional[float]=None

class EstimateCreate(BaseModel):
    patient_id: int; items: List[EstimateItem]

class MilestoneUpdate(BaseModel):
    simulation_done: Optional[bool]=None; simulation_date: Optional[date]=None
    planning_done: Optional[bool]=None; planning_date: Optional[date]=None
    treatment_started: Optional[bool]=None; treatment_start_date: Optional[date]=None
    treatment_completed: Optional[bool]=None; treatment_end_date: Optional[date]=None
    notes: Optional[str]=None

class PaymentCreate(BaseModel):
    billing_id: int; amount_egp: float; payment_date: Optional[date]=None
    method: str; reference: Optional[str]=None; notes: Optional[str]=None

class ServicePriceUpdate(BaseModel):
    price_egp: float

# ── auth ──────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
async def login(req: LoginReq, db=Depends(get_db)):
    row = await db.fetchrow("SELECT id,password_hash FROM admins WHERE email=$1 AND is_active=true", req.email)
    if row and bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        return {"token": make_token(row["id"],"admin"), "role":"admin"}
    row = await db.fetchrow("SELECT id,password_hash FROM doctors WHERE email=$1 AND is_active=true", req.email)
    if row and bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        return {"token": make_token(row["id"],"doctor"), "role":"doctor"}
    row = await db.fetchrow("SELECT id,password_hash FROM rtts WHERE email=$1 AND is_active=true", req.email)
    if row and bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        return {"token": make_token(row["id"],"rtt"), "role":"rtt"}
    row = await db.fetchrow("SELECT id,password_hash FROM physicists WHERE email=$1 AND is_active=true", req.email)
    if row and bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        return {"token": make_token(row["id"],"physicist"), "role":"physicist"}
    raise HTTPException(401, "Invalid credentials")

@app.get("/api/auth/me")
async def me(tok=Depends(decode_token), db=Depends(get_db)):
    if tok["role"]=="admin":
        r = await db.fetchrow("SELECT id,full_name,email FROM admins WHERE id=$1", int(tok["sub"]))
    elif tok["role"]=="rtt":
        r = await db.fetchrow("SELECT id,full_name,email FROM rtts WHERE id=$1", int(tok["sub"]))
    elif tok["role"]=="physicist":
        r = await db.fetchrow("SELECT id,full_name,email FROM physicists WHERE id=$1", int(tok["sub"]))
    else:
        r = await db.fetchrow("SELECT id,full_name,email,specialty,clinic_affiliation,phone FROM doctors WHERE id=$1", int(tok["sub"]))
    return dict(r)|{"role":tok["role"]}

# ── services ──────────────────────────────────────────────────────────────────
@app.get("/api/services")
async def list_services(db=Depends(get_db), tok=Depends(decode_token)):
    rows = await db.fetch("SELECT * FROM services WHERE is_active=true ORDER BY category,code")
    return [dict(r) for r in rows]

@app.patch("/api/services/{sid}/price")
async def update_price(sid: int, body: ServicePriceUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    await db.execute("UPDATE services SET price_egp=$1 WHERE id=$2", body.price_egp, sid)
    return {"ok":True}

# ── doctors (admin) ───────────────────────────────────────────────────────────
@app.get("/api/doctors")
async def list_doctors(db=Depends(get_db), tok=Depends(admin_only)):
    rows = await db.fetch("SELECT id,full_name,email,phone,specialty,clinic_affiliation,is_active,created_at FROM doctors ORDER BY full_name")
    return [dict(r) for r in rows]

@app.post("/api/doctors")
async def create_doctor(body: DoctorCreate, db=Depends(get_db), tok=Depends(admin_only)):
    pw = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    r = await db.fetchrow(
        "INSERT INTO doctors(full_name,email,phone,specialty,clinic_affiliation,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
        body.full_name, body.email, body.phone, body.specialty, body.clinic_affiliation, pw)
    return {"id":r["id"]}

@app.patch("/api/doctors/{did}/toggle")
async def toggle_doctor(did: int, db=Depends(get_db), tok=Depends(admin_only)):
    await db.execute("UPDATE doctors SET is_active=NOT is_active WHERE id=$1", did)
    return {"ok":True}

@app.post("/api/doctors/{did}/reset-password")
async def reset_doctor_password(did: int, db=Depends(get_db), tok=Depends(admin_only)):
    new_pw = gen_password()
    pw_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
    row = await db.fetchrow("UPDATE doctors SET password_hash=$1 WHERE id=$2 RETURNING id", pw_hash, did)
    if not row: raise HTTPException(404, "Doctor not found")
    return {"password": new_pw}

# ── RTT accounts (admin) ─────────────────────────────────────────────────────
@app.get("/api/rtts")
async def list_rtts(db=Depends(get_db), tok=Depends(admin_only)):
    rows = await db.fetch("SELECT id,full_name,email,is_active,created_at FROM rtts ORDER BY full_name")
    return [dict(r) for r in rows]

@app.post("/api/rtts")
async def create_rtt(body: RttCreate, db=Depends(get_db), tok=Depends(admin_only)):
    pw = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    r = await db.fetchrow(
        "INSERT INTO rtts(full_name,email,password_hash) VALUES($1,$2,$3) RETURNING id",
        body.full_name, body.email, pw)
    return {"id":r["id"]}

@app.patch("/api/rtts/{rid}/toggle")
async def toggle_rtt(rid: int, db=Depends(get_db), tok=Depends(admin_only)):
    await db.execute("UPDATE rtts SET is_active=NOT is_active WHERE id=$1", rid)
    return {"ok":True}

@app.post("/api/rtts/{rid}/reset-password")
async def reset_rtt_password(rid: int, db=Depends(get_db), tok=Depends(admin_only)):
    new_pw = gen_password()
    pw_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
    row = await db.fetchrow("UPDATE rtts SET password_hash=$1 WHERE id=$2 RETURNING id", pw_hash, rid)
    if not row: raise HTTPException(404, "RTT not found")
    return {"password": new_pw}

# ── Medical Physicist accounts (admin) ───────────────────────────────────────
@app.get("/api/physicists")
async def list_physicists(db=Depends(get_db), tok=Depends(admin_only)):
    rows = await db.fetch("SELECT id,full_name,email,is_active,created_at FROM physicists ORDER BY full_name")
    return [dict(r) for r in rows]

@app.post("/api/physicists")
async def create_physicist(body: PhysicistCreate, db=Depends(get_db), tok=Depends(admin_only)):
    pw = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    r = await db.fetchrow(
        "INSERT INTO physicists(full_name,email,password_hash) VALUES($1,$2,$3) RETURNING id",
        body.full_name, body.email, pw)
    return {"id":r["id"]}

@app.patch("/api/physicists/{pid}/toggle")
async def toggle_physicist(pid: int, db=Depends(get_db), tok=Depends(admin_only)):
    await db.execute("UPDATE physicists SET is_active=NOT is_active WHERE id=$1", pid)
    return {"ok":True}

@app.post("/api/physicists/{pid}/reset-password")
async def reset_physicist_password(pid: int, db=Depends(get_db), tok=Depends(admin_only)):
    new_pw = gen_password()
    pw_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
    row = await db.fetchrow("UPDATE physicists SET password_hash=$1 WHERE id=$2 RETURNING id", pw_hash, pid)
    if not row: raise HTTPException(404, "Physicist not found")
    return {"password": new_pw}

# ── patients ──────────────────────────────────────────────────────────────────
@app.get("/api/patients")
async def list_patients(db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"]=="admin":
        rows = await db.fetch("SELECT p.*,d.full_name as doctor_name FROM patients p JOIN doctors d ON d.id=p.doctor_id ORDER BY p.created_at DESC")
    else:
        rows = await db.fetch("SELECT * FROM patients WHERE doctor_id=$1 ORDER BY created_at DESC", int(tok["sub"]))
    return [dict(r) for r in rows]

@app.post("/api/patients")
async def create_patient(body: PatientCreate, db=Depends(get_db), tok=Depends(doctor_or_admin)):
    if tok["role"]!="doctor": raise HTTPException(400,"Doctors only")
    r = await db.fetchrow(
        "INSERT INTO patients(doctor_id,full_name,date_of_birth,gender,national_id,phone,diagnosis,icd10_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
        int(tok["sub"]), body.full_name, body.date_of_birth, body.gender, body.national_id, body.phone, body.diagnosis, body.icd10_code)
    # create empty milestones row
    await db.execute("INSERT INTO milestones(patient_id) VALUES($1)", r["id"])
    return {"id":r["id"]}

@app.get("/api/patients/{pid}")
async def get_patient(pid: int, db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"]=="admin":
        p = await db.fetchrow("SELECT p.*,d.full_name as doctor_name,d.clinic_affiliation FROM patients p JOIN doctors d ON d.id=p.doctor_id WHERE p.id=$1", pid)
    else:
        p = await db.fetchrow("SELECT * FROM patients WHERE id=$1 AND doctor_id=$2", pid, int(tok["sub"]))
    if not p: raise HTTPException(404)
    sims = await db.fetch("SELECT id,order_ref,status,sim_date_requested,scheduled_at,completion_notes,created_at FROM sim_orders WHERE patient_id=$1 ORDER BY created_at DESC", pid)
    clins = await db.fetch("SELECT id,order_ref,status,technique,total_dose_gy,fractions,planning_status,planning_scheduled_at,planning_notes,replan_count,created_at FROM clinical_orders WHERE patient_id=$1 ORDER BY created_at DESC", pid)
    ests = await db.fetch("SELECT id,order_ref,status,total_egp,has_tbd,created_at FROM cost_estimates WHERE patient_id=$1 ORDER BY created_at DESC", pid)
    miles = await db.fetchrow("SELECT * FROM milestones WHERE patient_id=$1", pid)
    billing = await db.fetchrow("""
        SELECT b.*, ce.order_ref as estimate_ref, ce.total_egp as gross_total_egp,
            (SELECT COALESCE(SUM(i.subtotal_egp),0) FROM cost_estimate_items i
             JOIN services s ON s.id=i.service_id
             WHERE i.estimate_id=ce.id AND s.code IN ('QA-003','QA-004','QA-005')) as consultation_total_egp
        FROM billing b JOIN cost_estimates ce ON ce.id=b.estimate_id
        WHERE b.patient_id=$1 ORDER BY b.created_at DESC LIMIT 1""", pid)
    payments = []
    if billing:
        payments = await db.fetch("SELECT * FROM payments WHERE billing_id=$1 ORDER BY payment_date", billing["id"])
    return {
        "patient": dict(p),
        "sim_orders": [dict(r) for r in sims],
        "clinical_orders": [dict(r) for r in clins],
        "cost_estimates": [dict(r) for r in ests],
        "milestones": dict(miles) if miles else None,
        "billing": dict(billing) if billing else None,
        "payments": [dict(r) for r in payments]
    }

# ── sim orders ────────────────────────────────────────────────────────────────
@app.post("/api/sim-orders")
async def create_sim(body: SimOrderCreate, db=Depends(get_db), tok=Depends(doctor_or_admin)):
    did = int(tok["sub"])
    p = await db.fetchrow("SELECT id FROM patients WHERE id=$1 AND doctor_id=$2", body.patient_id, did)
    if not p: raise HTTPException(403,"Patient not found")
    # Check if existing sim order for this patient — replace if exists
    existing = await db.fetchrow("SELECT id, order_ref FROM sim_orders WHERE patient_id=$1 AND doctor_id=$2 ORDER BY created_at DESC LIMIT 1", body.patient_id, did)
    if existing:
        await db.execute("""UPDATE sim_orders SET positioning=$1,fixation=$2,shields=$3,bolus=$4,bolus_thickness=$5,
           ct_contrast=$6,ct_slice_thickness=$7,ct_scan_region=$8,ct_4d=$9,sgrt=$10,rpm=$11,mri=$12,
           mri_sequence=$13,mri_contrast=$14,mri_slice_thickness=$15,pet_ct=$16,special_orders=$17,
           notes_to_physics=$18,sim_date_requested=$19,status='pending' WHERE id=$20""",
           body.positioning, body.fixation, body.shields, body.bolus, body.bolus_thickness,
           body.ct_contrast, body.ct_slice_thickness, body.ct_scan_region, body.ct_4d, body.sgrt, body.rpm,
           body.mri, body.mri_sequence, body.mri_contrast, body.mri_slice_thickness, body.pet_ct,
           body.special_orders, body.notes_to_physics, body.sim_date_requested, existing["id"])
        return {"id":existing["id"],"order_ref":existing["order_ref"],"updated":True}
    ref = gen_ref("SIM")
    r = await db.fetchrow(
        """INSERT INTO sim_orders(patient_id,doctor_id,positioning,fixation,shields,bolus,bolus_thickness,
           ct_contrast,ct_slice_thickness,ct_scan_region,ct_4d,sgrt,rpm,mri,mri_sequence,mri_contrast,
           mri_slice_thickness,pet_ct,special_orders,notes_to_physics,sim_date_requested,order_ref)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id""",
        body.patient_id, did, body.positioning, body.fixation, body.shields, body.bolus, body.bolus_thickness,
        body.ct_contrast, body.ct_slice_thickness, body.ct_scan_region, body.ct_4d, body.sgrt, body.rpm,
        body.mri, body.mri_sequence, body.mri_contrast, body.mri_slice_thickness, body.pet_ct,
        body.special_orders, body.notes_to_physics, body.sim_date_requested, ref)
    return {"id":r["id"],"order_ref":ref,"updated":False}

@app.get("/api/sim-orders/{oid}")
async def get_sim(oid: int, db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"] in ("admin","rtt"):
        r = await db.fetchrow("SELECT s.*,p.full_name as patient_name,d.full_name as doctor_name,d.clinic_affiliation FROM sim_orders s JOIN patients p ON p.id=s.patient_id JOIN doctors d ON d.id=s.doctor_id WHERE s.id=$1", oid)
    else:
        r = await db.fetchrow("SELECT s.*,p.full_name as patient_name FROM sim_orders s JOIN patients p ON p.id=s.patient_id WHERE s.id=$1 AND s.doctor_id=$2", oid, int(tok["sub"]))
    if not r: raise HTTPException(404)
    return dict(r)

# ── sim orders — RTT scheduling view (all patients) ───────────────────────────
@app.get("/api/rtt/sim-orders")
async def list_all_sim_orders_rtt(db=Depends(get_db), tok=Depends(rtt_or_admin)):
    rows = await db.fetch("""
        SELECT s.*, p.full_name as patient_name, p.diagnosis, p.phone as patient_phone,
               d.full_name as doctor_name
        FROM sim_orders s
        JOIN patients p ON p.id=s.patient_id
        JOIN doctors d ON d.id=s.doctor_id
        ORDER BY s.scheduled_at NULLS LAST, s.sim_date_requested NULLS LAST, s.created_at DESC
    """)
    return [dict(r) for r in rows]

@app.patch("/api/rtt/sim-orders/{oid}")
async def rtt_update_sim(oid: int, body: RttSimUpdate, db=Depends(get_db), tok=Depends(rtt_or_admin)):
    row = await db.fetchrow("SELECT id, patient_id FROM sim_orders WHERE id=$1", oid)
    if not row: raise HTTPException(404)
    sets, vals = [], []
    if body.scheduled_at is not None:
        scheduled_naive = body.scheduled_at.replace(tzinfo=None) if body.scheduled_at.tzinfo else body.scheduled_at
        sets.append(f"scheduled_at=${len(vals)+1}"); vals.append(scheduled_naive)
    if body.status is not None:
        valid = ['pending','scheduled','done','cancelled']
        if body.status not in valid:
            raise HTTPException(400, f"Invalid status. Must be one of: {valid}")
        sets.append(f"status=${len(vals)+1}"); vals.append(body.status)
        if body.status == 'done':
            sets.append("completed_at=NOW()")
    if body.completion_notes is not None:
        sets.append(f"completion_notes=${len(vals)+1}"); vals.append(body.completion_notes)
    if tok["role"] == "rtt":
        sets.append(f"rtt_id=${len(vals)+1}"); vals.append(int(tok["sub"]))
    if not sets:
        return {"ok": True}
    vals.append(oid)
    await db.execute(f"UPDATE sim_orders SET {', '.join(sets)} WHERE id=${len(vals)}", *vals)
    # Auto-mark the CT Simulation milestone done once the RTT completes the sim —
    # the doctor shouldn't have to wait for an admin to flip it manually.
    if body.status == 'done':
        updated = await db.fetchrow(
            "UPDATE milestones SET simulation_done=true,simulation_date=CURRENT_DATE,updated_at=NOW() WHERE patient_id=$1 AND simulation_done IS NOT TRUE RETURNING patient_id",
            row["patient_id"])
        if updated:
            await send_notification(db, row["patient_id"], "simulation_done")
    return {"ok": True}

# ── clinical orders ───────────────────────────────────────────────────────────
@app.post("/api/clinical-orders")
async def create_clinical(body: ClinicalOrderCreate, db=Depends(get_db), tok=Depends(doctor_or_admin)):
    did = int(tok["sub"])
    p = await db.fetchrow("SELECT id FROM patients WHERE id=$1 AND doctor_id=$2", body.patient_id, did)
    if not p: raise HTTPException(403,"Patient not found")
    # Replace if exists
    existing = await db.fetchrow("SELECT id, order_ref FROM clinical_orders WHERE patient_id=$1 AND doctor_id=$2 ORDER BY created_at DESC LIMIT 1", body.patient_id, did)
    if existing:
        await db.execute("""UPDATE clinical_orders SET clinical_history=$1,total_dose_gy=$2,fractions=$3,
           duration_weeks=$4,dose_per_fraction_gy=$5,technique=$6,treatment_site=$7,sgrt=$8,dibh=$9,
           igrt=$10,intent=$11,sequence=$12,special_instructions=$13,notes_to_team=$14,
           prescription_text=$15,status='submitted' WHERE id=$16""",
           body.clinical_history, body.total_dose_gy, body.fractions,
           body.duration_weeks, body.dose_per_fraction_gy, body.technique, body.treatment_site,
           body.sgrt, body.dibh, body.igrt, body.intent, body.sequence,
           body.special_instructions, body.notes_to_team, body.prescription_text, existing["id"])
        return {"id":existing["id"],"order_ref":existing["order_ref"],"updated":True}
    ref = gen_ref("CLN")
    r = await db.fetchrow(
        """INSERT INTO clinical_orders(patient_id,doctor_id,clinical_history,total_dose_gy,fractions,
           duration_weeks,dose_per_fraction_gy,technique,treatment_site,sgrt,dibh,igrt,intent,sequence,
           special_instructions,notes_to_team,prescription_text,status,order_ref)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'submitted',$18) RETURNING id""",
        body.patient_id, did, body.clinical_history, body.total_dose_gy, body.fractions,
        body.duration_weeks, body.dose_per_fraction_gy, body.technique, body.treatment_site,
        body.sgrt, body.dibh, body.igrt, body.intent, body.sequence,
        body.special_instructions, body.notes_to_team, body.prescription_text, ref)
    return {"id":r["id"],"order_ref":ref,"updated":False}

@app.get("/api/clinical-orders/{oid}")
async def get_clinical(oid: int, db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"] in ("admin","physicist"):
        r = await db.fetchrow("SELECT c.*,p.full_name as patient_name,p.date_of_birth,p.gender,d.full_name as doctor_name,d.clinic_affiliation FROM clinical_orders c JOIN patients p ON p.id=c.patient_id JOIN doctors d ON d.id=c.doctor_id WHERE c.id=$1", oid)
    else:
        r = await db.fetchrow("SELECT c.*,p.full_name as patient_name,p.date_of_birth,p.gender FROM clinical_orders c JOIN patients p ON p.id=c.patient_id WHERE c.id=$1 AND c.doctor_id=$2", oid, int(tok["sub"]))
    if not r: raise HTTPException(404)
    return dict(r)

# ── clinical orders — Medical Physicist planning view (all patients) ──────────
@app.get("/api/physicist/clinical-orders")
async def list_all_clinical_orders_physicist(db=Depends(get_db), tok=Depends(physicist_or_admin)):
    rows = await db.fetch("""
        SELECT c.*, p.full_name as patient_name, p.diagnosis, p.phone as patient_phone,
               d.full_name as doctor_name
        FROM clinical_orders c
        JOIN patients p ON p.id=c.patient_id
        JOIN doctors d ON d.id=c.doctor_id
        ORDER BY c.planning_scheduled_at NULLS LAST, c.created_at DESC
    """)
    return [dict(r) for r in rows]

@app.patch("/api/physicist/clinical-orders/{oid}")
async def physicist_update_clinical(oid: int, body: PhysicistPlanningUpdate, db=Depends(get_db), tok=Depends(physicist_or_admin)):
    row = await db.fetchrow("SELECT id, patient_id FROM clinical_orders WHERE id=$1", oid)
    if not row: raise HTTPException(404)
    sets, vals = [], []
    if body.replan:
        sets.append("planning_status='in_progress'")
        sets.append("replan_count=COALESCE(replan_count,0)+1")
        sets.append("planning_completed_at=NULL")
    elif body.status is not None:
        valid = ['pending','in_progress','completed','cancelled']
        if body.status not in valid:
            raise HTTPException(400, f"Invalid status. Must be one of: {valid}")
        sets.append(f"planning_status=${len(vals)+1}"); vals.append(body.status)
        if body.status == 'completed':
            sets.append("planning_completed_at=NOW()")
    if body.planning_scheduled_at is not None:
        sets.append(f"planning_scheduled_at=${len(vals)+1}"); vals.append(body.planning_scheduled_at)
    if body.planning_notes is not None:
        sets.append(f"planning_notes=${len(vals)+1}"); vals.append(body.planning_notes)
    if tok["role"] == "physicist":
        sets.append(f"physicist_id=${len(vals)+1}"); vals.append(int(tok["sub"]))
    if not sets:
        return {"ok": True}
    vals.append(oid)
    await db.execute(f"UPDATE clinical_orders SET {', '.join(sets)} WHERE id=${len(vals)}", *vals)
    # Auto-mark the Treatment Planning milestone done once the physicist completes
    # planning — the doctor shouldn't have to wait for an admin to flip it manually.
    if body.status == 'completed':
        updated = await db.fetchrow(
            "UPDATE milestones SET planning_done=true,planning_date=CURRENT_DATE,updated_at=NOW() WHERE patient_id=$1 AND planning_done IS NOT TRUE RETURNING patient_id",
            row["patient_id"])
        if updated:
            await send_notification(db, row["patient_id"], "planning_done")
    return {"ok": True}

# ── order attachments (photos / short videos / voice notes) ───────────────────
async def _check_order_access(order_type: str, order_id: int, tok: dict, db) -> dict:
    if order_type not in ("sim", "clinical"):
        raise HTTPException(400, "order_type must be 'sim' or 'clinical'")
    table = "sim_orders" if order_type == "sim" else "clinical_orders"
    row = await db.fetchrow(f"SELECT id, doctor_id FROM {table} WHERE id=$1", order_id)
    if not row:
        raise HTTPException(404, "Order not found")
    role = tok["role"]
    if role == "admin":
        return row
    if role == "doctor" and row["doctor_id"] == int(tok["sub"]):
        return row
    if role == "rtt" and order_type == "sim":
        return row
    if role == "physicist" and order_type == "clinical":
        return row
    raise HTTPException(403, "Not authorized for this order")

@app.post("/api/attachments")
async def upload_attachment(
    order_type: str = Form(...), order_id: int = Form(...), kind: str = Form(...),
    message_id: Optional[int] = Form(None),
    file: UploadFile = File(...), db=Depends(get_db), tok=Depends(decode_token)):
    if kind not in ATTACHMENT_KINDS:
        raise HTTPException(400, f"kind must be one of {list(ATTACHMENT_KINDS)}")
    # Message-attached media (chat) is open to anyone with access to the order;
    # order-level documentation attachments stay RTT/physicist/admin only.
    if message_id is None and tok["role"] not in ("admin", "rtt", "physicist"):
        raise HTTPException(403, "Only RTT, Medical Physicist or admin can upload documentation attachments")
    await _check_order_access(order_type, order_id, tok, db)
    if message_id is not None:
        mrow = await db.fetchrow("SELECT id FROM order_messages WHERE id=$1 AND order_type=$2 AND order_id=$3", message_id, order_type, order_id)
        if not mrow: raise HTTPException(404, "Message not found")
    ext = pathlib.Path(file.filename or "").suffix.lower()
    if ext not in ATTACHMENT_KINDS[kind]:
        raise HTTPException(400, f"Unsupported file extension for {kind}: {ext or '(none)'}")
    data = await file.read()
    if len(data) > ATTACHMENT_MAX_BYTES[kind]:
        raise HTTPException(400, f"File too large — max {ATTACHMENT_MAX_BYTES[kind]//(1024*1024)}MB for {kind}")
    subdir = UPLOAD_DIR / order_type / str(order_id)
    subdir.mkdir(parents=True, exist_ok=True)
    fname = f"{uuid.uuid4().hex}{ext}"
    (subdir / fname).write_bytes(data)
    r = await db.fetchrow(
        """INSERT INTO order_attachments(order_type,order_id,uploaded_by_role,uploaded_by_id,file_path,file_type,original_filename,size_bytes,message_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,created_at""",
        order_type, order_id, tok["role"], int(tok["sub"]), f"{order_type}/{order_id}/{fname}", kind, file.filename, len(data), message_id)
    return {"id": r["id"], "file_type": kind, "original_filename": file.filename, "created_at": r["created_at"]}

@app.get("/api/attachments")
async def list_attachments(order_type: str, order_id: int, db=Depends(get_db), tok=Depends(decode_token)):
    await _check_order_access(order_type, order_id, tok, db)
    rows = await db.fetch(
        "SELECT id,file_type,original_filename,size_bytes,uploaded_by_role,created_at FROM order_attachments WHERE order_type=$1 AND order_id=$2 ORDER BY created_at",
        order_type, order_id)
    return [dict(r) for r in rows]

@app.get("/api/attachments/{aid}/file")
async def get_attachment_file(aid: int, db=Depends(get_db), tok=Depends(decode_token)):
    row = await db.fetchrow("SELECT * FROM order_attachments WHERE id=$1", aid)
    if not row: raise HTTPException(404)
    await _check_order_access(row["order_type"], row["order_id"], tok, db)
    path = UPLOAD_DIR / row["file_path"]
    if not path.exists(): raise HTTPException(404, "File missing on disk")
    return FileResponse(path, filename=row["original_filename"] or path.name)

@app.delete("/api/attachments/{aid}")
async def delete_attachment(aid: int, db=Depends(get_db), tok=Depends(decode_token)):
    row = await db.fetchrow("SELECT * FROM order_attachments WHERE id=$1", aid)
    if not row: raise HTTPException(404)
    if tok["role"] != "admin" and not (row["uploaded_by_role"] == tok["role"] and row["uploaded_by_id"] == int(tok["sub"])):
        raise HTTPException(403, "Only the uploader or admin can delete this attachment")
    path = UPLOAD_DIR / row["file_path"]
    path.unlink(missing_ok=True)
    await db.execute("DELETE FROM order_attachments WHERE id=$1", aid)
    return {"ok": True}

# ── order messaging (oncologist <-> RTT/physicist) ─────────────────────────────
@app.post("/api/messages")
async def create_message(body: MessageCreate, db=Depends(get_db), tok=Depends(decode_token)):
    await _check_order_access(body.order_type, body.order_id, tok, db)
    r = await db.fetchrow(
        "INSERT INTO order_messages(order_type,order_id,sender_role,sender_id,body,is_flagged) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at",
        body.order_type, body.order_id, tok["role"], int(tok["sub"]), body.body, body.is_flagged)
    return {"id": r["id"], "created_at": r["created_at"]}

@app.get("/api/messages")
async def list_messages(order_type: str, order_id: int, db=Depends(get_db), tok=Depends(decode_token)):
    await _check_order_access(order_type, order_id, tok, db)
    rows = await db.fetch(
        "SELECT * FROM order_messages WHERE order_type=$1 AND order_id=$2 ORDER BY created_at",
        order_type, order_id)
    result = []
    for r in rows:
        d = dict(r)
        table = ROLE_TABLE.get(d["sender_role"])
        name = None
        if table:
            nrow = await db.fetchrow(f"SELECT full_name FROM {table} WHERE id=$1", d["sender_id"])
            name = nrow["full_name"] if nrow else None
        d["sender_name"] = name
        atts = await db.fetch(
            "SELECT id,file_type,original_filename,size_bytes FROM order_attachments WHERE message_id=$1 ORDER BY created_at",
            d["id"])
        d["attachments"] = [dict(a) for a in atts]
        result.append(d)
    return result

@app.patch("/api/messages/{mid}/read")
async def mark_message_read(mid: int, db=Depends(get_db), tok=Depends(decode_token)):
    row = await db.fetchrow("SELECT * FROM order_messages WHERE id=$1", mid)
    if not row: raise HTTPException(404)
    await _check_order_access(row["order_type"], row["order_id"], tok, db)
    if not (row["sender_role"] == tok["role"] and row["sender_id"] == int(tok["sub"])):
        await db.execute("UPDATE order_messages SET read_at=COALESCE(read_at,NOW()) WHERE id=$1", mid)
    return {"ok": True}

@app.get("/api/messages/unread-count")
async def unread_message_count(db=Depends(get_db), tok=Depends(decode_token)):
    role = tok["role"]
    if role == "admin":
        rows = await db.fetch(
            "SELECT order_type, order_id, COUNT(*) as cnt FROM order_messages WHERE is_flagged=true AND read_at IS NULL AND sender_role != 'admin' GROUP BY order_type, order_id")
    elif role == "physicist":
        rows = await db.fetch(
            "SELECT order_id, COUNT(*) as cnt FROM order_messages WHERE order_type='clinical' AND is_flagged=true AND read_at IS NULL AND sender_role != 'physicist' GROUP BY order_id")
    elif role == "rtt":
        rows = await db.fetch(
            "SELECT order_id, COUNT(*) as cnt FROM order_messages WHERE order_type='sim' AND is_flagged=true AND read_at IS NULL AND sender_role != 'rtt' GROUP BY order_id")
    else:  # doctor
        did = int(tok["sub"])
        rows = await db.fetch("""
            SELECT om.order_type, om.order_id, COUNT(*) as cnt FROM order_messages om
            WHERE om.is_flagged=true AND om.read_at IS NULL AND om.sender_role != 'doctor'
              AND (
                (om.order_type='clinical' AND om.order_id IN (SELECT id FROM clinical_orders WHERE doctor_id=$1))
                OR (om.order_type='sim' AND om.order_id IN (SELECT id FROM sim_orders WHERE doctor_id=$1))
              )
            GROUP BY om.order_type, om.order_id
        """, did)
    total = sum(r["cnt"] for r in rows)
    return {"total": total, "by_order": [dict(r) for r in rows]}

# ── cost estimates ────────────────────────────────────────────────────────────
@app.post("/api/estimates")
async def create_estimate(body: EstimateCreate, db=Depends(get_db), tok=Depends(doctor_or_admin)):
    did = int(tok["sub"])
    p = await db.fetchrow("SELECT id FROM patients WHERE id=$1 AND doctor_id=$2", body.patient_id, did)
    if not p: raise HTTPException(403,"Patient not found")
    # Replace if exists — delete old items and billing, reuse same ref
    existing = await db.fetchrow("SELECT id, order_ref FROM cost_estimates WHERE patient_id=$1 AND doctor_id=$2 ORDER BY created_at DESC LIMIT 1", body.patient_id, did)
    if existing:
        await db.execute("DELETE FROM cost_estimate_items WHERE estimate_id=$1", existing["id"])
        await db.execute("DELETE FROM payments WHERE billing_id IN (SELECT id FROM billing WHERE estimate_id=$1)", existing["id"])
        await db.execute("DELETE FROM billing WHERE estimate_id=$1", existing["id"])
        await db.execute("DELETE FROM doctor_transfers WHERE earning_id IN (SELECT id FROM doctor_earnings WHERE estimate_id=$1)", existing["id"])
        await db.execute("DELETE FROM doctor_earnings WHERE estimate_id=$1", existing["id"])
        await db.execute("DELETE FROM cost_estimates WHERE id=$1", existing["id"])
    ref = existing["order_ref"] if existing else gen_ref("EST")
    # Look up categories/codes up front so we know whether an all-inclusive SBRT/SRS
    # package was selected — if so, only the package itself and the doctor's own
    # consultation fees (custom-fee codes) count toward the total; every other
    # selected service is already bundled into the package price.
    CUSTOM_FEE_CODES = ("QA-003","QA-004","QA-005")
    svc_rows = {}
    for item in body.items:
        svc = await db.fetchrow("SELECT price_egp,per_fraction,category,code FROM services WHERE id=$1", item.service_id)
        if not svc: raise HTTPException(404,f"Service {item.service_id} not found")
        svc_rows[item.service_id] = svc
    has_package = any(s["category"] == "SBRT/SRS Package" for s in svc_rows.values())

    total = 0.0; has_tbd = False
    items_data = []
    for item in body.items:
        svc = svc_rows[item.service_id]
        qty = item.quantity if svc["per_fraction"] else 1
        excluded = has_package and svc["category"] != "SBRT/SRS Package" and svc["code"] not in CUSTOM_FEE_CODES
        if svc["code"] in CUSTOM_FEE_CODES:
            if item.unit_price is not None and item.unit_price > 0:
                sub = float(item.unit_price)
                unit_price_egp = item.unit_price
                if not excluded: total += sub
            else:
                sub = None; unit_price_egp = svc["price_egp"]
                if not excluded: has_tbd = True
        elif svc["price_egp"] is not None:
            sub = float(svc["price_egp"]) * qty
            unit_price_egp = svc["price_egp"]
            if not excluded: total += sub
        else:
            sub = None; unit_price_egp = svc["price_egp"]
            if not excluded: has_tbd = True
        items_data.append((item.service_id, qty, unit_price_egp, sub))
    est = await db.fetchrow(
        "INSERT INTO cost_estimates(patient_id,doctor_id,total_egp,has_tbd,order_ref) VALUES($1,$2,$3,$4,$5) RETURNING id",
        body.patient_id, did, total, has_tbd, ref)
    eid = est["id"]
    for (sid, qty, up, sub) in items_data:
        await db.execute("INSERT INTO cost_estimate_items(estimate_id,service_id,quantity,unit_price_egp,subtotal_egp) VALUES($1,$2,$3,$4,$5)", eid, sid, qty, up, sub)
    # create billing record
    await db.execute("INSERT INTO billing(estimate_id,patient_id,total_amount_egp,balance_egp) VALUES($1,$2,$3,$4)", eid, body.patient_id, total, total)
    return {"id":eid,"order_ref":ref,"total_egp":total,"has_tbd":has_tbd}

@app.get("/api/estimates/{eid}")
async def get_estimate(eid: int, db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"]=="admin":
        e = await db.fetchrow("SELECT ce.*,p.full_name as patient_name,d.full_name as doctor_name,d.clinic_affiliation FROM cost_estimates ce JOIN patients p ON p.id=ce.patient_id JOIN doctors d ON d.id=ce.doctor_id WHERE ce.id=$1", eid)
    else:
        e = await db.fetchrow("SELECT ce.*,p.full_name as patient_name FROM cost_estimates ce JOIN patients p ON p.id=ce.patient_id WHERE ce.id=$1 AND ce.doctor_id=$2", eid, int(tok["sub"]))
    if not e: raise HTTPException(404)
    items = await db.fetch("SELECT i.*,s.name as service_name,s.code,s.unit,s.category,s.per_fraction FROM cost_estimate_items i JOIN services s ON s.id=i.service_id WHERE i.estimate_id=$1", eid)
    return {"estimate":dict(e),"items":[dict(i) for i in items]}

# ── milestones (admin) ────────────────────────────────────────────────────────
@app.patch("/api/patients/{pid}/milestones")
async def update_milestones(pid: int, body: MilestoneUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    updates = body.dict(exclude_none=True)
    fields, vals, idx = [], [], 1
    for f, v in updates.items():
        fields.append(f"{f}=${idx}"); vals.append(v); idx+=1
    if not fields: return {"ok":True}
    vals += [int(tok["sub"]), pid]
    await db.execute(f"UPDATE milestones SET {','.join(fields)},updated_by=${idx},updated_at=NOW() WHERE patient_id=${idx+1}", *vals)
    # Trigger notification if a "done" flag was newly set to true
    for milestone_key in ['simulation_done','planning_done','treatment_started','treatment_completed']:
        if updates.get(milestone_key) is True:
            await send_notification(db, pid, milestone_key)
    return {"ok":True}

# ── payments (admin) ──────────────────────────────────────────────────────────
async def _recalc_billing(db, billing_id):
    b = await db.fetchrow("SELECT * FROM billing WHERE id=$1", billing_id)
    if not b: return
    paid = await db.fetchval(
        "SELECT COALESCE(SUM(amount_egp),0) FROM payments WHERE billing_id=$1 AND status != 'cancelled'", billing_id)
    bal = round(float(b["total_amount_egp"]) - float(paid), 2)
    if bal <= 0:
        st = "paid"
        bal = 0
    elif float(paid) > 0:
        st = "partial"
    else:
        st = "unpaid"
    await db.execute("UPDATE billing SET amount_paid_egp=$1,balance_egp=$2,status=$3,updated_at=NOW() WHERE id=$4", paid, bal, st, billing_id)
    return bal

@app.post("/api/payments")
async def add_payment(body: PaymentCreate, db=Depends(get_db), tok=Depends(admin_only)):
    if body.method not in ("cash", "credit"):
        raise HTTPException(400, "method must be 'cash' or 'credit'")
    if body.method == "credit" and not (body.reference or "").strip():
        raise HTTPException(400, "reference (insurance / company name) is required for credit payments")
    b = await db.fetchrow("SELECT * FROM billing WHERE id=$1", body.billing_id)
    if not b: raise HTTPException(404)
    await db.execute(
        "INSERT INTO payments(billing_id,amount_egp,payment_date,method,reference,recorded_by,notes) VALUES($1,$2,$3,$4,$5,$6,$7)",
        body.billing_id, body.amount_egp, body.payment_date or date.today(), body.method, body.reference, int(tok["sub"]), body.notes)
    bal = await _recalc_billing(db, body.billing_id)
    return {"ok":True,"balance_egp":bal}

class PaymentEdit(BaseModel):
    amount_egp: Optional[float] = None
    status: Optional[str] = None

@app.patch("/api/payments/{pid}")
async def edit_payment(pid: int, body: PaymentEdit, db=Depends(get_db), tok=Depends(admin_only)):
    p = await db.fetchrow("SELECT * FROM payments WHERE id=$1", pid)
    if not p: raise HTTPException(404)
    if body.amount_egp is not None and body.amount_egp <= 0:
        raise HTTPException(400, "amount must be greater than 0")
    if body.status is not None and body.status not in ("confirmed", "pending", "cancelled"):
        raise HTTPException(400, "status must be 'confirmed', 'pending', or 'cancelled'")
    new_amount = body.amount_egp if body.amount_egp is not None else p["amount_egp"]
    new_status = body.status if body.status is not None else p["status"]
    await db.execute("UPDATE payments SET amount_egp=$1,status=$2 WHERE id=$3", new_amount, new_status, pid)
    bal = await _recalc_billing(db, p["billing_id"])
    return {"ok":True,"balance_egp":bal}

class DiscountUpdate(BaseModel):
    discount_egp: float
    reason: Optional[str] = None

@app.patch("/api/billing/{bid}/discount")
async def set_billing_discount(bid: int, body: DiscountUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    b = await db.fetchrow("SELECT * FROM billing WHERE id=$1", bid)
    if not b: raise HTTPException(404)
    gross_total = await db.fetchval("SELECT total_egp FROM cost_estimates WHERE id=$1", b["estimate_id"])
    consultation_total = await db.fetchval(
        """SELECT COALESCE(SUM(i.subtotal_egp),0) FROM cost_estimate_items i
           JOIN services s ON s.id=i.service_id
           WHERE i.estimate_id=$1 AND s.code IN ('QA-003','QA-004','QA-005')""", b["estimate_id"])
    discountable = round(float(gross_total) - float(consultation_total), 2)
    if body.discount_egp < 0:
        raise HTTPException(400, "Discount cannot be negative")
    if body.discount_egp > discountable:
        raise HTTPException(400, f"Discount cannot exceed {discountable:.2f} EGP — consultation fees are excluded from the discount")
    new_total = round(float(gross_total) - body.discount_egp, 2)
    new_balance = round(new_total - float(b["amount_paid_egp"]), 2)
    if new_balance <= 0:
        new_balance = 0; status = "paid"
    else:
        status = "partial" if float(b["amount_paid_egp"]) > 0 else "unpaid"
    await db.execute("""UPDATE billing SET total_amount_egp=$1,balance_egp=$2,status=$3,
        discount_egp=$4,discount_reason=$5,discount_by=$6,discount_at=NOW(),updated_at=NOW() WHERE id=$7""",
        new_total, new_balance, status, body.discount_egp, body.reason, int(tok["sub"]), bid)
    return {"ok": True, "total_amount_egp": new_total, "balance_egp": new_balance}

# ── dashboard ─────────────────────────────────────────────────────────────────
@app.get("/api/dashboard")
async def dashboard(db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"]=="admin":
        pts  = await db.fetchval("SELECT COUNT(*) FROM patients")
        sims = await db.fetchval("SELECT COUNT(*) FROM sim_orders")
        clns = await db.fetchval("SELECT COUNT(*) FROM clinical_orders")
        ests = await db.fetchval("SELECT COUNT(*) FROM cost_estimates")
        billed = await db.fetchval("SELECT COALESCE(SUM(total_amount_egp),0) FROM billing")
        paid   = await db.fetchval("SELECT COALESCE(SUM(amount_paid_egp),0) FROM billing")
        recent = await db.fetch("SELECT p.id,p.full_name,d.full_name as doctor,p.created_at FROM patients p JOIN doctors d ON d.id=p.doctor_id ORDER BY p.created_at DESC LIMIT 5")
        return {"total_patients":pts,"sim_orders":sims,"clinical_orders":clns,"cost_estimates":ests,
                "total_billed_egp":float(billed),"total_paid_egp":float(paid),"recent_patients":[dict(r) for r in recent]}
    else:
        did = int(tok["sub"])
        pts  = await db.fetchval("SELECT COUNT(*) FROM patients WHERE doctor_id=$1", did)
        sims = await db.fetchval("SELECT COUNT(*) FROM sim_orders WHERE doctor_id=$1", did)
        clns = await db.fetchval("SELECT COUNT(*) FROM clinical_orders WHERE doctor_id=$1", did)
        ests = await db.fetchval("SELECT COUNT(*) FROM cost_estimates WHERE doctor_id=$1", did)
        recent = await db.fetch("SELECT id,full_name,diagnosis,created_at FROM patients WHERE doctor_id=$1 ORDER BY created_at DESC LIMIT 5", did)
        return {"total_patients":pts,"sim_orders":sims,"clinical_orders":clns,"cost_estimates":ests,
                "recent_patients":[dict(r) for r in recent]}

# ── all orders list (admin) ───────────────────────────────────────────────────
@app.get("/api/orders")
async def all_orders(db=Depends(get_db), tok=Depends(admin_only)):
    sims = await db.fetch("SELECT s.id,'sim' as type,s.order_ref,s.status,s.created_at,s.patient_id,p.full_name as patient,d.full_name as doctor FROM sim_orders s JOIN patients p ON p.id=s.patient_id JOIN doctors d ON d.id=s.doctor_id ORDER BY s.created_at DESC")
    clns = await db.fetch("SELECT c.id,'clinical' as type,c.order_ref,c.status,c.created_at,c.patient_id,p.full_name as patient,d.full_name as doctor FROM clinical_orders c JOIN patients p ON p.id=c.patient_id JOIN doctors d ON d.id=c.doctor_id ORDER BY c.created_at DESC")
    ests = await db.fetch("SELECT e.id,'estimate' as type,e.order_ref,e.status,e.created_at,e.patient_id,p.full_name as patient,d.full_name as doctor FROM cost_estimates e JOIN patients p ON p.id=e.patient_id JOIN doctors d ON d.id=e.doctor_id ORDER BY e.created_at DESC")
    combined = sorted([dict(r) for r in list(sims)+list(clns)+list(ests)], key=lambda x: x["created_at"], reverse=True)
    return combined

# ── change password ───────────────────────────────────────────────────────────
class ChangePasswordReq(BaseModel):
    current_password: str
    new_password: str

@app.post("/api/auth/change-password")
async def change_password(body: ChangePasswordReq, db=Depends(get_db), tok=Depends(decode_token)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    table = ROLE_TABLE[tok["role"]]
    row = await db.fetchrow(f"SELECT id, password_hash FROM {table} WHERE id=$1", int(tok["sub"]))
    if not row:
        raise HTTPException(404, "User not found")
    if not bcrypt.checkpw(body.current_password.encode(), row["password_hash"].encode()):
        raise HTTPException(400, "Current password is incorrect")
    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.execute(f"UPDATE {table} SET password_hash=$1 WHERE id=$2", new_hash, int(tok["sub"]))
    return {"ok": True}

# ── update order status (admin) ───────────────────────────────────────────────
class StatusUpdate(BaseModel):
    status: str

@app.patch("/api/sim-orders/{oid}/status")
async def update_sim_status(oid: int, body: StatusUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    valid = ['pending','scheduled','done','cancelled']
    if body.status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid}")
    await db.execute("UPDATE sim_orders SET status=$1 WHERE id=$2", body.status, oid)
    return {"ok": True}

@app.patch("/api/clinical-orders/{oid}/status")
async def update_clinical_status(oid: int, body: StatusUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    valid = ['pending','in_progress','completed','cancelled']
    if body.status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid}")
    await db.execute("UPDATE clinical_orders SET status=$1 WHERE id=$2", body.status, oid)
    return {"ok": True}

@app.patch("/api/estimates/{eid}/status")
async def update_estimate_status(eid: int, body: StatusUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    valid = ['unpaid','partial','in_settlement','paid','cancelled']
    if body.status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid}")
    await db.execute("UPDATE cost_estimates SET status=$1 WHERE id=$2", body.status, eid)
    # sync billing status too
    await db.execute("UPDATE billing SET status=$1 WHERE estimate_id=$2", body.status, eid)
    return {"ok": True}

# ── update order status (admin) ───────────────────────────────────────────────
class StatusUpdate(BaseModel):
    status: str

# ── my orders (doctor) ────────────────────────────────────────────────────────
@app.get("/api/my-orders")
async def my_orders(db=Depends(get_db), tok=Depends(doctor_or_admin)):
    did = int(tok["sub"])
    # Patients where treatment has started — hide sim/clinical for those
    started_patients = set(r["patient_id"] for r in await db.fetch(
        "SELECT patient_id FROM milestones WHERE treatment_started=true AND patient_id IN (SELECT id FROM patients WHERE doctor_id=$1)", did))
    # Latest sim per patient only
    sims = await db.fetch("""
        SELECT DISTINCT ON (s.patient_id) s.id,'sim' as type,s.order_ref,s.status,s.created_at,s.patient_id,p.full_name as patient
        FROM sim_orders s JOIN patients p ON p.id=s.patient_id
        WHERE s.doctor_id=$1 ORDER BY s.patient_id, s.created_at DESC
    """, did)
    # Latest clinical per patient only
    clns = await db.fetch("""
        SELECT DISTINCT ON (c.patient_id) c.id,'clinical' as type,c.order_ref,c.status,c.created_at,c.patient_id,p.full_name as patient
        FROM clinical_orders c JOIN patients p ON p.id=c.patient_id
        WHERE c.doctor_id=$1 ORDER BY c.patient_id, c.created_at DESC
    """, did)
    # Latest estimate per patient only
    ests = await db.fetch("""
        SELECT DISTINCT ON (e.patient_id) e.id,'estimate' as type,e.order_ref,e.status,e.created_at,e.patient_id,p.full_name as patient
        FROM cost_estimates e JOIN patients p ON p.id=e.patient_id
        WHERE e.doctor_id=$1 ORDER BY e.patient_id, e.created_at DESC
    """, did)
    filtered = (
        [dict(r) for r in sims if r["patient_id"] not in started_patients] +
        [dict(r) for r in clns if r["patient_id"] not in started_patients] +
        [dict(r) for r in ests]
    )
    combined = sorted(filtered, key=lambda x: x["created_at"], reverse=True)
    return combined

# ── admin cleanup: remove duplicate orders keeping only latest per patient ────
@app.post("/api/admin/cleanup-duplicates")
async def cleanup_duplicates(db=Depends(get_db), tok=Depends(admin_only)):
    # Keep only the latest sim order per patient
    await db.execute("""
        DELETE FROM sim_orders WHERE id NOT IN (
            SELECT DISTINCT ON (patient_id) id FROM sim_orders ORDER BY patient_id, created_at DESC
        )
    """)
    # Keep only the latest clinical order per patient
    await db.execute("""
        DELETE FROM clinical_orders WHERE id NOT IN (
            SELECT DISTINCT ON (patient_id) id FROM clinical_orders ORDER BY patient_id, created_at DESC
        )
    """)
    # Keep only the latest estimate per patient (cascade deletes items/billing/payments)
    dup_estimates = await db.fetch("""
        SELECT id FROM cost_estimates WHERE id NOT IN (
            SELECT DISTINCT ON (patient_id) id FROM cost_estimates ORDER BY patient_id, created_at DESC
        )
    """)
    for row in dup_estimates:
        eid = row["id"]
        await db.execute("DELETE FROM payments WHERE billing_id IN (SELECT id FROM billing WHERE estimate_id=$1)", eid)
        await db.execute("DELETE FROM billing WHERE estimate_id=$1", eid)
        await db.execute("DELETE FROM doctor_transfers WHERE earning_id IN (SELECT id FROM doctor_earnings WHERE estimate_id=$1)", eid)
        await db.execute("DELETE FROM doctor_earnings WHERE estimate_id=$1", eid)
        await db.execute("DELETE FROM cost_estimate_items WHERE estimate_id=$1", eid)
        await db.execute("DELETE FROM cost_estimates WHERE id=$1", eid)
    return {"ok": True, "cleaned": len(dup_estimates)}

# ── notifications: email (live) + whatsapp (stub until center account ready) ──
import smtplib
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "ACMC Portal")

MILESTONE_LABELS = {
    'simulation_done':      'CT Simulation completed',
    'planning_done':        'Treatment Planning completed',
    'treatment_started':    'Treatment has started',
    'treatment_completed':  'Treatment completed',
}

def _send_email_sync(to_email: str, subject: str, body: str):
    if not SMTP_USER or not SMTP_PASS:
        print(f"[notify] SMTP not configured — skipping email to {to_email}")
        return False
    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg['To'] = to_email
    try:
        # Try STARTTLS on port 587 first (DigitalOcean blocks 465)
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as s:
            s.ehlo()
            s.starttls()
            s.ehlo()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_USER, [to_email], msg.as_string())
        print(f"[notify] Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[notify] Email send failed: {e}")
        return False

async def send_notification(db, patient_id: int, milestone: str):
    """
    milestone: 'simulation_done' | 'planning_done' | 'treatment_started' | 'treatment_completed'
    """
    label = MILESTONE_LABELS.get(milestone, milestone)
    patient = await db.fetchrow(
        "SELECT p.full_name, d.full_name as doctor_name, d.email as doctor_email, d.phone as doctor_phone "
        "FROM patients p JOIN doctors d ON d.id=p.doctor_id WHERE p.id=$1", patient_id)
    if not patient:
        return

    subject = f"ACMC Update — {patient['full_name']}"
    body = (
        f"Dear Dr. {patient['doctor_name']},\n\n"
        f"This is an automated update from the ACMC Referring Physician Portal.\n\n"
        f"Patient: {patient['full_name']}\n"
        f"Status update: {label}\n\n"
        f"Log in to the portal for full details: https://acmc-portal.duckdns.org\n\n"
        f"— ACMC Portal"
    )
    if patient['doctor_email']:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_email_sync, patient['doctor_email'], subject, body)

    # WhatsApp via Twilio
    twilio_sid = os.getenv("TWILIO_SID", "")
    twilio_token = os.getenv("TWILIO_TOKEN", "")
    twilio_from = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    doctor_phone = patient.get("doctor_phone", "")
    if twilio_sid and twilio_token and doctor_phone:
        try:
            from twilio.rest import Client as TwilioClient
            # Normalize Egyptian number
            phone = doctor_phone.strip()
            if phone.startswith("00"):
                phone = "+" + phone[2:]
            elif phone.startswith("0"):
                phone = "+20" + phone[1:]
            elif not phone.startswith("+"):
                phone = "+" + phone
            wa_body = (
                f"*ACMC Portal Update*\n\n"
                f"Dear Dr. {patient['doctor_name']},\n"
                f"Patient: *{patient['full_name']}*\n"
                f"Status: *{label}*\n\n"
                f"Login: https://acmc-portal.duckdns.org"
            )
            tc = TwilioClient(twilio_sid, twilio_token)
            tc.messages.create(from_=twilio_from, to=f"whatsapp:{phone}", body=wa_body)
            print(f"[notify] WhatsApp sent to {phone}")
        except Exception as e:
            print(f"[notify] WhatsApp send failed: {e}")

# ── manual test endpoint for notifications ─────────────────────────────────────
class NotifyTestReq(BaseModel):
    patient_id: int
    milestone: str  # simulation_done | planning_done | treatment_started | treatment_completed

@app.post("/api/notify/test")
async def notify_test(body: NotifyTestReq, db=Depends(get_db), tok=Depends(admin_only)):
    patient = await db.fetchrow(
        "SELECT p.full_name, d.full_name as doctor_name, d.email as doctor_email, d.phone as doctor_phone "
        "FROM patients p JOIN doctors d ON d.id=p.doctor_id WHERE p.id=$1", body.patient_id)
    await send_notification(db, body.patient_id, body.milestone)
    return {"ok": True,
            "sending_to_email": patient["doctor_email"] if patient else "unknown",
            "sending_to_phone": patient["doctor_phone"] if patient else "unknown",
            "message": "Notification sent — check server logs for details"}



# ── portal settings (workers bonus %) ──────────────────────────────────────────
class SettingUpdate(BaseModel):
    value: str

@app.get("/api/settings/{key}")
async def get_setting(key: str, db=Depends(get_db), tok=Depends(decode_token)):
    row = await db.fetchrow("SELECT value FROM portal_settings WHERE key=$1", key)
    return {"key": key, "value": row["value"] if row else None}

@app.patch("/api/settings/{key}")
async def update_setting(key: str, body: SettingUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    await db.execute(
        "INSERT INTO portal_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",
        key, body.value)
    return {"ok": True}

# ── doctor earnings ────────────────────────────────────────────────────────────

class DoctorFeeUpdate(BaseModel):
    referral_fee_pct: float

class EarningCreate(BaseModel):
    estimate_id: int
    doctor_fees_egp: Optional[float] = 0

class TransferCreate(BaseModel):
    earning_id: int
    amount_egp: float
    transfer_date: Optional[date] = None
    method: str
    reference: Optional[str] = None
    notes: Optional[str] = None

@app.patch("/api/doctors/{did}/fee")
async def set_doctor_fee(did: int, body: DoctorFeeUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    await db.execute("UPDATE doctors SET referral_fee_pct=$1 WHERE id=$2", body.referral_fee_pct, did)
    return {"ok": True}

@app.post("/api/earnings")
async def create_earning(body: EarningCreate, db=Depends(get_db), tok=Depends(admin_only)):
    est = await db.fetchrow(
        "SELECT ce.*, d.referral_fee_pct FROM cost_estimates ce JOIN doctors d ON d.id=ce.doctor_id WHERE ce.id=$1",
        body.estimate_id)
    if not est: raise HTTPException(404, "Estimate not found")
    billing_status = await db.fetchval("SELECT status FROM billing WHERE estimate_id=$1", body.estimate_id)
    if billing_status != "paid":
        raise HTTPException(400, "Earnings can only be calculated once the patient's bill is fully paid")
    total = float(est["total_egp"] or 0)
    pct = float(est["referral_fee_pct"] or 0)
    ref_amount = round(total * pct / 100, 2)
    doc_fees = float(body.doctor_fees_egp or 0)
    bonus_setting = await db.fetchrow("SELECT value FROM portal_settings WHERE key='workers_bonus_pct'")
    bonus_pct = float(bonus_setting["value"]) if bonus_setting else 5.0
    workers_bonus = round(ref_amount * bonus_pct / 100, 2)
    total_due = round(ref_amount + doc_fees - workers_bonus, 2)
    month = datetime.now().strftime("%Y-%m")
    existing = await db.fetchrow("SELECT id FROM doctor_earnings WHERE estimate_id=$1", body.estimate_id)
    if existing:
        await db.execute("""UPDATE doctor_earnings SET referral_pct=$1,referral_amount_egp=$2,
            doctor_fees_egp=$3,workers_bonus_pct=$4,workers_bonus_egp=$5,total_due_egp=$6,balance_egp=$6,
            total_billed_egp=$7,updated_at=NOW() WHERE estimate_id=$8""",
            pct, ref_amount, doc_fees, bonus_pct, workers_bonus, total_due, total, body.estimate_id)
        return {"id": existing["id"], "total_due_egp": total_due, "workers_bonus_egp": workers_bonus}
    r = await db.fetchrow("""INSERT INTO doctor_earnings
        (doctor_id,patient_id,estimate_id,total_billed_egp,referral_pct,referral_amount_egp,
         doctor_fees_egp,workers_bonus_pct,workers_bonus_egp,total_due_egp,balance_egp,month)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11) RETURNING id""",
        est["doctor_id"], est["patient_id"], body.estimate_id, total, pct,
        ref_amount, doc_fees, bonus_pct, workers_bonus, total_due, month)
    return {"id": r["id"], "total_due_egp": total_due, "workers_bonus_egp": workers_bonus}

@app.get("/api/earnings")
async def list_earnings(db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"] == "admin":
        rows = await db.fetch("""
            SELECT de.*,p.full_name as patient_name,d.full_name as doctor_name
            FROM doctor_earnings de
            JOIN patients p ON p.id=de.patient_id
            JOIN doctors d ON d.id=de.doctor_id
            ORDER BY de.created_at DESC""")
    else:
        rows = await db.fetch("""
            SELECT de.*,p.full_name as patient_name
            FROM doctor_earnings de
            JOIN patients p ON p.id=de.patient_id
            WHERE de.doctor_id=$1
            ORDER BY de.created_at DESC""", int(tok["sub"]))
    return [dict(r) for r in rows]

@app.get("/api/earnings/summary")
async def earnings_summary(db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"] == "admin":
        # Per doctor summary
        rows = await db.fetch("""
            SELECT d.id,d.full_name,d.referral_fee_pct,
                COUNT(de.id) as patient_count,
                COALESCE(SUM(de.total_due_egp),0) as total_due,
                COALESCE(SUM(de.transferred_egp),0) as total_transferred,
                COALESCE(SUM(de.balance_egp),0) as total_balance
            FROM doctors d
            LEFT JOIN doctor_earnings de ON de.doctor_id=d.id
            WHERE d.is_active=true
            GROUP BY d.id,d.full_name,d.referral_fee_pct
            ORDER BY d.full_name""")
        return [dict(r) for r in rows]
    else:
        did = int(tok["sub"])
        total = await db.fetchrow("""
            SELECT COALESCE(SUM(total_due_egp),0) as total_due,
                   COALESCE(SUM(transferred_egp),0) as transferred,
                   COALESCE(SUM(balance_egp),0) as balance,
                   COUNT(*) as patient_count
            FROM doctor_earnings WHERE doctor_id=$1""", did)
        monthly = await db.fetch("""
            SELECT month,
                   COALESCE(SUM(total_due_egp),0) as due,
                   COALESCE(SUM(transferred_egp),0) as transferred,
                   COALESCE(SUM(balance_egp),0) as balance,
                   COUNT(*) as patients
            FROM doctor_earnings WHERE doctor_id=$1
            GROUP BY month ORDER BY month DESC LIMIT 12""", did)
        return {"summary": dict(total), "monthly": [dict(r) for r in monthly]}

@app.post("/api/transfers")
async def add_transfer(body: TransferCreate, db=Depends(get_db), tok=Depends(admin_only)):
    earning = await db.fetchrow("SELECT * FROM doctor_earnings WHERE id=$1", body.earning_id)
    if not earning: raise HTTPException(404)
    await db.execute("""INSERT INTO doctor_transfers
        (doctor_id,earning_id,amount_egp,transfer_date,method,reference,recorded_by,notes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)""",
        earning["doctor_id"], body.earning_id, body.amount_egp,
        body.transfer_date or date.today(), body.method, body.reference,
        int(tok["sub"]), body.notes)
    transferred = await db.fetchval(
        "SELECT COALESCE(SUM(amount_egp),0) FROM doctor_transfers WHERE earning_id=$1", body.earning_id)
    balance = round(float(earning["total_due_egp"]) - float(transferred), 2)
    status = "transferred" if balance <= 0 else ("partial" if transferred > 0 else "pending")
    await db.execute("""UPDATE doctor_earnings SET transferred_egp=$1,balance_egp=$2,
        status=$3,updated_at=NOW() WHERE id=$4""", transferred, balance, status, body.earning_id)
    return {"ok": True, "balance_egp": balance}

# ── DB migration on startup (adds new tables if not exist) ────────────────────
@app.on_event("startup")
async def startup_migrate():
    conn = await asyncpg.connect(DB_URL)
    try:
        await conn.execute("""
            ALTER TABLE doctors ADD COLUMN IF NOT EXISTS referral_fee_pct NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE doctors ALTER COLUMN referral_fee_pct SET DEFAULT 30;
            UPDATE doctors SET referral_fee_pct=30 WHERE referral_fee_pct=0;
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed';
            ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_egp NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_reason TEXT;
            ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_by INTEGER REFERENCES admins(id);
            ALTER TABLE billing ADD COLUMN IF NOT EXISTS discount_at TIMESTAMP;
            UPDATE services SET name='Initial + Follow-up Consultation (Oncologist)',
                notes='Covers both the initial consultation and follow-up review as one combined doctor fee.'
                WHERE code='QA-003';
            UPDATE services SET is_active=false WHERE code='QA-004';
            CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(doctor_id);
            CREATE INDEX IF NOT EXISTS idx_sim_orders_patient ON sim_orders(patient_id);
            CREATE INDEX IF NOT EXISTS idx_sim_orders_doctor ON sim_orders(doctor_id);
            CREATE INDEX IF NOT EXISTS idx_clinical_orders_patient ON clinical_orders(patient_id);
            CREATE INDEX IF NOT EXISTS idx_clinical_orders_doctor ON clinical_orders(doctor_id);
            CREATE INDEX IF NOT EXISTS idx_cost_estimates_patient ON cost_estimates(patient_id);
            CREATE INDEX IF NOT EXISTS idx_cost_estimates_doctor ON cost_estimates(doctor_id);
            CREATE INDEX IF NOT EXISTS idx_milestones_patient ON milestones(patient_id);
            CREATE INDEX IF NOT EXISTS idx_billing_patient ON billing(patient_id);
            CREATE INDEX IF NOT EXISTS idx_payments_billing ON payments(billing_id);
            CREATE INDEX IF NOT EXISTS idx_doctor_earnings_doctor ON doctor_earnings(doctor_id);
            CREATE TABLE IF NOT EXISTS portal_settings (
                key VARCHAR(50) PRIMARY KEY,
                value VARCHAR(100)
            );
            INSERT INTO portal_settings (key, value) VALUES ('workers_bonus_pct','5')
            ON CONFLICT (key) DO NOTHING;
            CREATE TABLE IF NOT EXISTS doctor_earnings (
                id SERIAL PRIMARY KEY,
                doctor_id INTEGER REFERENCES doctors(id),
                patient_id INTEGER REFERENCES patients(id),
                estimate_id INTEGER REFERENCES cost_estimates(id),
                total_billed_egp NUMERIC(12,2),
                referral_pct NUMERIC(5,2),
                referral_amount_egp NUMERIC(12,2),
                doctor_fees_egp NUMERIC(12,2) DEFAULT 0,
                workers_bonus_pct NUMERIC(5,2) DEFAULT 0,
                workers_bonus_egp NUMERIC(12,2) DEFAULT 0,
                total_due_egp NUMERIC(12,2),
                transferred_egp NUMERIC(12,2) DEFAULT 0,
                balance_egp NUMERIC(12,2),
                status VARCHAR(20) DEFAULT 'pending',
                month VARCHAR(7),
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            ALTER TABLE doctor_earnings ADD COLUMN IF NOT EXISTS workers_bonus_pct NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE doctor_earnings ADD COLUMN IF NOT EXISTS workers_bonus_egp NUMERIC(12,2) DEFAULT 0;
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
        """)
    finally:
        await conn.close()

# ── all estimates list for earnings calculator (admin) ────────────────────────
@app.get("/api/estimates-list")
async def estimates_list(db=Depends(get_db), tok=Depends(admin_only)):
    rows = await db.fetch("""
        SELECT ce.id, ce.order_ref, ce.total_egp, ce.has_tbd, ce.doctor_id,
               p.full_name as patient_name, d.full_name as doctor_name,
               b.status as billing_status,
               (SELECT COALESCE(SUM(i.subtotal_egp),0) FROM cost_estimate_items i
                JOIN services s ON s.id=i.service_id
                WHERE i.estimate_id=ce.id AND s.code IN ('QA-003','QA-004','QA-005')) as consultation_total_egp
        FROM cost_estimates ce
        JOIN patients p ON p.id=ce.patient_id
        JOIN doctors d ON d.id=ce.doctor_id
        LEFT JOIN billing b ON b.estimate_id=ce.id
        ORDER BY ce.created_at DESC
    """)
    return [dict(r) for r in rows]

# ── performance indexes (created on startup if not exist) ─────────────────────
# These are added inside the startup_migrate function above

# ── planning tracker (admin dashboard — single query, no N+1) ─────────────────
@app.get("/api/planning-tracker")
async def planning_tracker(db=Depends(get_db), tok=Depends(admin_only)):
    rows = await db.fetch("""
        SELECT p.id as patient_id, p.full_name as name, d.full_name as doctor,
               m.planning_done, m.planning_date,
               m.treatment_started, m.treatment_start_date,
               m.treatment_completed, m.treatment_end_date
        FROM milestones m
        JOIN patients p ON p.id=m.patient_id
        JOIN doctors d ON d.id=p.doctor_id
        WHERE m.planning_done=true OR m.treatment_started=true
        ORDER BY m.updated_at DESC
        LIMIT 50
    """)
    return [dict(r) for r in rows]
