const BASE = '/api'
function token() { return localStorage.getItem('acmc_token') }

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type':'application/json', ...(token()?{Authorization:`Bearer ${token()}`}:{}) },
    ...(body ? {body:JSON.stringify(body)} : {})
  })
  if (res.status===401) { localStorage.clear(); window.location.href='/'; return }
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||'Request failed') }
  return res.json()
}

export const api = {
  login: (email,password) => req('POST','/auth/login',{email,password}),
  me: () => req('GET','/auth/me'),
  dashboard: () => req('GET','/dashboard'),

  services: () => req('GET','/services'),
  updateServicePrice: (id,price_egp) => req('PATCH',`/services/${id}/price`,{price_egp}),

  doctors: () => req('GET','/doctors'),
  createDoctor: (data) => req('POST','/doctors',data),
  toggleDoctor: (id) => req('PATCH',`/doctors/${id}/toggle`),

  patients: () => req('GET','/patients'),
  createPatient: (data) => req('POST','/patients',data),
  getPatient: (id) => req('GET',`/patients/${id}`),
  updateMilestones: (pid,data) => req('PATCH',`/patients/${pid}/milestones`,data),

  createSimOrder: (data) => req('POST','/sim-orders',data),
  getSimOrder: (id) => req('GET',`/sim-orders/${id}`),

  createClinicalOrder: (data) => req('POST','/clinical-orders',data),
  getClinicalOrder: (id) => req('GET',`/clinical-orders/${id}`),

  createEstimate: (data) => req('POST','/estimates',data),
  getEstimate: (id) => req('GET',`/estimates/${id}`),

  allOrders: () => req('GET','/orders'),
  addPayment: (data) => req('POST','/payments',data),
}

export function fmtEGP(amount) {
  if (amount==null) return '—'
  return 'EGP '+Number(amount).toLocaleString('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2})
}
export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
}
export function fmtDateInput(d) {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}
