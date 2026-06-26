# ACMC Referring Physician Portal

Full-stack web portal for referring oncologists to submit simulation orders, clinical treatment orders, and cost estimates to ACMC (Advanced Cancer Management Center).

## Stack
- **Backend**: FastAPI + PostgreSQL + JWT auth
- **Frontend**: React (Vite) + custom CSS
- **Infrastructure**: Docker Compose on DigitalOcean Ubuntu droplet

## Quick Deploy (DigitalOcean)

```bash
# On your droplet:
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/acmc-portal/main/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

Default admin login: `admin@acmc.eg` / `Admin@ACMC2024`
**Change this password immediately after first login.**

## Structure

```
acmc/
├── backend/
│   ├── app.py          # FastAPI application (all endpoints)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Router & auth context
│   │   ├── api.js              # All API calls
│   │   ├── index.css           # Global styles
│   │   ├── components/
│   │   │   └── Layout.jsx      # Sidebar navigation
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Patients.jsx
│   │       ├── PatientDetail.jsx   # All orders linked here
│   │       ├── SimOrder.jsx        # Simulation order form
│   │       ├── ClinicalOrder.jsx   # Clinical treatment order
│   │       ├── CostEstimate.jsx    # Cost estimate + print
│   │       ├── Services.jsx        # Admin: price management
│   │       ├── Doctors.jsx         # Admin: doctor accounts
│   │       ├── AllOrders.jsx       # Admin: all orders list
│   │       ├── Milestones.jsx      # Admin: treatment progress
│   │       └── Billing.jsx         # Admin: payments
│   └── Dockerfile
├── schema.sql          # Full DB schema
├── seed_services.sql   # All 43 services + admin account
├── docker-compose.yml
├── deploy.sh           # One-command deploy
├── update.sh           # Pull & rebuild
└── nginx_production.conf  # For custom domain setup

```

## Doctor Portal
| Page | Purpose |
|------|---------|
| Dashboard | Stats + recent patients |
| My Patients | Create patient, view all |
| Patient Detail | All orders linked per patient |
| Simulation Order | Fill & print sim order |
| Clinical Order | Prescription only, no pricing |
| Cost Estimate | Select services, live EGP total, print |

## Admin Portal
| Page | Purpose |
|------|---------|
| Dashboard | Full stats + billing overview |
| All Patients | Across all doctors |
| All Orders | Filter by type (sim/clinical/estimate) |
| Milestones | Update treatment progress per patient |
| Billing | Record payments, track balance |
| Price Management | Set/edit EGP prices per service |
| Doctor Accounts | Create/activate/deactivate |

## API Endpoints
All endpoints under `/api/`. Auth via `Authorization: Bearer <token>`.

| Method | Path | Role |
|--------|------|------|
| POST | /auth/login | Public |
| GET | /auth/me | Any |
| GET | /services | Any |
| PATCH | /services/{id}/price | Admin |
| GET/POST | /patients | Doctor/Admin |
| GET | /patients/{id} | Doctor/Admin |
| PATCH | /patients/{id}/milestones | Admin |
| POST | /sim-orders | Doctor |
| POST | /clinical-orders | Doctor |
| POST | /estimates | Doctor |
| POST | /payments | Admin |
| GET | /dashboard | Any |
| GET | /orders | Admin |
| GET/POST | /doctors | Admin |
