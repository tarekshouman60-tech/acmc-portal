import React, { useState, useEffect } from 'react'
import { api } from '../api.js'
import { useAuth } from '../App.jsx'

const inp = {width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color .12s'}
const FL = ({label,children}) => <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{label}</label>{children}</div>

function ToggleGroup({ options, value, onChange, colorClass }) {
  return (
    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
      {options.map(opt => {
        const active = value === opt
        return (
          <button key={opt} onClick={() => onChange(active ? null : opt)}
            style={{padding:'7px 13px',borderRadius:7,border:active?'1.5px solid #0b4f82':'1px solid #dde3ec',
              background:active?'#e8f0fb':'#fff',color:active?'#0b4f82':'#1a2636',
              fontWeight:active?600:400,fontSize:13,cursor:'pointer',fontFamily:'inherit',transition:'all .12s'}}>
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function fmtDatePrint(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
}

export default function ClinicalOrder({ navigate, patientId }) {
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState('')

  const [hx, setHx] = useState('')
  const [dose, setDose] = useState('')
  const [fx, setFx] = useState('')
  const [weeks, setWeeks] = useState('')
  const [dpf, setDpf] = useState('')
  const [tech, setTech] = useState('')
  const [site, setSite] = useState('')
  const [sgrt, setSgrt] = useState(null)
  const [dibh, setDibh] = useState(null)
  const [igrt, setIgrt] = useState(null)
  const [intent, setIntent] = useState(null)
  const [sequence, setSequence] = useState(null)
  const [special, setSpecial] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (patientId) api.getPatient(patientId).then(d => setPatient(d.patient))
  }, [patientId])

  function buildRx() {
    let rx = ''
    if (dose) rx += dose + 'Gy'
    if (fx)   rx += (rx ? '/' : '') + fx + 'F'
    if (weeks) rx += (rx ? '/' : '') + weeks + ' weeks'
    if (tech)  rx += (rx ? ', ' : '') + tech
    if (sgrt === 'Yes') rx += (rx ? ', ' : '') + 'SGRT'
    if (dibh === 'Yes') rx += (rx ? ', ' : '') + 'DIBH'
    if (igrt && igrt !== 'None') rx += (rx ? ', ' : '') + 'IGRT (' + igrt + ')'
    if (site)  rx += (rx ? ' to ' : '') + site
    if (special) rx += (rx ? '. ' : '') + special
    return rx || '—'
  }

  function onDoseOrFx(d, f) {
    const dv = d !== undefined ? d : dose
    const fv = f !== undefined ? f : fx
    if (dv && fv) setDpf((parseFloat(dv)/parseFloat(fv)).toFixed(2))
    else setDpf('')
  }

  async function submit() {
    if (!patientId) { setError('No patient selected'); return }
    setSaving(true); setError('')
    try {
      const res = await api.createClinicalOrder({
        patient_id: patientId, clinical_history: hx,
        total_dose_gy: dose ? parseFloat(dose) : null,
        fractions: fx ? parseInt(fx) : null,
        duration_weeks: weeks ? parseInt(weeks) : null,
        dose_per_fraction_gy: dpf ? parseFloat(dpf) : null,
        technique: tech, treatment_site: site,
        sgrt, dibh, igrt, intent, sequence,
        special_instructions: special, notes_to_team: notes,
        prescription_text: buildRx()
      })
      setSaved(res)
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  function openPrint() {
    const d = {
      name: patient?.full_name || '—',
      age: patient?.date_of_birth ? Math.floor((Date.now()-new Date(patient.date_of_birth))/(365.25*24*3600*1000)) : '—',
      sex: patient?.gender || '—',
      hx, dose, fx, dpf, weeks, tech, site, sgrt, dibh, igrt, intent, sequence, special, notes,
      rx: buildRx(),
      doctor: user?.full_name || '',
      clinic: user?.clinic_affiliation || '',
      orderNum: saved?.order_ref || ('CLN-PREVIEW'),
      orderDate: new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
    }
    const field = (l,v) => v ? `<div class="field"><div class="fl">${l}</div><div class="fv">${v}</div></div>` : ''
    const yn = (l,v) => v ? `<div class="field"><div class="fl">${l}</div><div class="fv ${v==='Yes'?'yes':'blue'}">${v}</div></div>` : ''
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${d.orderNum}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#1a2636}
.header{background:#0b4f82;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:flex-start}
.h-title{font-size:15px;font-weight:700}.h-sub{font-size:11px;opacity:.6;margin-top:3px}
.h-right{text-align:right}.on{font-size:13px;font-weight:700;font-family:monospace}.od{font-size:11px;opacity:.6;margin-top:3px}
.badge{display:inline-block;background:rgba(255,255,255,.2);font-size:10px;padding:2px 8px;border-radius:20px;margin-top:5px}
.pbar{background:#f0f4f8;padding:12px 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;border-bottom:1px solid #dde3ec}
.pfl{font-size:10px;color:#8898aa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}.pfv{font-size:13px;font-weight:600}
.body{padding:18px 24px}.sec{margin-bottom:18px}
.sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#8898aa;padding-bottom:6px;border-bottom:1px solid #dde3ec;margin-bottom:10px}
.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.field{background:#f7f9fc;border-radius:6px;padding:8px 11px}.fl{font-size:10px;color:#8898aa;margin-bottom:2px}
.fv{font-size:13px;font-weight:500}.fv.yes{color:#1a7a4a}.fv.blue{color:#0b4f82}
.rx-box{background:#f0f4f8;border-left:3px solid #0b4f82;border-radius:0 6px 6px 0;padding:12px 16px;font-size:14px;font-weight:600;line-height:1.7}
.hx-box{font-size:12.5px;color:#4a5a70;line-height:1.7}
.notes-box{background:#f7f9fc;border-left:3px solid #0b4f82;border-radius:0 6px 6px 0;padding:10px 14px;font-size:12.5px;line-height:1.6}
.div{height:1px;background:#dde3ec;margin:16px 0}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:10px}
.sb{border-top:1px solid #dde3ec;padding-top:10px}.sl{font-size:10px;color:#8898aa}.sn{font-size:13px;font-weight:600;margin-top:22px}
.footer{background:#f0f4f8;border-top:1px solid #dde3ec;padding:9px 24px;font-size:10.5px;color:#8898aa;text-align:center}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="header">
  <div><div class="h-title">Advanced Cancer Management Center</div><div class="h-sub">Radiotherapy &amp; Oncology — Clinical Treatment Order</div></div>
  <div class="h-right"><div class="on">${d.orderNum}</div><div class="od">${d.orderDate}</div><div class="badge">CLINICAL ORDER</div></div>
</div>
<div class="pbar">
  <div><div class="pfl">Patient</div><div class="pfv">${d.name}</div></div>
  <div><div class="pfl">Age / Sex</div><div class="pfv">${d.age !== '—' ? d.age+' yrs' : '—'}${d.sex !== '—' ? ' · '+d.sex : ''}</div></div>
  <div><div class="pfl">Referring physician</div><div class="pfv">${d.doctor}${d.clinic?' · '+d.clinic:''}</div></div>
</div>
<div class="body">
  ${d.hx ? `<div class="sec"><div class="sec-title">Clinical history</div><div class="hx-box">${d.hx}</div></div>` : ''}
  <div class="sec">
    <div class="sec-title">Radiotherapy prescription</div>
    <div class="rx-box">${d.rx}</div>
    <div class="fields" style="margin-top:10px">
      ${field('Total dose', d.dose ? d.dose+' Gy' : null)}
      ${field('Fractions', d.fx)}
      ${field('Dose/fraction', d.dpf ? d.dpf+' Gy' : null)}
      ${field('Duration', d.weeks ? d.weeks+' weeks' : null)}
      ${field('Technique', d.tech)}
      ${field('Target / site', d.site)}
      ${yn('Intent', d.intent)}
      ${yn('Sequence', d.sequence)}
      ${yn('SGRT', d.sgrt)}
      ${yn('DIBH', d.dibh)}
      ${d.igrt && d.igrt !== 'None' ? field('IGRT', d.igrt) : ''}
    </div>
    ${d.special ? `<div style="margin-top:10px;font-size:12.5px;color:#4a5a70"><strong>Special instructions:</strong> ${d.special}</div>` : ''}
  </div>
  ${d.notes ? `<div class="sec"><div class="sec-title">Notes to physics / admin team</div><div class="notes-box">${d.notes}</div></div>` : ''}
  <div class="div"></div>
  <div class="sig">
    <div class="sb"><div class="sl">Referring physician signature</div><div class="sn">${d.doctor}</div></div>
    <div class="sb"><div class="sl">Received by (ACMC team)</div><div class="sn" style="color:#ccc;font-weight:400">______________________________</div></div>
  </div>
</div>
<div class="footer">ACMC · Clinical Treatment Order · ${d.orderNum} · Cost estimate issued separately.</div>
</body></html>`
    const w = window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600)
  }

  const card = {background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 20px',marginBottom:10}

  return (
    <div>
      <div style={{marginBottom:20}}>
        <button onClick={()=>navigate(patientId?'patient-detail':'patients',{patientId})} style={{background:'none',border:'none',color:'#0b4f82',cursor:'pointer',fontSize:13,fontWeight:500,marginBottom:8,padding:0}}>← Back</button>
        <h1 style={{fontSize:22,fontWeight:700}}>Clinical Treatment Order</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Prescription only — no pricing. Use Cost Estimate for billing.</p>
      </div>

      {patient && (
        <div style={{...card,background:'#f0f6ff',border:'1px solid #c5d8f5',marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600}}>{patient.full_name}</div>
          <div style={{fontSize:12.5,color:'#4a5a70',marginTop:2}}>{patient.diagnosis||'No diagnosis recorded'}</div>
        </div>
      )}

      {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>{error}</div>}
      {saved && <div style={{background:'#e8f7ef',color:'#1a7a4a',border:'1px solid #b7e4cc',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>✓ Saved as <strong>{saved.order_ref}</strong></div>}

      {/* Patient basic */}
      <div style={card}>
        <div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:13}}>Patient information</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:13}}>
          <FL label="Patient name"><input style={inp} value={patient?.full_name||''} readOnly style={{...inp,background:'#f7f9fc',color:'#8898aa'}}/></FL>
          <FL label="Age / Sex"><input style={{...inp,background:'#f7f9fc',color:'#8898aa'}} value={patient ? (patient.gender||'') : ''} readOnly/></FL>
          <FL label="Referring physician"><input style={{...inp,background:'#f7f9fc',color:'#8898aa'}} value={user?.full_name||''} readOnly/></FL>
        </div>
        <div style={{marginTop:13}}>
          <FL label="Clinical history"><textarea style={{...inp,resize:'vertical',minHeight:70}} value={hx} onChange={e=>setHx(e.target.value)} placeholder="e.g. Left breast cancer, conservative surgery T2N0M0, luminal disease, no chemotherapy"/></FL>
        </div>
      </div>

      {/* Prescription */}
      <div style={card}>
        <div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:13}}>Radiotherapy prescription</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:13,marginBottom:13}}>
          <FL label="Total dose (Gy)"><input style={inp} type="number" step="0.01" value={dose} onChange={e=>{setDose(e.target.value);onDoseOrFx(e.target.value,undefined)}} placeholder="e.g. 45"/></FL>
          <FL label="Fractions"><input style={inp} type="number" value={fx} onChange={e=>{setFx(e.target.value);onDoseOrFx(undefined,e.target.value)}} placeholder="e.g. 15"/></FL>
          <FL label="Duration (weeks)"><input style={inp} type="number" value={weeks} onChange={e=>setWeeks(e.target.value)} placeholder="e.g. 3"/></FL>
          <FL label="Dose / fraction (Gy)"><input style={{...inp,background:'#f7f9fc',color:'#4a5a70'}} value={dpf} readOnly placeholder="auto"/></FL>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13}}>
          <FL label="Technique">
            <select style={inp} value={tech} onChange={e=>setTech(e.target.value)}>
              <option value="">Select technique</option>
              <optgroup label="Conventional"><option>3D-CRT</option><option>IMRT</option><option>VMAT</option><option>IMRT/VMAT</option><option>Electron beam</option></optgroup>
              <optgroup label="Stereotactic"><option>SBRT</option><option>SRS</option><option>SRS – HyperArc</option></optgroup>
              <optgroup label="Special"><option>TBI</option><option>TSE – Stanford</option><option>Palliative RT</option><option>Emergency RT</option></optgroup>
            </select>
          </FL>
          <FL label="Treatment site / target"><input style={inp} value={site} onChange={e=>setSite(e.target.value)} placeholder="e.g. Left breast only, whole brain, spine L3"/></FL>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:13,marginBottom:13}}>
          <FL label="SGRT"><ToggleGroup options={['Yes','No']} value={sgrt} onChange={setSgrt}/></FL>
          <FL label="DIBH"><ToggleGroup options={['Yes','No']} value={dibh} onChange={setDibh}/></FL>
          <FL label="IGRT – HyperSight CBCT"><ToggleGroup options={['Pre-treatment','Adaptive','None']} value={igrt} onChange={setIgrt}/></FL>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13}}>
          <FL label="Intent"><ToggleGroup options={['Curative','Palliative','Adjuvant']} value={intent} onChange={setIntent}/></FL>
          <FL label="Sequence"><ToggleGroup options={['Concurrent','Sequential','Standalone']} value={sequence} onChange={setSequence}/></FL>
        </div>
        <FL label="Special instructions / fixation notes"><input style={inp} value={special} onChange={e=>setSpecial(e.target.value)} placeholder="e.g. Breast wing fixation, prone position, bilateral hip prosthesis"/></FL>
        <div style={{marginTop:14,background:'#f0f4f8',borderLeft:'3px solid #0b4f82',borderRadius:'0 6px 6px 0',padding:'10px 14px'}}>
          <div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>Prescription summary</div>
          <div style={{fontSize:13.5,fontWeight:600,color:'#1a2636',lineHeight:1.6}}>{buildRx()}</div>
        </div>
      </div>

      {/* Notes */}
      <div style={card}>
        <FL label="Notes to physics / admin team"><textarea style={{...inp,resize:'vertical',minHeight:80}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special setup requirements, clinical context, or instructions for the ACMC team…"/></FL>
      </div>

      {/* Action bar */}
      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'13px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',bottom:14}}>
        <div style={{fontSize:12.5,color:'#8898aa'}}>{dose&&fx&&tech&&site ? '✓ Ready to save and print' : 'Fill dose, fractions, technique and site'}</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={submit} disabled={saving} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>💾 Save</button>
          <button onClick={openPrint} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>🖨️ Print only</button>
          <button onClick={async()=>{await submit();openPrint()}} disabled={saving} style={{padding:'8px 20px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
            {saving?'Saving…':'💾 Save & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
