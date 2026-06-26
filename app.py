from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import asyncpg, jwt, bcrypt, os
from datetime import datetime, date, timedelta

app = FastAPI(title="ACMC Radiotherapy Portal")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB_URL = os.getenv("DATABASE_URL", "postgresql://acmc:acmc_pass@db:5432/acmc")
SECRET = os.getenv("JWT_SECRET", "change_this_secret_in_production")
bearer = HTTPBearer()

# ── DB pool ──────────────────────────────────────────────────────────────────

async def get_db():
    conn = await asyncpg.connect(DB_URL)
    try:
        yield conn
    finally:
        await conn.close()

# ── Auth ─────────────────────────────────────────────────────────────────────

def make_token(sub: str, role: str):
    return jwt.encode({"sub": sub, "role": role, "exp": datetime.utcnow() + timedelta(days=7)}, SECRET, algorithm="HS256")

def decode_token(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        return jwt.decode(creds.credentials, SECRET, algorithms=["HS256"])
    except:
        raise HTTPException(401, "Invalid or expired token")

def require_doctor(token=Depends(decode_token)):
    if token["role"] not in ("doctor", "admin"):
        raise HTTPException(403, "Doctors only")
    return token

def require_admin(token=Depends(decode_token)):
    if token["role"] != "admin":
        raise HTTPException(403, "Admins only")
    return token

# ── Models ───────────────────────────────────────────────────────────────────

class LoginReq(BaseModel):
    email: str
    password: str

class DoctorCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str]
    specialty: Optional[str]
    clinic_affiliation: Optional[str]
    password: str

class PatientCreate(BaseModel):
    full_name: str
    date_of_birth: Optional[date]
    gender: Optional[str]
    national_id: Optional[str]
    phone: Optional[str]
    diagnosis: Optional[str]
    icd10_code: Optional[str]

class OrderItem(BaseModel):
    service_id: int
    quantity: int = 1

class OrderCreate(BaseModel):
    patient_id: int
    treatment_site: Optional[str]
    total_fractions: Optional[int]
    total_dose_gy: Optional[float]
    dose_per_fraction_gy: Optional[float]
    notes_to_admin: Optional[str]
    simulation_date_requested: Optional[date]
    items: List[OrderItem]

class MilestoneUpdate(BaseModel):
    milestone: str
    done: bool
    done_date: Optional[date]
    notes: Optional[str]

class PaymentCreate(BaseModel):
    billing_id: int
    amount_egp: float
    payment_date: Optional[date]
    method: str
    reference: Optional[str]
    notes: Optional[str]

class ServicePriceUpdate(BaseModel):
    price_egp: float

# ── Auth Endpoints ────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
async def login(req: LoginReq, db=Depends(get_db)):
    # try admin first
    row = await db.fetchrow("SELECT id, password_hash FROM admins WHERE email=$1 AND is_active=true", req.email)
    if row and bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        return {"token": make_token(str(row["id"]), "admin"), "role": "admin"}
    # try doctor
    row = await db.fetchrow("SELECT id, password_hash FROM doctors WHERE email=$1 AND is_active=true", req.email)
    if row and bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        return {"token": make_token(str(row["id"]), "doctor"), "role": "doctor"}
    raise HTTPException(401, "Invalid credentials")

@app.get("/api/auth/me")
async def me(token=Depends(decode_token), db=Depends(get_db)):
    if token["role"] == "admin":
        row = await db.fetchrow("SELECT id, full_name, email FROM admins WHERE id=$1", int(token["sub"]))
    else:
        row = await db.fetchrow("SELECT id, full_name, email, specialty, clinic_affiliation FROM doctors WHERE id=$1", int(token["sub"]))
    return dict(row) | {"role": token["role"]}

# ── Services ──────────────────────────────────────────────────────────────────

@app.get("/api/services")
async def list_services(db=Depends(get_db), token=Depends(decode_token)):
    rows = await db.fetch("SELECT * FROM services WHERE is_active=true ORDER BY category, code")
    return [dict(r) for r in rows]

@app.patch("/api/services/{service_id}/price")
async def update_price(service_id: int, body: ServicePriceUpdate, db=Depends(get_db), token=Depends(require_admin)):
    await db.execute("UPDATE services SET price_egp=$1 WHERE id=$2", body.price_egp, service_id)
    return {"ok": True}

# ── Doctors (admin) ───────────────────────────────────────────────────────────

@app.get("/api/doctors")
async def list_doctors(db=Depends(get_db), token=Depends(require_admin)):
    rows = await db.fetch("SELECT id, full_name, email, phone, specialty, clinic_affiliation, is_active, created_at FROM doctors ORDER BY full_name")
    return [dict(r) for r in rows]

@app.post("/api/doctors")
async def create_doctor(body: DoctorCreate, db=Depends(get_db), token=Depends(require_admin)):
    pw = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    row = await db.fetchrow(
        "INSERT INTO doctors (full_name, email, phone, specialty, clinic_affiliation, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        body.full_name, body.email, body.phone, body.specialty, body.clinic_affiliation, pw
    )
    return {"id": row["id"]}

@app.patch("/api/doctors/{doctor_id}/toggle")
async def toggle_doctor(doctor_id: int, db=Depends(get_db), token=Depends(require_admin)):
    await db.execute("UPDATE doctors SET is_active = NOT is_active WHERE id=$1", doctor_id)
    return {"ok": True}

# ── Patients ──────────────────────────────────────────────────────────────────

@app.get("/api/patients")
async def list_patients(db=Depends(get_db), token=Depends(decode_token)):
    if token["role"] == "admin":
        rows = await db.fetch("SELECT p.*, d.full_name as doctor_name FROM patients p JOIN doctors d ON d.id=p.doctor_id ORDER BY p.created_at DESC")
    else:
        rows = await db.fetch("SELECT * FROM patients WHERE doctor_id=$1 ORDER BY created_at DESC", int(token["sub"]))
    return [dict(r) for r in rows]

@app.post("/api/patients")
async def create_patient(body: PatientCreate, db=Depends(get_db), token=Depends(require_doctor)):
    doctor_id = int(token["sub"]) if token["role"] == "doctor" else None
    if not doctor_id:
        raise HTTPException(400, "Admins cannot create patients directly")
    row = await db.fetchrow(
        "INSERT INTO patients (doctor_id, full_name, date_of_birth, gender, national_id, phone, diagnosis, icd10_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
        doctor_id, body.full_name, body.date_of_birth, body.gender, body.national_id, body.phone, body.diagnosis, body.icd10_code
    )
    return {"id": row["id"]}

@app.get("/api/patients/{patient_id}")
async def get_patient(patient_id: int, db=Depends(get_db), token=Depends(decode_token)):
    if token["role"] == "admin":
        row = await db.fetchrow("SELECT p.*, d.full_name as doctor_name FROM patients p JOIN doctors d ON d.id=p.doctor_id WHERE p.id=$1", patient_id)
    else:
        row = await db.fetchrow("SELECT * FROM patients WHERE id=$1 AND doctor_id=$2", patient_id, int(token["sub"]))
    if not row:
        raise HTTPException(404, "Patient not found")
    return dict(row)

# ── Orders ────────────────────────────────────────────────────────────────────

@app.post("/api/orders")
async def create_order(body: OrderCreate, db=Depends(get_db), token=Depends(require_doctor)):
    doctor_id = int(token["sub"])
    # verify patient belongs to doctor
    pat = await db.fetchrow("SELECT id FROM patients WHERE id=$1 AND doctor_id=$2", body.patient_id, doctor_id)
    if not pat:
        raise HTTPException(403, "Patient not found")
    # calculate total
    total = 0.0
    items_data = []
    for item in body.items:
        svc = await db.fetchrow("SELECT price_egp, per_fraction FROM services WHERE id=$1", item.service_id)
        if not svc:
            raise HTTPException(404, f"Service {item.service_id} not found")
        unit_price = float(svc["price_egp"] or 0)
        qty = item.quantity if svc["per_fraction"] else 1
        subtotal = unit_price * qty
        total += subtotal
        items_data.append((item.service_id, qty, unit_price, subtotal))
    # create order
    order = await db.fetchrow(
        "INSERT INTO orders (patient_id, doctor_id, treatment_site, total_fractions, total_dose_gy, dose_per_fraction_gy, notes_to_admin, simulation_date_requested, total_price_egp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
        body.patient_id, doctor_id, body.treatment_site, body.total_fractions, body.total_dose_gy, body.dose_per_fraction_gy, body.notes_to_admin, body.simulation_date_requested, total
    )
    order_id = order["id"]
    # insert items
    for (svc_id, qty, unit_price, subtotal) in items_data:
        await db.execute("INSERT INTO order_items (order_id, service_id, quantity, unit_price_egp, subtotal_egp) VALUES ($1,$2,$3,$4,$5)", order_id, svc_id, qty, unit_price, subtotal)
    # create milestones
    for m in ["simulation_done", "planning_done", "treatment_started", "treatment_completed"]:
        await db.execute("INSERT INTO treatment_milestones (order_id, milestone) VALUES ($1,$2)", order_id, m)
    # create billing record
    await db.execute("INSERT INTO billing (order_id, total_amount_egp, balance_egp) VALUES ($1,$2,$3)", order_id, total, total)
    return {"id": order_id, "total_price_egp": total}

@app.get("/api/orders")
async def list_orders(db=Depends(get_db), token=Depends(decode_token)):
    if token["role"] == "admin":
        rows = await db.fetch("""
            SELECT o.*, p.full_name as patient_name, d.full_name as doctor_name
            FROM orders o JOIN patients p ON p.id=o.patient_id JOIN doctors d ON d.id=o.doctor_id
            ORDER BY o.created_at DESC
        """)
    else:
        rows = await db.fetch("""
            SELECT o.*, p.full_name as patient_name
            FROM orders o JOIN patients p ON p.id=o.patient_id
            WHERE o.doctor_id=$1 ORDER BY o.created_at DESC
        """, int(token["sub"]))
    return [dict(r) for r in rows]

@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, db=Depends(get_db), token=Depends(decode_token)):
    if token["role"] == "admin":
        order = await db.fetchrow("SELECT o.*, p.full_name as patient_name, d.full_name as doctor_name, d.phone as doctor_phone, d.clinic_affiliation FROM orders o JOIN patients p ON p.id=o.patient_id JOIN doctors d ON d.id=o.doctor_id WHERE o.id=$1", order_id)
    else:
        order = await db.fetchrow("SELECT o.*, p.full_name as patient_name FROM orders o JOIN patients p ON p.id=o.patient_id WHERE o.id=$1 AND o.doctor_id=$2", order_id, int(token["sub"]))
    if not order:
        raise HTTPException(404, "Order not found")
    items = await db.fetch("SELECT oi.*, s.name as service_name, s.code, s.unit, s.category FROM order_items oi JOIN services s ON s.id=oi.service_id WHERE oi.order_id=$1", order_id)
    milestones = await db.fetch("SELECT * FROM treatment_milestones WHERE order_id=$1 ORDER BY id", order_id)
    billing = await db.fetchrow("SELECT * FROM billing WHERE order_id=$1", order_id)
    payments = []
    if billing:
        payments = await db.fetch("SELECT * FROM payments WHERE billing_id=$1 ORDER BY payment_date", billing["id"])
    return {
        "order": dict(order),
        "items": [dict(i) for i in items],
        "milestones": [dict(m) for m in milestones],
        "billing": dict(billing) if billing else None,
        "payments": [dict(p) for p in payments]
    }

# ── Milestones (admin) ────────────────────────────────────────────────────────

@app.patch("/api/orders/{order_id}/milestones")
async def update_milestone(order_id: int, body: MilestoneUpdate, db=Depends(get_db), token=Depends(require_admin)):
    await db.execute(
        "UPDATE treatment_milestones SET done=$1, done_date=$2, notes=$3, updated_by_admin_id=$4, updated_at=NOW() WHERE order_id=$5 AND milestone=$6",
        body.done, body.done_date, body.notes, int(token["sub"]), order_id, body.milestone
    )
    # update order status
    milestones = await db.fetch("SELECT milestone, done FROM treatment_milestones WHERE order_id=$1", order_id)
    m_dict = {m["milestone"]: m["done"] for m in milestones}
    if m_dict.get("treatment_completed"):
        new_status = "completed"
    elif m_dict.get("treatment_started"):
        new_status = "in_progress"
    elif m_dict.get("planning_done"):
        new_status = "planned"
    elif m_dict.get("simulation_done"):
        new_status = "simulated"
    else:
        new_status = "scheduled"
    await db.execute("UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2", new_status, order_id)
    return {"ok": True}

# ── Payments (admin) ──────────────────────────────────────────────────────────

@app.post("/api/payments")
async def add_payment(body: PaymentCreate, db=Depends(get_db), token=Depends(require_admin)):
    billing = await db.fetchrow("SELECT * FROM billing WHERE id=$1", body.billing_id)
    if not billing:
        raise HTTPException(404, "Billing record not found")
    await db.execute(
        "INSERT INTO payments (billing_id, amount_egp, payment_date, method, reference, recorded_by_admin_id, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        body.billing_id, body.amount_egp, body.payment_date or date.today(), body.method, body.reference, int(token["sub"]), body.notes
    )
    # recalculate billing
    total_paid = await db.fetchval("SELECT COALESCE(SUM(amount_egp),0) FROM payments WHERE billing_id=$1", body.billing_id)
    balance = float(billing["total_amount_egp"]) - float(total_paid)
    pay_status = "paid" if balance <= 0 else ("partial" if total_paid > 0 else "unpaid")
    await db.execute("UPDATE billing SET amount_paid_egp=$1, balance_egp=$2, status=$3, updated_at=NOW() WHERE id=$4",
                     total_paid, balance, pay_status, body.billing_id)
    return {"ok": True, "balance_egp": balance}

@app.get("/api/dashboard")
async def dashboard(db=Depends(get_db), token=Depends(decode_token)):
    if token["role"] == "admin":
        total_patients = await db.fetchval("SELECT COUNT(*) FROM patients")
        total_orders = await db.fetchval("SELECT COUNT(*) FROM orders")
        pending = await db.fetchval("SELECT COUNT(*) FROM orders WHERE status='pending'")
        total_billed = await db.fetchval("SELECT COALESCE(SUM(total_amount_egp),0) FROM billing")
        total_paid = await db.fetchval("SELECT COALESCE(SUM(amount_paid_egp),0) FROM billing")
        return {"total_patients": total_patients, "total_orders": total_orders, "pending_orders": pending, "total_billed_egp": float(total_billed), "total_paid_egp": float(total_paid)}
    else:
        did = int(token["sub"])
        total_patients = await db.fetchval("SELECT COUNT(*) FROM patients WHERE doctor_id=$1", did)
        total_orders = await db.fetchval("SELECT COUNT(*) FROM orders WHERE doctor_id=$1", did)
        active = await db.fetchval("SELECT COUNT(*) FROM orders WHERE doctor_id=$1 AND status NOT IN ('completed','cancelled')", did)
        return {"total_patients": total_patients, "total_orders": total_orders, "active_orders": active}
