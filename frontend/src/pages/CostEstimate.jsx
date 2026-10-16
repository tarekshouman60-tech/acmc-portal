import React, { useState, useEffect } from 'react'
import { api, fmtEGP } from '../api.js'
import { useAuth } from '../App.jsx'

const CATS = [
  {id:'Simulation',color:'#dce9ff',tc:'#0c447c',title:'CT / MRI / PET-CT simulation'},
  {id:'Immobilization',color:'#f3e8ff',tc:'#5b21b6',title:'Fixation devices & positioning aids'},
  {id:'Special Technique',color:'#eef2ff',tc:'#3730a3',title:'SGRT & respiratory gating'},
  {id:'Planning',color:'#c9f7ee',tc:'#085041',title:'Treatment planning & physics QA'},
  {id:'Treatment Delivery',color:'#fef3c7',tc:'#633806',title:'Per-fraction delivery & IGRT'},
  {id:'SBRT/SRS Package',color:'#ffe4e6',tc:'#791f1f',title:'All-inclusive stereotactic packages'},
  {id:'Special Procedure',color:'#ffe4e6',tc:'#791f1f',title:'Palliative, emergency, TBI & anesthesia'},
  {id:'Quality & Review',color:'#c9f7ee',tc:'#085041',title:'Velocity, peer review, consultations'},
]

// Mirrors backend's FIXATION_TO_IMM_CODE — best-effort mapping from the Sim Order's fixation
// checklist to the matching Immobilization service, so a fresh estimate can start pre-filled
// with what was actually requested.
const FIXATION_TO_IMM_CODE = {
  'SRS mask':'IMM-005', 'Head closed':'IMM-001', 'Head open':'IMM-003',
  'Head & neck closed':'IMM-002', 'Head & neck open':'IMM-004',
  'Pelvis':'IMM-006', 'Vac-Lok adult':'IMM-008', 'Vac-Lok pediatric':'IMM-008',
}

export default function CostEstimate({ navigate, patientId }) {
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [services, setServices] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [quantities, setQuantities] = useState({})
  const [openCats, setOpenCats] = useState(new Set())
  const [saving, setSaving] = useState(false)
  // '' means "not entered yet" (shows as TBD); an explicit '0' is a real waived fee, not the same thing.
  const [customFees, setCustomFees] = useState({'QA-003':'','QA-004':'','QA-005':''})
  // Referring doctors can grant up to a 20% discount themselves when submitting the estimate.
  const [discountPct, setDiscountPct] = useState('')
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState('')
  // Falls back for any per-fraction service's quantity once the Clinical Order's fraction
  // count is known, so newly-checked delivery services start matching what's prescribed
  // instead of defaulting to 1.
  const [defaultFractions, setDefaultFractions] = useState(null)
  // Mismatches between this patient's last-saved estimate and what the Sim/Clinical Order
  // actually ended up requesting (e.g. order changed after the estimate was made).
  const [reconciliation, setReconciliation] = useState([])
  // Kept around (not just used at load) so the "Sync with order" button can re-apply them to
  // an estimate that already existed before the order changed — auto-fill at creation only
  // ever helps a brand-new estimate, which is the uncommon case once a patient is established.
  const [simOrder, setSimOrder] = useState(null)
  const [clinOrder, setClinOrder] = useState(null)

  useEffect(() => {
    if (!patientId) { api.services().then(setServices); return }
    Promise.all([api.services(), api.getPatient(patientId)]).then(([svcs, d]) => {
      setServices(svcs)
      setPatient(d.patient)
      setReconciliation(d.reconciliation || [])
      const existing = d.cost_estimates?.[0]
      const sim = d.sim_orders?.[0]
      const clin = d.clinical_orders?.[0]
      setSimOrder(sim || null)
      setClinOrder(clin || null)
      if (clin?.fractions) setDefaultFractions(clin.fractions)
      if (existing) {
        api.getEstimate(existing.id).then(({items, billing}) => {
          setSelected(new Set(items.map(i => i.service_id)))
          setQuantities(q => {
            const n = {...q}
            items.forEach(i => { n[i.service_id] = i.quantity })
            return n
          })
          setCustomFees(f => {
            const n = {...f}
            items.forEach(i => { if (['QA-003','QA-004','QA-005'].includes(i.code)) n[i.code] = i.unit_price_egp != null ? String(i.unit_price_egp) : '' })
            return n
          })
          setOpenCats(c => new Set([...c, ...items.map(i => i.category)]))
          // Reload a previously-applied discount — without this it looks blank/wiped on reopen,
          // and resaving without re-entering it would actually wipe it back to 0.
          if (billing?.discount_pct) setDiscountPct(String(billing.discount_pct))
        })
      } else {
        // Fresh estimate: pre-fill the immobilization service from the Sim Order's fixation,
        // if one was already ordered, so the estimate starts matching what was requested.
        if (sim?.fixation) {
          const requested = sim.fixation.split(';').map(s=>s.trim()).filter(Boolean)
          const codes = new Set(requested.map(r=>FIXATION_TO_IMM_CODE[r]).filter(Boolean))
          const matches = svcs.filter(s => s.category==='Immobilization' && codes.has(s.code))
          if (matches.length) {
            setSelected(s => new Set([...s, ...matches.map(m=>m.id)]))
            setOpenCats(c => new Set([...c, 'Immobilization']))
          }
        }
      }
    })
  }, [patientId])

  function toggleCat(id) {
    setOpenCats(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }

  function toggleSvc(id) {
    setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }

  function getQty(id) { return quantities[id] || defaultFractions || 1 }
  function setQty(id, v) { setQuantities(q => ({...q,[id]:parseInt(v)||1})) }

  // Fixes an already-saved estimate to match what the Sim/Clinical Order actually ended up
  // requesting — same correction auto-fill does for a brand-new estimate, applied on demand
  // here since overwriting a saved estimate's selections must be something the doctor/admin
  // chooses, never silent.
  function syncWithOrder() {
    if (simOrder?.fixation) {
      const requested = simOrder.fixation.split(';').map(s=>s.trim()).filter(Boolean)
      const codes = new Set(requested.map(r=>FIXATION_TO_IMM_CODE[r]).filter(Boolean))
      const matches = services.filter(s => s.category==='Immobilization' && codes.has(s.code))
      if (matches.length) {
        setSelected(s => {
          const n = new Set([...s].filter(id => services.find(sv=>sv.id===id)?.category !== 'Immobilization'))
          matches.forEach(m => n.add(m.id))
          return n
        })
        setOpenCats(c => new Set([...c, 'Immobilization']))
      }
    }
    if (clinOrder?.fractions) {
      const fx = clinOrder.fractions
      setQuantities(q => {
        const n = {...q}
        selected.forEach(id => { if (services.find(s=>s.id===id)?.per_fraction) n[id] = fx })
        return n
      })
      setDefaultFractions(fx)
    }
    setReconciliation([])
  }

  function hasPackage() {
    return Array.from(selected).some(sid => services.find(s => s.id === sid)?.category === 'SBRT/SRS Package')
  }

  // When an SBRT/SRS package is selected, it's all-inclusive: only the package price
  // itself and the doctor's own consultation fees (QA-003/004/005) still count — every
  // other selected service (simulation, immobilization, planning, delivery, etc.) is
  // already bundled into the package price and must not be added again.
  function isExcludedByPackage(svc) {
    if (!svc || !hasPackage()) return false
    if (svc.category === 'SBRT/SRS Package') return false
    if (['QA-003','QA-004','QA-005'].includes(svc.code)) return false
    return true
  }

  function calcTotal() {
    let total = 0, hasTbd = false
    const pkg = hasPackage()
    selected.forEach(sid => {
      const svc = services.find(s => s.id === sid)
      if (!svc) return
      if (pkg && isExcludedByPackage(svc)) return
      const qty = svc.per_fraction ? getQty(sid) : 1
      if (['QA-003','QA-004','QA-005'].includes(svc.code)) {
        if (customFees[svc.code] !== '') total += parseFloat(customFees[svc.code]) || 0
        else hasTbd = true
      } else if (svc.price_egp != null) {
        total += svc.price_egp * qty
      } else hasTbd = true
    })
    return { total, hasTbd }
  }

  // Consultation/follow-up fees (QA-003/004/005) are never discounted — matches the admin's
  // existing billing-discount rule, so a doctor-applied discount and an admin-applied one mean
  // the same thing.
  function calcConsultationTotal() {
    let c = 0
    selected.forEach(sid => {
      const svc = services.find(s => s.id === sid)
      if (!svc || !['QA-003','QA-004','QA-005'].includes(svc.code)) return
      if (hasPackage() && isExcludedByPackage(svc)) return
      if (customFees[svc.code] !== '') c += parseFloat(customFees[svc.code]) || 0
    })
    return c
  }
  function calcDiscount(total) {
    const pct = Math.min(Math.max(parseFloat(discountPct) || 0, 0), 20)
    const discountable = Math.max(total - calcConsultationTotal(), 0)
    const discountEgp = Math.round(discountable * pct / 100 * 100) / 100
    return { pct, discountEgp, billedTotal: Math.round((total - discountEgp) * 100) / 100 }
  }

  async function submit() {
    if (!patientId || selected.size === 0) { setError('Select at least one service'); return }
    setSaving(true); setError('')
    try {
      const items = Array.from(selected).map(sid => {
        const svc = services.find(s => s.id === sid)
        const item = {
          service_id: sid,
          quantity: svc?.per_fraction ? getQty(sid) : 1
        }
        if (svc && ['QA-003','QA-004','QA-005'].includes(svc.code) && customFees[svc.code] !== '') {
          item.unit_price = parseFloat(customFees[svc.code]) || 0
        }
        return item
      })
      const payload = { patient_id: patientId, items }
      if (discountPct !== '') { payload.discount_pct = Math.min(Math.max(parseFloat(discountPct)||0,0),20); payload.discount_reason = 'Discount applied by referring doctor' }
      const res = await api.createEstimate(payload)
      setSaved(res)
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  function openPrint() {
    const { total, hasTbd } = calcTotal()
    const { pct, discountEgp, billedTotal } = calcDiscount(total)
    const items = Array.from(selected).map(sid => {
      const svc = services.find(s => s.id === sid)
      const qty = svc?.per_fraction ? getQty(sid) : 1
      const excluded = isExcludedByPackage(svc)
      let sub = null
      if (['QA-003','QA-004','QA-005'].includes(svc?.code)) {
        sub = customFees[svc.code] !== '' ? (parseFloat(customFees[svc.code]) || 0) : null
      } else {
        sub = svc?.price_egp != null ? svc.price_egp * qty : null
      }
      return { code: svc?.code, name: svc?.name, unit: svc?.per_fraction ? qty+' fraction'+(qty>1?'s':'') : svc?.unit||'—', sub, excluded }
    })
    const orderNum = saved?.order_ref || 'EST-PREVIEW'
    const orderDate = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
    const rows = items.map(i=>`
    <tr${i.excluded?' style="opacity:.55"':''}>
      <td style="padding:10px 14px;font-size:12px;color:#8898aa;font-family:monospace;border-bottom:1px solid #f0f4f8">${i.code}</td>
      <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #f0f4f8">${i.name}</td>
      <td style="padding:10px 14px;font-size:12.5px;color:#4a5a70;border-bottom:1px solid #f0f4f8;text-align:center">${i.unit}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:500;border-bottom:1px solid #f0f4f8;text-align:right">${i.excluded?'<span style="color:#155eef;font-style:italic;font-weight:400">Included in package</span>':(i.sub!=null?fmtEGP(i.sub):'<span style="color:#aaa;font-style:italic;font-weight:400">TBD</span>')}</td>
    </tr>`).join('')
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${orderNum}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#1a2636}
.header{background:#155eef;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:flex-start}
.h-title{font-size:15px;font-weight:700}.h-sub{font-size:11px;opacity:.6;margin-top:3px}
.h-right{text-align:right}.on{font-size:13px;font-weight:700;font-family:monospace}.od{font-size:11px;opacity:.6;margin-top:3px}
.badge{display:inline-block;background:rgba(255,255,255,.2);font-size:10px;padding:2px 8px;border-radius:20px;margin-top:5px}
.pbar{background:#f0f4f8;padding:12px 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;border-bottom:1px solid #dde3ec}
.pfl{font-size:10px;color:#8898aa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}.pfv{font-size:13px;font-weight:600}
.body{padding:18px 24px}
.sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#8898aa;padding-bottom:6px;border-bottom:1px solid #dde3ec;margin-bottom:12px}
table{width:100%;border-collapse:collapse;border:1px solid #dde3ec;border-radius:8px;overflow:hidden}
th{background:#f7f9fc;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8898aa;padding:9px 14px;text-align:left;border-bottom:1px solid #dde3ec}
th:last-child,td:last-child{text-align:right}
.tot td{padding:12px 14px;font-size:14px;font-weight:700;border-top:2px solid #155eef;background:#f0f4f8}
.notice{margin-top:14px;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;font-size:11.5px;color:#92400e;line-height:1.6}
.div{height:1px;background:#dde3ec;margin:16px 0}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:10px}
.sb{border-top:1px solid #dde3ec;padding-top:10px}.sl{font-size:10px;color:#8898aa}.sn{font-size:13px;font-weight:600;margin-top:22px}
.footer{background:#f0f4f8;border-top:1px solid #dde3ec;padding:9px 24px;font-size:10.5px;color:#8898aa;text-align:center}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="header">
  <div><div class="h-title">Advanced Cancer Management Center</div><div class="h-sub">Radiotherapy &amp; Oncology — Cost Estimate</div></div>
  <div class="h-right"><div class="on">${orderNum}</div><div class="od">${orderDate}</div><div class="badge">COST ESTIMATE</div></div>
</div>
<div class="pbar">
  <div><div class="pfl">Patient</div><div class="pfv">${patient?.full_name||'—'}</div></div>
  <div><div class="pfl">Referring physician</div><div class="pfv">${patient?.doctor_name||user?.full_name||'—'}</div></div>
  <div><div class="pfl">Clinic</div><div class="pfv">${patient?.clinic_affiliation||user?.clinic_affiliation||'—'}</div></div>
</div>
<div class="body">
  <div class="sec-title">Itemised cost breakdown</div>
  <table>
    <thead><tr><th style="width:80px">Code</th><th>Service</th><th style="width:120px;text-align:center">Qty / Unit</th><th style="width:130px">Amount (EGP)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
    ${pct>0 ? `<tr><td colspan="3" style="padding:8px 14px;font-size:12.5px;color:#4a5a70">Discount (${pct}%)</td><td style="padding:8px 14px;font-size:12.5px;color:#e11d48;text-align:right">−${fmtEGP(discountEgp)}</td></tr>` : ''}
    <tr class="tot">
      <td colspan="3">Total estimated cost</td>
      <td style="color:#155eef">${total?fmtEGP(billedTotal)+(hasTbd?' + TBD':''):'To be confirmed'}</td>
    </tr></tfoot>
  </table>
  <div class="notice">⚠️ Preliminary cost estimate. Final pricing subject to confirmation by ACMC administration. Items marked "TBD" will be confirmed upon scheduling.</div>
  <div class="div"></div>
  <div class="sig">
    <div class="sb"><div class="sl">Prepared by</div><div class="sn">${patient?.doctor_name||user?.full_name||'—'}${(patient?.clinic_affiliation||user?.clinic_affiliation)?' · '+(patient?.clinic_affiliation||user?.clinic_affiliation):''}</div></div>
    <div class="sb"><div class="sl">Confirmed by (ACMC admin)</div><div class="sn" style="color:#ccc;font-weight:400">______________________________</div></div>
  </div>
</div>
<div class="footer">ACMC · Cost Estimate · ${orderNum} · No clinical information included. Refer to Clinical Treatment Order for prescription.</div>
</body></html>`
    const w=window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600)
  }

  const { total, hasTbd } = calcTotal()
  const { pct: discountPctApplied, discountEgp, billedTotal } = calcDiscount(total)
  const card = {background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:14,padding:'18px 20px',marginBottom:10}

  return (
    <div>
      <div style={{marginBottom:20}}>
        <button onClick={()=>navigate(patientId?'patient-detail':'patients',{patientId})} style={{background:'none',border:'none',color:'#155eef',cursor:'pointer',fontSize:13,fontWeight:500,marginBottom:8,padding:0}}>← Back</button>
        <h1 style={{fontSize:22,fontWeight:700}}>Cost Estimate</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Select services to generate an itemised EGP breakdown for the patient. No clinical details included.</p>
      </div>

      {patient && (
        <div style={{...card,background:'#f0f6ff',border:'1px solid #c5d8f5'}}>
          <div style={{fontSize:13,fontWeight:600}}>{patient.full_name}</div>
          <div style={{fontSize:12.5,color:'#4a5a70',marginTop:2}}>{patient.diagnosis||'No diagnosis recorded'}</div>
        </div>
      )}

      {error && <div style={{background:'#ffe4e6',color:'#e11d48',border:'1px solid #fecdd3',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>{error}</div>}
      {saved && <div style={{background:'#d1fae5',color:'#059669',border:'1px solid #a7f3d0',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>✓ {saved.updated ? 'Updated' : 'Saved'} as <strong>{saved.order_ref}</strong></div>}
      {hasPackage() && <div style={{background:'#ffe4e6',color:'#791f1f',border:'1px solid #fecdd3',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>📦 SBRT/SRS Package selected — this is all-inclusive. Other selected services are bundled into the package price and excluded from the total; only the package price plus your own consultation fees are charged.</div>}
      {reconciliation.length > 0 && (
        <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12,color:'#92400e'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:4}}>
            <div style={{fontWeight:700}}>⚠️ This saved estimate doesn't match the actual order</div>
            <button type="button" onClick={syncWithOrder}
              style={{padding:'5px 12px',borderRadius:6,border:'1px solid #92400e',background:'#fff',color:'#92400e',cursor:'pointer',fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>
              Sync with order
            </button>
          </div>
          <ul style={{margin:'0 0 0 18px',padding:0}}>
            {reconciliation.map((w,i) => <li key={i} style={{marginBottom:2}}>{w.message}</li>)}
          </ul>
          <div style={{fontSize:11.5,marginTop:6,fontStyle:'italic'}}>Updates the selections below to match — review and click Save to apply.</div>
        </div>
      )}

      {/* Services */}
      <div style={card}>
        <div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:13}}>Select services</div>

        {CATS.map(cat => {
          const svcs = services.filter(s => s.category === cat.id)
          if (!svcs.length) return null
          const open = openCats.has(cat.id)
          const selCount = svcs.filter(s => selected.has(s.id)).length
          return (
            <div key={cat.id} style={{marginBottom:8}}>
              <div onClick={() => toggleCat(cat.id)}
                style={{display:'flex',alignItems:'center',gap:9,padding:'10px 14px',background:'#f7f9fc',border:'1px solid #dde3ec',
                  borderRadius:open?'8px 8px 0 0':'8px',cursor:'pointer',userSelect:'none',borderBottom:open?'none':'1px solid #dde3ec'}}>
                <span style={{background:cat.color,color:cat.tc,fontSize:10.5,fontWeight:600,padding:'2px 9px',borderRadius:20,whiteSpace:'nowrap'}}>{cat.id}</span>
                <span style={{flex:1,fontSize:13,fontWeight:500}}>{cat.title}</span>
                {selCount > 0 && <span style={{fontSize:11.5,color:'#155eef',fontWeight:600}}>{selCount} selected</span>}
                <span style={{fontSize:12,color:'#aaa',transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}>▾</span>
              </div>
              {open && (
                <div style={{border:'1px solid #dde3ec',borderTop:'none',borderRadius:'0 0 8px 8px',overflow:'hidden'}}>
                  {svcs.map((svc,i) => {
                    const isSel = selected.has(svc.id)
                    const qty = getQty(svc.id)
                    const sub = svc.price_egp != null ? svc.price_egp * (svc.per_fraction ? qty : 1) : null
                    const excluded = isSel && isExcludedByPackage(svc)
                    return (
                      <div key={svc.id} onClick={() => toggleSvc(svc.id)}
                        style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',alignItems:'center',gap:12,
                          padding:'9px 14px',borderBottom:i<svcs.length-1?'1px solid #f0f4f8':'none',
                          background:isSel?(excluded?'#f7f9fc':'#f0f6ff'):'#fff',cursor:'pointer',transition:'background .1s',
                          opacity:excluded?.6:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:9}}>
                          <div style={{width:16,height:16,borderRadius:4,border:isSel?'none':'1.5px solid #c0c9d6',
                            background:isSel?'#155eef':'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:10,color:'#fff',flexShrink:0}}>
                            {isSel?'✓':''}
                          </div>
                          <div>
                            <div style={{fontSize:13}}>{svc.name}</div>
                            {svc.notes && <div style={{fontSize:11,color:'#8898aa',marginTop:1}}>{svc.notes}</div>}
                          </div>
                        </div>
                        <div style={{fontSize:11.5,color:'#8898aa',whiteSpace:'nowrap'}}>{svc.unit}</div>
                        {svc.per_fraction && (
                          <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:5}}>
                            <span style={{fontSize:11,color:'#4a5a70'}}>Fx:</span>
                            <input type="number" min="1" value={qty} onChange={e=>setQty(svc.id,e.target.value)}
                              style={{width:55,padding:'4px 7px',fontSize:13,border:'1px solid #dde3ec',borderRadius:5,textAlign:'center',fontFamily:'inherit',outline:'none'}}/>
                          </div>
                        )}
                        {!svc.per_fraction && <div/>}
                        <div style={{minWidth:120,textAlign:'right'}}>
                          {excluded ? (
                            <span style={{fontSize:11.5,fontStyle:'italic',color:'#155eef',fontWeight:500}}>Included in package</span>
                          ) : ['QA-003','QA-004','QA-005'].includes(svc.code) && isSel ? (
                            <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>
                              <span style={{fontSize:11,color:'#4a5a70'}}>EGP</span>
                              <input type="number" min="0" placeholder="Your fee"
                                value={customFees[svc.code]}
                                onChange={e=>setCustomFees(f=>({...f,[svc.code]:e.target.value}))}
                                style={{width:90,padding:'4px 7px',fontSize:12,border:'1px solid #155eef',borderRadius:5,textAlign:'right',fontFamily:'monospace',outline:'none'}}/>
                            </div>
                          ) : (
                            <span style={{fontSize:13,fontWeight:500,fontFamily:'monospace'}}>
                              {isSel ? (sub!=null ? fmtEGP(sub) : <span style={{color:'#aaa',fontStyle:'italic',fontSize:11.5}}>TBD</span>) : <span style={{color:'#dde3ec',fontSize:11.5}}>—</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Discount (doctors only — up to 20%, not applied to consultation/follow-up fees) */}
      {user?.role === 'doctor' && (
        <div style={{...card,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:12.5,fontWeight:600}}>Discount for this patient</div>
            <div style={{fontSize:11.5,color:'#8898aa',marginTop:1}}>Up to 20%. Doesn't apply to consultation/follow-up fees.</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto'}}>
            <input type="number" min="0" max="20" step="0.5" placeholder="0" value={discountPct}
              onChange={e=>setDiscountPct(e.target.value===''?'':String(Math.min(Math.max(parseFloat(e.target.value)||0,0),20)))}
              style={{width:70,padding:'7px 10px',fontSize:13,border:'1px solid #dde3ec',borderRadius:6,textAlign:'right',fontFamily:'monospace',outline:'none'}}/>
            <span style={{fontSize:13,color:'#4a5a70'}}>%</span>
          </div>
        </div>
      )}

      {/* Total bar */}
      <div style={{background:'#155eef',borderRadius:14,padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div>
          <div style={{color:'rgba(255,255,255,.65)',fontSize:11.5,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em'}}>Estimated total</div>
          <div style={{color:'rgba(255,255,255,.45)',fontSize:11.5,marginTop:3}}>
            {selected.size} service{selected.size!==1?'s':''} selected
            {discountPctApplied>0 && ` · ${discountPctApplied}% discount (−${fmtEGP(discountEgp)})`}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          {discountPctApplied>0 && selected.size>0 && (
            <div style={{color:'rgba(255,255,255,.5)',fontSize:13,textDecoration:'line-through'}}>{fmtEGP(total)}</div>
          )}
          <div style={{color:'#fff',fontSize:22,fontWeight:700,fontFamily:'monospace'}}>
            {selected.size ? (hasTbd ? (billedTotal ? fmtEGP(billedTotal)+' + TBD' : 'TBD') : fmtEGP(billedTotal)) : 'EGP —'}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:14,padding:'13px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',bottom:14}}>
        <div style={{fontSize:12.5,color:'#8898aa'}}>
          {selected.size ? `${selected.size} service${selected.size>1?'s':''} selected` : 'Select services above'}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>navigate(patientId?'patient-detail':'patients',{patientId})} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500,color:'#e11d48'}}>Cancel</button>
          <button onClick={submit} disabled={saving||selected.size===0} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500,opacity:selected.size===0?.5:1}}>💾 Save</button>
          <button onClick={openPrint} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>🖨️ Print only</button>
          <button onClick={async()=>{await submit();openPrint()}} disabled={saving||selected.size===0}
            style={{padding:'8px 20px',borderRadius:7,border:'none',background:'#059669',color:'#fff',cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:600,opacity:selected.size===0?.5:1}}>
            {saving?'Saving…':'💾 Save & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
