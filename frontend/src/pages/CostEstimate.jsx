import React, { useState, useEffect } from 'react'
import { api, fmtEGP } from '../api.js'
import { useAuth } from '../App.jsx'

const CATS = [
  {id:'Simulation',color:'#e8f0fb',tc:'#0c447c',title:'CT / MRI / PET-CT simulation'},
  {id:'Immobilization',color:'#f3e8ff',tc:'#5b21b6',title:'Fixation devices & positioning aids'},
  {id:'Special Technique',color:'#eef2ff',tc:'#3730a3',title:'SGRT & respiratory gating'},
  {id:'Planning',color:'#e0f5f3',tc:'#085041',title:'Treatment planning & physics QA'},
  {id:'Treatment Delivery',color:'#fef4e7',tc:'#633806',title:'Per-fraction delivery & IGRT'},
  {id:'SBRT/SRS Package',color:'#fdecea',tc:'#791f1f',title:'All-inclusive stereotactic packages'},
  {id:'Special Procedure',color:'#fdecea',tc:'#791f1f',title:'Palliative, emergency, TBI & anesthesia'},
  {id:'Quality & Review',color:'#e0f5f3',tc:'#085041',title:'Velocity, peer review, consultations'},
]

export default function CostEstimate({ navigate, patientId }) {
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [services, setServices] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [quantities, setQuantities] = useState({})
  const [openCats, setOpenCats] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.services().then(setServices)
    if (patientId) api.getPatient(patientId).then(d => setPatient(d.patient))
  }, [patientId])

  function toggleCat(id) {
    setOpenCats(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }

  function toggleSvc(id) {
    setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }

  function getQty(id) { return quantities[id] || 1 }
  function setQty(id, v) { setQuantities(q => ({...q,[id]:parseInt(v)||1})) }

  function calcTotal() {
    let total = 0, hasTbd = false
    selected.forEach(sid => {
      const svc = services.find(s => s.id === sid)
      if (!svc) return
      const qty = svc.per_fraction ? getQty(sid) : 1
      if (svc.price_egp != null) total += svc.price_egp * qty
      else hasTbd = true
    })
    return { total, hasTbd }
  }

  async function submit() {
    if (!patientId || selected.size === 0) { setError('Select at least one service'); return }
    setSaving(true); setError('')
    try {
      const items = Array.from(selected).map(sid => {
        const svc = services.find(s => s.id === sid)
        return { service_id: sid, quantity: svc?.per_fraction ? getQty(sid) : 1 }
      })
      const res = await api.createEstimate({ patient_id: patientId, items })
      setSaved(res)
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  function openPrint() {
    const { total, hasTbd } = calcTotal()
    const items = Array.from(selected).map(sid => {
      const svc = services.find(s => s.id === sid)
      const qty = svc?.per_fraction ? getQty(sid) : 1
      const sub = svc?.price_egp != null ? svc.price_egp * qty : null
      return { code: svc?.code, name: svc?.name, unit: svc?.per_fraction ? qty+' fraction'+(qty>1?'s':'') : svc?.unit||'—', sub }
    })
    const orderNum = saved?.order_ref || 'EST-PREVIEW'
    const orderDate = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
    const rows = items.map(i=>`
    <tr>
      <td style="padding:10px 14px;font-size:12px;color:#8898aa;font-family:monospace;border-bottom:1px solid #f0f4f8">${i.code}</td>
      <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #f0f4f8">${i.name}</td>
      <td style="padding:10px 14px;font-size:12.5px;color:#4a5a70;border-bottom:1px solid #f0f4f8;text-align:center">${i.unit}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:500;border-bottom:1px solid #f0f4f8;text-align:right">${i.sub!=null?fmtEGP(i.sub):'<span style="color:#aaa;font-style:italic;font-weight:400">TBD</span>'}</td>
    </tr>`).join('')
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${orderNum}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#1a2636}
.header{background:#0b4f82;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:flex-start}
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
.tot td{padding:12px 14px;font-size:14px;font-weight:700;border-top:2px solid #0b4f82;background:#f0f4f8}
.notice{margin-top:14px;background:#fef4e7;border:1px solid #f0d5b0;border-radius:6px;padding:10px 14px;font-size:11.5px;color:#7a4800;line-height:1.6}
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
  <div><div class="pfl">Referring physician</div><div class="pfv">${user?.full_name||'—'}</div></div>
  <div><div class="pfl">Clinic</div><div class="pfv">${user?.clinic_affiliation||'—'}</div></div>
</div>
<div class="body">
  <div class="sec-title">Itemised cost breakdown</div>
  <table>
    <thead><tr><th style="width:80px">Code</th><th>Service</th><th style="width:120px;text-align:center">Qty / Unit</th><th style="width:130px">Amount (EGP)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="tot">
      <td colspan="3">Total estimated cost</td>
      <td style="color:#0b4f82">${total?fmtEGP(total)+(hasTbd?' + TBD':''):'To be confirmed'}</td>
    </tr></tfoot>
  </table>
  <div class="notice">⚠️ Preliminary cost estimate. Final pricing subject to confirmation by ACMC administration. Items marked "TBD" will be confirmed upon scheduling.</div>
  <div class="div"></div>
  <div class="sig">
    <div class="sb"><div class="sl">Prepared by</div><div class="sn">${user?.full_name||'—'}${user?.clinic_affiliation?' · '+user.clinic_affiliation:''}</div></div>
    <div class="sb"><div class="sl">Confirmed by (ACMC admin)</div><div class="sn" style="color:#ccc;font-weight:400">______________________________</div></div>
  </div>
</div>
<div class="footer">ACMC · Cost Estimate · ${orderNum} · No clinical information included. Refer to Clinical Treatment Order for prescription.</div>
</body></html>`
    const w=window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600)
  }

  const { total, hasTbd } = calcTotal()
  const card = {background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 20px',marginBottom:10}

  return (
    <div>
      <div style={{marginBottom:20}}>
        <button onClick={()=>navigate(patientId?'patient-detail':'patients',{patientId})} style={{background:'none',border:'none',color:'#0b4f82',cursor:'pointer',fontSize:13,fontWeight:500,marginBottom:8,padding:0}}>← Back</button>
        <h1 style={{fontSize:22,fontWeight:700}}>Cost Estimate</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Select services to generate an itemised EGP breakdown for the patient. No clinical details included.</p>
      </div>

      {patient && (
        <div style={{...card,background:'#f0f6ff',border:'1px solid #c5d8f5'}}>
          <div style={{fontSize:13,fontWeight:600}}>{patient.full_name}</div>
          <div style={{fontSize:12.5,color:'#4a5a70',marginTop:2}}>{patient.diagnosis||'No diagnosis recorded'}</div>
        </div>
      )}

      {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>{error}</div>}
      {saved && <div style={{background:'#e8f7ef',color:'#1a7a4a',border:'1px solid #b7e4cc',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>✓ {saved.updated ? 'Updated' : 'Saved'} as <strong>{saved.order_ref}</strong></div>}

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
                {selCount > 0 && <span style={{fontSize:11.5,color:'#0b4f82',fontWeight:600}}>{selCount} selected</span>}
                <span style={{fontSize:12,color:'#aaa',transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}>▾</span>
              </div>
              {open && (
                <div style={{border:'1px solid #dde3ec',borderTop:'none',borderRadius:'0 0 8px 8px',overflow:'hidden'}}>
                  {svcs.map((svc,i) => {
                    const isSel = selected.has(svc.id)
                    const qty = getQty(svc.id)
                    const sub = svc.price_egp != null ? svc.price_egp * (svc.per_fraction ? qty : 1) : null
                    return (
                      <div key={svc.id} onClick={() => toggleSvc(svc.id)}
                        style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',alignItems:'center',gap:12,
                          padding:'9px 14px',borderBottom:i<svcs.length-1?'1px solid #f0f4f8':'none',
                          background:isSel?'#f0f6ff':'#fff',cursor:'pointer',transition:'background .1s'}}>
                        <div style={{display:'flex',alignItems:'center',gap:9}}>
                          <div style={{width:16,height:16,borderRadius:4,border:isSel?'none':'1.5px solid #c0c9d6',
                            background:isSel?'#0b4f82':'#fff',display:'flex',alignItems:'center',justifyContent:'center',
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
                        <div style={{fontSize:13,fontWeight:500,minWidth:100,textAlign:'right',fontFamily:'monospace'}}>
                          {isSel ? (sub!=null ? fmtEGP(sub) : <span style={{color:'#aaa',fontStyle:'italic',fontSize:11.5}}>TBD</span>) : <span style={{color:'#dde3ec',fontSize:11.5}}>—</span>}
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

      {/* Total bar */}
      <div style={{background:'#0b4f82',borderRadius:10,padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div>
          <div style={{color:'rgba(255,255,255,.65)',fontSize:11.5,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em'}}>Estimated total</div>
          <div style={{color:'rgba(255,255,255,.45)',fontSize:11.5,marginTop:3}}>{selected.size} service{selected.size!==1?'s':''} selected</div>
        </div>
        <div style={{color:'#fff',fontSize:22,fontWeight:700,fontFamily:'monospace'}}>
          {selected.size ? (total ? fmtEGP(total)+(hasTbd?' + TBD':'') : 'TBD') : 'EGP —'}
        </div>
      </div>

      {/* Action bar */}
      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'13px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',bottom:14}}>
        <div style={{fontSize:12.5,color:'#8898aa'}}>{selected.size ? `${selected.size} service${selected.size>1?'s':''} selected` : 'Select services above'}</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={submit} disabled={saving||selected.size===0} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500,opacity:selected.size===0?.5:1}}>💾 Save</button>
          <button onClick={openPrint} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>🖨️ Print only</button>
          <button onClick={async()=>{await submit();openPrint()}} disabled={saving||selected.size===0}
            style={{padding:'8px 20px',borderRadius:7,border:'none',background:'#1a7a4a',color:'#fff',cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:600,opacity:selected.size===0?.5:1}}>
            {saving?'Saving…':'💾 Save & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
