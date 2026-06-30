from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import asyncpg, jwt, bcrypt, os, random, string
from datetime import datetime, date, timedelta

app = FastAPI(title="ACMC Radiotherapy Portal")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB_URL = os.getenv("DATABASE_URL", "postgresql://acmc:acmc_pass@db:5432/acmc")
SECRET  = os.getenv("JWT_SECRET", "change_this_in_production")
bearer  = HTTPBearer()

# ── helpers ───────────────────────────────────────────────────────────────────
def gen_ref(prefix):
    return f"{prefix}-{datetime.now().year}-{''.join(random.choices(string.digits,k=4))}"

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

# ── models ────────────────────────────────────────────────────────────────────
class LoginReq(BaseModel):
    email: str; password: str

class DoctorCreate(BaseModel):
    full_name: str; email: EmailStr; phone: Optional[str]=None
    specialty: Optional[str]=None; clinic_affiliation: Optional[str]=None; password: str

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
    service_id: int; quantity: int=1

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
    raise HTTPException(401, "Invalid credentials")

@app.get("/api/auth/me")
async def me(tok=Depends(decode_token), db=Depends(get_db)):
    if tok["role"]=="admin":
        r = await db.fetchrow("SELECT id,full_name,email FROM admins WHERE id=$1", int(tok["sub"]))
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
    sims = await db.fetch("SELECT id,order_ref,status,sim_date_requested,created_at FROM sim_orders WHERE patient_id=$1 ORDER BY created_at DESC", pid)
    clins = await db.fetch("SELECT id,order_ref,status,technique,total_dose_gy,fractions,created_at FROM clinical_orders WHERE patient_id=$1 ORDER BY created_at DESC", pid)
    ests = await db.fetch("SELECT id,order_ref,status,total_egp,has_tbd,created_at FROM cost_estimates WHERE patient_id=$1 ORDER BY created_at DESC", pid)
    miles = await db.fetchrow("SELECT * FROM milestones WHERE patient_id=$1", pid)
    billing = await db.fetchrow("SELECT b.*,ce.order_ref as estimate_ref FROM billing b JOIN cost_estimates ce ON ce.id=b.estimate_id WHERE b.patient_id=$1 ORDER BY b.created_at DESC LIMIT 1", pid)
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
    if tok["role"]=="admin":
        r = await db.fetchrow("SELECT s.*,p.full_name as patient_name,d.full_name as doctor_name,d.clinic_affiliation FROM sim_orders s JOIN patients p ON p.id=s.patient_id JOIN doctors d ON d.id=s.doctor_id WHERE s.id=$1", oid)
    else:
        r = await db.fetchrow("SELECT s.*,p.full_name as patient_name FROM sim_orders s JOIN patients p ON p.id=s.patient_id WHERE s.id=$1 AND s.doctor_id=$2", oid, int(tok["sub"]))
    if not r: raise HTTPException(404)
    return dict(r)

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
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'submitted',$17) RETURNING id""",
        body.patient_id, did, body.clinical_history, body.total_dose_gy, body.fractions,
        body.duration_weeks, body.dose_per_fraction_gy, body.technique, body.treatment_site,
        body.sgrt, body.dibh, body.igrt, body.intent, body.sequence,
        body.special_instructions, body.notes_to_team, body.prescription_text, ref)
    return {"id":r["id"],"order_ref":ref,"updated":False}

@app.get("/api/clinical-orders/{oid}")
async def get_clinical(oid: int, db=Depends(get_db), tok=Depends(decode_token)):
    if tok["role"]=="admin":
        r = await db.fetchrow("SELECT c.*,p.full_name as patient_name,p.date_of_birth,p.gender,d.full_name as doctor_name,d.clinic_affiliation FROM clinical_orders c JOIN patients p ON p.id=c.patient_id JOIN doctors d ON d.id=c.doctor_id WHERE c.id=$1", oid)
    else:
        r = await db.fetchrow("SELECT c.*,p.full_name as patient_name,p.date_of_birth,p.gender FROM clinical_orders c JOIN patients p ON p.id=c.patient_id WHERE c.id=$1 AND c.doctor_id=$2", oid, int(tok["sub"]))
    if not r: raise HTTPException(404)
    return dict(r)

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
        await db.execute("DELETE FROM cost_estimates WHERE id=$1", existing["id"])
    ref = existing["order_ref"] if existing else gen_ref("EST")
    total = 0.0; has_tbd = False
    items_data = []
    for item in body.items:
        svc = await db.fetchrow("SELECT price_egp,per_fraction FROM services WHERE id=$1", item.service_id)
        if not svc: raise HTTPException(404,f"Service {item.service_id} not found")
        qty = item.quantity if svc["per_fraction"] else 1
        if svc["price_egp"] is not None:
            sub = float(svc["price_egp"]) * qty
            total += sub
        else:
            sub = None; has_tbd = True
        items_data.append((item.service_id, qty, svc["price_egp"], sub))
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
    fields, vals, idx = [], [], 1
    for f, v in body.dict(exclude_none=True).items():
        fields.append(f"{f}=${idx}"); vals.append(v); idx+=1
    if not fields: return {"ok":True}
    vals += [int(tok["sub"]), pid]
    await db.execute(f"UPDATE milestones SET {','.join(fields)},updated_by=${idx},updated_at=NOW() WHERE patient_id=${idx+1}", *vals)
    return {"ok":True}

# ── payments (admin) ──────────────────────────────────────────────────────────
@app.post("/api/payments")
async def add_payment(body: PaymentCreate, db=Depends(get_db), tok=Depends(admin_only)):
    b = await db.fetchrow("SELECT * FROM billing WHERE id=$1", body.billing_id)
    if not b: raise HTTPException(404)
    await db.execute(
        "INSERT INTO payments(billing_id,amount_egp,payment_date,method,reference,recorded_by,notes) VALUES($1,$2,$3,$4,$5,$6,$7)",
        body.billing_id, body.amount_egp, body.payment_date or date.today(), body.method, body.reference, int(tok["sub"]), body.notes)
    paid = await db.fetchval("SELECT COALESCE(SUM(amount_egp),0) FROM payments WHERE billing_id=$1", body.billing_id)
    bal = round(float(b["total_amount_egp"]) - float(paid), 2)
    if bal <= 0:
        st = "paid"
        bal = 0
    elif float(paid) > 0:
        st = "partial"
    else:
        st = "unpaid"
    await db.execute("UPDATE billing SET amount_paid_egp=$1,balance_egp=$2,status=$3,updated_at=NOW() WHERE id=$4", paid, bal, st, body.billing_id)
    return {"ok":True,"balance_egp":bal}

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
        recent = await db.fetch("SELECT p.full_name,d.full_name as doctor,p.created_at FROM patients p JOIN doctors d ON d.id=p.doctor_id ORDER BY p.created_at DESC LIMIT 5")
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
    if tok["role"] == "admin":
        row = await db.fetchrow("SELECT id, password_hash FROM admins WHERE id=$1", int(tok["sub"]))
    else:
        row = await db.fetchrow("SELECT id, password_hash FROM doctors WHERE id=$1", int(tok["sub"]))
    if not row:
        raise HTTPException(404, "User not found")
    if not bcrypt.checkpw(body.current_password.encode(), row["password_hash"].encode()):
        raise HTTPException(400, "Current password is incorrect")
    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    if tok["role"] == "admin":
        await db.execute("UPDATE admins SET password_hash=$1 WHERE id=$2", new_hash, int(tok["sub"]))
    else:
        await db.execute("UPDATE doctors SET password_hash=$1 WHERE id=$2", new_hash, int(tok["sub"]))
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

@app.patch("/api/sim-orders/{oid}/status")
async def update_sim_status(oid: int, body: StatusUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    valid = ['pending','scheduled','done','cancelled']
    if body.status not in valid:
        raise HTTPException(400, f"Status must be one of: {valid}")
    await db.execute("UPDATE sim_orders SET status=$1 WHERE id=$2", body.status, oid)
    return {"ok": True}

# Clinical orders are doctor-only — no admin status update

@app.patch("/api/estimates/{eid}/status")
async def update_estimate_status(eid: int, body: StatusUpdate, db=Depends(get_db), tok=Depends(admin_only)):
    valid = ['pending','in_settlement','paid','cancelled']
    if body.status not in valid:
        raise HTTPException(400, f"Status must be one of: {valid}")
    await db.execute("UPDATE cost_estimates SET status=$1 WHERE id=$2", body.status, eid)
    # sync billing status too
    if body.status == 'paid':
        await db.execute("UPDATE billing SET status='paid' WHERE estimate_id=$1", eid)
    elif body.status == 'in_settlement':
        await db.execute("UPDATE billing SET status='partial' WHERE estimate_id=$1", eid)
    return {"ok": True}

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
        await db.execute("DELETE FROM cost_estimate_items WHERE estimate_id=$1", eid)
        await db.execute("DELETE FROM cost_estimates WHERE id=$1", eid)
    return {"ok": True, "cleaned": len(dup_estimates)}

# ── notification stubs (email + whatsapp — configure when center accounts ready) ──
async def send_notification(db, patient_id: int, milestone: str):
    """
    Stub — wire up when center email (SMTP) and WhatsApp Business API are ready.
    milestone: 'simulation_done' | 'planning_done' | 'treatment_started' | 'treatment_completed'
    """
    MILESTONE_LABELS = {
        'simulation_done':      'CT Simulation completed',
        'planning_done':        'Treatment Planning completed',
        'treatment_started':    'Treatment has started',
        'treatment_completed':  'Treatment completed',
    }
    label = MILESTONE_LABELS.get(milestone, milestone)
    patient = await db.fetchrow(
        "SELECT p.full_name, d.full_name as doctor_name, d.email as doctor_email, d.phone as doctor_phone "
        "FROM patients p JOIN doctors d ON d.id=p.doctor_id WHERE p.id=$1", patient_id)
    if not patient:
        return
    # TODO: Email — configure SMTP when center email is ready
    # import smtplib; from email.mime.text import MIMEText
    # msg = MIMEText(f"Dear Dr. {patient['doctor_name']},\n\nYour patient {patient['full_name']}: {label}.\n\nACMC Portal")
    # with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
    #     s.login(SMTP_USER, SMTP_PASS)
    #     s.sendmail(SMTP_USER, patient['doctor_email'], msg.as_string())

    # TODO: WhatsApp — configure Twilio when WhatsApp Business account is ready
    # from twilio.rest import Client
    # client = Client(TWILIO_SID, TWILIO_TOKEN)
    # client.messages.create(
    #     from_='whatsapp:+14155238886',
    #     to=f"whatsapp:{patient['doctor_phone']}",
    #     body=f"ACMC: Your patient {patient['full_name']} — {label}."
    # )
    pass



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
    conn = await asyncpg.connect(os.getenv("DATABASE_URL","postgresql://acmc:acmc_pass@db:5432/acmc"))
    try:
        await conn.execute("""
            ALTER TABLE doctors ADD COLUMN IF NOT EXISTS referral_fee_pct NUMERIC(5,2) DEFAULT 0;
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
               p.full_name as patient_name, d.full_name as doctor_name
        FROM cost_estimates ce
        JOIN patients p ON p.id=ce.patient_id
        JOIN doctors d ON d.id=ce.doctor_id
        ORDER BY ce.created_at DESC
    """)
    return [dict(r) for r in rows]
