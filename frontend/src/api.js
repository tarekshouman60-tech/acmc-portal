const BASE = '/api'
function token() { return localStorage.getItem('acmc_token') }

async function req(method, path, body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type':'application/json', ...(token()?{Authorization:`Bearer ${token()}`}:{}) },
      ...(body ? {body:JSON.stringify(body)} : {}),
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (res.status===401) { localStorage.clear(); window.location.href='/'; return }
    if (!res.ok) {
      const e = await res.json().catch(()=>({}))
      let msg = e.detail || `Request failed (${res.status})`
      if (Array.isArray(msg)) msg = msg.map(d => d.msg || JSON.stringify(d)).join('; ')
      throw new Error(msg)
    }
    return res.json()
  } catch(e) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('Request timed out — please try again')
    throw e
  }
}

async function uploadFile(orderType, orderId, kind, fileOrBlob, filename, messageId) {
  const fd = new FormData()
  fd.append('order_type', orderType)
  fd.append('order_id', orderId)
  fd.append('kind', kind)
  if (messageId != null) fd.append('message_id', messageId)
  fd.append('file', fileOrBlob, filename || fileOrBlob.name || `${kind}-${Date.now()}`)
  const res = await fetch(BASE + '/attachments', {
    method: 'POST',
    headers: { ...(token()?{Authorization:`Bearer ${token()}`}:{}) },
    body: fd,
  })
  if (res.status===401) { localStorage.clear(); window.location.href='/'; return }
  if (!res.ok) {
    const e = await res.json().catch(()=>({}))
    let msg = e.detail || `Upload failed (${res.status})`
    if (Array.isArray(msg)) msg = msg.map(d => d.msg || JSON.stringify(d)).join('; ')
    throw new Error(msg)
  }
  return res.json()
}

async function fetchAttachmentBlobUrl(id) {
  const res = await fetch(BASE + `/attachments/${id}/file`, {
    headers: { ...(token()?{Authorization:`Bearer ${token()}`}:{}) },
  })
  if (!res.ok) throw new Error(`Failed to load attachment (${res.status})`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export const api = {
  forgot: (email) => req('POST','/auth/forgot',{email}),
  login: (email,password) => req('POST','/auth/login',{email,password}),
  me: () => req('GET','/auth/me'),
  dashboard: () => req('GET','/dashboard'),

  services: () => req('GET','/services'),
  updateServiceName: (id,name) => req('PATCH',`/services/${id}/name`,{name}),
  createService: (d) => req('POST','/services',d),
  updateServicePrice: (id,price_egp) => req('PATCH',`/services/${id}/price`,{price_egp}),

  doctors: () => req('GET','/doctors'),
  createDoctor: (data) => req('POST','/doctors',data),
  updateDoctor: (id,data) => req('PATCH',`/doctors/${id}`,data),
  toggleDoctor: (id) => req('PATCH',`/doctors/${id}/toggle`),
  resetDoctorPassword: (id) => req('POST',`/doctors/${id}/reset-password`),

  rtts: () => req('GET','/rtts'),
  createRtt: (data) => req('POST','/rtts',data),
  updateRtt: (id,data) => req('PATCH',`/rtts/${id}`,data),
  toggleRtt: (id) => req('PATCH',`/rtts/${id}/toggle`),
  resetRttPassword: (id) => req('POST',`/rtts/${id}/reset-password`),
  rttSimOrders: () => req('GET','/rtt/sim-orders'),
  updateRttSimOrder: (id, data) => req('PATCH',`/rtt/sim-orders/${id}`,data),

  physicists: () => req('GET','/physicists'),
  createPhysicist: (data) => req('POST','/physicists',data),
  updatePhysicist: (id,data) => req('PATCH',`/physicists/${id}`,data),
  togglePhysicist: (id) => req('PATCH',`/physicists/${id}/toggle`),
  resetPhysicistPassword: (id) => req('POST',`/physicists/${id}/reset-password`),
  physicistClinicalOrders: () => req('GET','/physicist/clinical-orders'),
  updatePhysicistClinicalOrder: (id, data) => req('PATCH',`/physicist/clinical-orders/${id}`,data),

  uploadAttachment: (orderType, orderId, kind, fileOrBlob, filename, messageId) => uploadFile(orderType, orderId, kind, fileOrBlob, filename, messageId),
  listAttachments: (orderType, orderId) => req('GET', `/attachments?order_type=${orderType}&order_id=${orderId}`),
  attachmentBlobUrl: (id) => fetchAttachmentBlobUrl(id),
  deleteAttachment: (id) => req('DELETE', `/attachments/${id}`),

  createMessage: (orderType, orderId, msgBody, isFlagged) => req('POST', '/messages', {order_type:orderType, order_id:orderId, body:msgBody, is_flagged:!!isFlagged}),
  listMessages: (orderType, orderId) => req('GET', `/messages?order_type=${orderType}&order_id=${orderId}`),
  markMessageRead: (id) => req('PATCH', `/messages/${id}/read`),
  unreadMessageCount: () => req('GET', '/messages/unread-count'),

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
  myOrders: () => req('GET','/my-orders'),
  addPayment: (data) => req('POST','/payments',data),
  editPayment: (id,data) => req('PATCH',`/payments/${id}`,data),
  setBillingDiscount: (id,data) => req('PATCH',`/billing/${id}/discount`,data),
  setDoctorFee: (did, referral_fee_pct) => req('PATCH',`/doctors/${did}/fee`,{referral_fee_pct}),
  createEarning: (data) => req('POST','/earnings',data),
  listEarnings: () => req('GET','/earnings'),
  earningsSummary: () => req('GET','/earnings/summary'),
  addTransfer: (data) => req('POST','/transfers',data),
  estimatesList: () => req('GET','/estimates-list'),
  getSetting: (key) => req('GET',`/settings/${key}`),
  updateSetting: (key, value) => req('PATCH',`/settings/${key}`,{value}),
  notifyTest: (patient_id, milestone) => req('POST','/notify/test',{patient_id,milestone}),
  planningTracker: () => req('GET','/planning-tracker'),
  changePassword: (current_password, new_password) => req('POST','/auth/change-password',{current_password,new_password}),
  updateSimStatus: (id, status) => req('PATCH',`/sim-orders/${id}/status`,{status}),
  updateClinicalStatus: (id, status) => req('PATCH',`/clinical-orders/${id}/status`,{status}),
  updateEstimateStatus: (id, status) => req('PATCH',`/estimates/${id}/status`,{status}),
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
export function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
}
export function fmtDateTimeInput(d) {
  if (!d) return ''
  const dt = new Date(d)
  const pad = n => String(n).padStart(2,'0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
