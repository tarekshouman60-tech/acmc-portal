import React, { useState, useEffect } from 'react'
import { api } from '../api.js'
import { useAuth } from '../App.jsx'

const POSITIONING = ['Supine','Prone','Abdominal compression','Hand side','Hand on abdomen','Hand on chest','Hands above head']
const FIXATION = ['SRS mask','Head closed','Head open','Head & neck closed','Head & neck open','Pelvis','Peripheral limb','Vac-Lok adult','Vac-Lok pediatric']
const SHIELDS = ['Eye shield','Testicle shield','Lead cut-out for EB']
const SPECIAL = ['Fasting','Rectal emptying','Full bladder','Empty bladder','600cc water','Rectal tube','Fiducials','Wire on scar']

const inp = {width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}
const FL = ({label,children}) => <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{label}</label>{children}</div>

function Section({ id, label, icon, color, open, onToggle, summary, children }) {
  return (
    <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
      <div onClick={onToggle} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 18px',cursor:'pointer',userSelect:'none'}}>
        <div style={{width:28,height:28,borderRadius:7,background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{icon}</div>
        <span style={{flex:1,fontWeight:500,fontSize:13.5}}>{label}</span>
        {summary && <span style={{fontSize:11.5,color:'#8898aa',fontStyle:'italic',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{summary}</span>}
        <span style={{fontSize:13,color:'#aaa',transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}>▾</span>
      </div>
      {open && <div style={{padding:'15px 18px',borderTop:'1px solid #dde3ec'}}>{children}</div>}
    </div>
  )
}

function RadioGroup({ options, value, onChange }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt===value?null:opt)}
          style={{padding:'7px 13px',borderRadius:7,border:value===opt?'1.5px solid #0b4f82':'1px solid #dde3ec',
            background:value===opt?'#e8f0fb':'#fff',color:value===opt?'#0b4f82':'#1a2636',
            fontWeight:value===opt?600:400,fontSize:13,cursor:'pointer',fontFamily:'inherit',transition:'all .12s'}}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function CheckGroup({ options, values, onChange }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
      {options.map(opt => {
        const on = values.includes(opt)
        return (
          <button key={opt} onClick={() => onChange(on?values.filter(v=>v!==opt):[...values,opt])}
            style={{padding:'7px 13px',borderRadius:7,border:on?'1.5px solid #0b4f82':'1px solid #dde3ec',
              background:on?'#e8f0fb':'#fff',color:on?'#0b4f82':'#1a2636',
              fontWeight:on?600:400,fontSize:13,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6,transition:'all .12s'}}>
            <span style={{width:14,height:14,borderRadius:3,border:on?'none':'1.5px solid #aaa',
              background:on?'#0b4f82':'transparent',color:'#fff',fontSize:9,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{on?'✓':''}</span>
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

export default function SimOrder({ navigate, patientId }) {
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [open, setOpen] = useState({positioning:true})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState('')

  const [simDate, setSimDate] = useState('')
  const [pos, setPos] = useState(null)
  const [fix, setFix] = useState(null)
  const [shields, setShields] = useState([])
  const [bolus, setBolus] = useState(null)
  const [bolusThick, setBolusThick] = useState('')
  const [contrast, setContrast] = useState(null)
  const [sliceThick, setSliceThick] = useState('')
  const [scanRegion, setScanRegion] = useState('')
  const [fourDct, setFourDct] = useState(null)
  const [sgrt, setSgrt] = useState(null)
  const [rpm, setRpm] = useState(null)
  const [mri, setMri] = useState(null)
  const [mriSeq, setMriSeq] = useState('')
  const [mriContrast, setMriContrast] = useState('')
  const [mriSlice, setMriSlice] = useState('')
  const [pet, setPet] = useState(null)
  const [special, setSpecial] = useState([])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!patientId) return
    api.getPatient(patientId).then(d => {
      setPatient(d.patient)
      const existing = d.sim_orders?.[0]
      if (existing) {
        api.getSimOrder(existing.id).then(s => {
          setSimDate(s.sim_date_requested ? String(s.sim_date_requested).slice(0,10) : '')
          setPos(s.positioning || null)
          setFix(s.fixation || null)
          setShields(s.shields || [])
          setBolus(s.bolus || null)
          setBolusThick(s.bolus_thickness || '')
          setContrast(s.ct_contrast || null)
          setSliceThick(s.ct_slice_thickness || '')
          setScanRegion(s.ct_scan_region || '')
          setFourDct(s.ct_4d || null)
          setSgrt(s.sgrt || null)
          setRpm(s.rpm || null)
          setMri(s.mri || null)
          setMriSeq(s.mri_sequence || '')
          setMriContrast(s.mri_contrast || '')
          setMriSlice(s.mri_slice_thickness || '')
          setPet(s.pet_ct || null)
          setSpecial(s.special_orders || [])
          setNotes(s.notes_to_physics || '')
        })
      }
    })
  }, [patientId])

  function tog(id) { setOpen(o=>({...o,[id]:!o[id]})) }

  async function submit() {
    if (!patientId) { setError('No patient selected'); return }
    setSaving(true); setError('')
    try {
      const res = await api.createSimOrder({
        patient_id: patientId, positioning: pos, fixation: fix,
        shields, bolus, bolus_thickness: bolusThick,
        ct_contrast: contrast, ct_slice_thickness: sliceThick,
        ct_scan_region: scanRegion, ct_4d: fourDct,
        sgrt, rpm, mri, mri_sequence: mriSeq,
        mri_contrast: mriContrast, mri_slice_thickness: mriSlice,
        pet_ct: pet, special_orders: special,
        notes_to_physics: notes,
        sim_date_requested: simDate || null
      })
      setSaved(res)
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  function openPrint() {
    const d = {
      name: patient?.full_name||'—', dob: patient?.date_of_birth||'', gender: patient?.gender||'',
      diagnosis: patient?.diagnosis||'—', simDate, doctor: user?.full_name||'', clinic: user?.clinic_affiliation||'',
      pos, fix, shields, bolus, bolusThick, contrast, sliceThick, scanRegion, fourDct,
      sgrt, rpm, mri, mriSeq, mriContrast, mriSlice, pet, special, notes,
      orderNum: saved?.order_ref || 'SIM-PREVIEW',
      orderDate: new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
    }
    const field=(l,v)=>v?`<div class="field"><div class="fl">${l}</div><div class="fv">${v}</div></div>`:''
    const yn=(l,v)=>v?`<div class="field"><div class="fl">${l}</div><div class="fv ${v==='Yes'?'yes':'no'}">${v}</div></div>`:''
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${d.orderNum}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#1a2636}
.header{background:#0b4f82;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:flex-start}
.h-title{font-size:15px;font-weight:700}.h-sub{font-size:11px;opacity:.6;margin-top:3px}
.h-right{text-align:right}.on{font-size:13px;font-weight:700;font-family:monospace}.od{font-size:11px;opacity:.6;margin-top:3px}
.badge{display:inline-block;background:rgba(255,255,255,.2);font-size:10px;padding:2px 8px;border-radius:20px;margin-top:5px}
.pbar{background:#f0f4f8;padding:12px 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;border-bottom:1px solid #dde3ec}
.pfl{font-size:10px;color:#8898aa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}.pfv{font-size:13px;font-weight:600}
.body{padding:18px 24px}.sec{margin-bottom:16px}
.sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#8898aa;padding-bottom:6px;border-bottom:1px solid #dde3ec;margin-bottom:10px}
.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.field{background:#f7f9fc;border-radius:6px;padding:8px 11px}.fl{font-size:10px;color:#8898aa;margin-bottom:2px}.fv{font-size:13px;font-weight:500}
.fv.yes{color:#1a7a4a}.fv.no{color:#aaa}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{background:#fef4e7;color:#7a3800;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid #f0d5b0}
.nbox{background:#f7f9fc;border-left:3px solid #0b4f82;border-radius:0 6px 6px 0;padding:10px 14px;font-size:12.5px;line-height:1.6}
.div{height:1px;background:#dde3ec;margin:14px 0}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}
.sb{border-top:1px solid #dde3ec;padding-top:8px}.sl{font-size:10px;color:#8898aa}.sn{font-size:13px;font-weight:600;margin-top:18px}
.footer{background:#f0f4f8;border-top:1px solid #dde3ec;padding:9px 24px;font-size:10.5px;color:#8898aa;text-align:center}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="header">
  <div><div class="h-title">Advanced Cancer Management Center</div><div class="h-sub">Radiotherapy &amp; Oncology — Simulation Order</div></div>
  <div class="h-right"><div class="on">${d.orderNum}</div><div class="od">${d.orderDate}</div><div class="badge">PENDING SCHEDULING</div></div>
</div>
<div class="pbar">
  <div><div class="pfl">Patient</div><div class="pfv">${d.name}</div></div>
  <div><div class="pfl">Date of birth</div><div class="pfv">${fmtDatePrint(d.dob)}${d.gender?' · '+d.gender:''}</div></div>
  <div><div class="pfl">Diagnosis</div><div class="pfv">${d.diagnosis}</div></div>
  <div><div class="pfl">Referring physician</div><div class="pfv">${d.doctor}</div></div>
  <div><div class="pfl">Clinic</div><div class="pfv">${d.clinic}</div></div>
  <div><div class="pfl">Requested sim date</div><div class="pfv">${fmtDatePrint(d.simDate)}</div></div>
</div>
<div class="body">
  <div class="sec"><div class="sec-title">Setup &amp; Immobilization</div><div class="fields">
    ${field('Positioning',d.pos)}${field('Fixation device',d.fix)}
    ${field('Bolus',d.bolus==='Yes'?(d.bolusThick?'Yes · '+d.bolusThick+'mm':'Yes'):d.bolus)}
    ${d.shields.length?`<div class="field"><div class="fl">Shielding</div><div class="fv">${d.shields.join(', ')}</div></div>`:''}
  </div></div>
  <div class="sec"><div class="sec-title">CT Simulation</div><div class="fields">
    ${field('Contrast',d.contrast)}${field('Slice thickness',d.sliceThick?d.sliceThick+' mm':null)}
    ${field('Scan region',d.scanRegion)}${yn('4D-CT',d.fourDct)}
  </div></div>
  <div class="sec"><div class="sec-title">Motion Management &amp; Additional Imaging</div><div class="fields">
    ${yn('SGRT (Identify)',d.sgrt)}${yn('Respiratory gating (RPM)',d.rpm)}
    ${yn('MRI simulation',d.mri)}
    ${d.mri==='Yes'?field('MRI sequence',d.mriSeq):''}
    ${d.mri==='Yes'?field('MRI contrast',d.mriContrast):''}
    ${d.mri==='Yes'&&d.mriSlice?field('MRI slice thickness',d.mriSlice+' mm'):''}
    ${yn('PET-CT simulation',d.pet)}
  </div></div>
  ${d.special.length?`<div class="sec"><div class="sec-title">Special Preparation Orders</div><div class="chips">${d.special.map(s=>`<span class="chip">${s}</span>`).join('')}</div></div>`:''}
  ${d.notes.trim()?`<div class="sec"><div class="sec-title">Notes to Physics Team</div><div class="nbox">${d.notes}</div></div>`:''}
  <div class="div"></div>
  <div class="sig">
    <div class="sb"><div class="sl">Referring physician</div><div class="sn">${d.doctor}</div></div>
    <div class="sb"><div class="sl">Received by (ACMC physics team)</div><div class="sn" style="color:#ccc">______________________________</div></div>
  </div>
</div>
<div class="footer">ACMC · Simulation Order · ${d.orderNum} · Generated by ACMC Referring Physician Portal</div>
</body></html>`
    const w=window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600)
  }

  const filled = [pos,fix,contrast,sgrt,rpm,mri,pet,bolus].filter(Boolean).length
  const card = {background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 20px',marginBottom:10}

  return (
    <div>
      <div style={{marginBottom:20}}>
        <button onClick={()=>navigate(patientId?'patient-detail':'patients',{patientId})} style={{background:'none',border:'none',color:'#0b4f82',cursor:'pointer',fontSize:13,fontWeight:500,marginBottom:8,padding:0}}>← Back</button>
        <h1 style={{fontSize:22,fontWeight:700}}>Simulation Order</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Fill in all relevant sections then save and print for ACMC.</p>
      </div>

      {patient && (
        <div style={{...card,background:'#f0f6ff',border:'1px solid #c5d8f5',marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600}}>{patient.full_name}</div>
          <div style={{fontSize:12.5,color:'#4a5a70',marginTop:2}}>{patient.diagnosis||'No diagnosis recorded'}</div>
        </div>
      )}

      {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>{error}</div>}
      {saved && <div style={{background:'#e8f7ef',color:'#1a7a4a',border:'1px solid #b7e4cc',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>✓ {saved.updated ? 'Updated' : 'Saved'} as <strong>{saved.order_ref}</strong></div>}

      {/* Patient header */}
      <div style={card}>
        <div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:13}}>Patient information</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:13}}>
          <FL label="Patient name"><input style={{...inp,background:'#f7f9fc',color:'#8898aa'}} value={patient?.full_name||''} readOnly/></FL>
          <FL label="DOB / Gender"><input style={{...inp,background:'#f7f9fc',color:'#8898aa'}} value={patient ? (patient.gender||'') : ''} readOnly/></FL>
          <FL label="Requested sim date"><input style={inp} type="date" value={simDate} onChange={e=>setSimDate(e.target.value)}/></FL>
          <FL label="Referring physician"><input style={{...inp,background:'#f7f9fc',color:'#8898aa'}} value={user?.full_name||''} readOnly/></FL>
        </div>
      </div>

      <Section id="positioning" label="Positioning" icon="🧍" color="#e8f0fb" open={open.positioning} onToggle={()=>tog('positioning')} summary={pos}>
        <RadioGroup options={POSITIONING} value={pos} onChange={setPos}/>
      </Section>
      <Section id="fixation" label="Fixation / Immobilization" icon="🔒" color="#f3e8ff" open={open.fixation} onToggle={()=>tog('fixation')} summary={fix}>
        <RadioGroup options={FIXATION} value={fix} onChange={setFix}/>
      </Section>
      <Section id="shield" label="Shielding" icon="🛡️" color="#fef4e7" open={open.shield} onToggle={()=>tog('shield')} summary={shields.length?shields.join(', '):null}>
        <CheckGroup options={SHIELDS} values={shields} onChange={setShields}/>
      </Section>
      <Section id="bolus" label="Bolus" icon="📐" color="#e0f5f3" open={open.bolus} onToggle={()=>tog('bolus')} summary={bolus?(bolus==='Yes'&&bolusThick?'Yes · '+bolusThick+'mm':bolus):null}>
        <RadioGroup options={['Yes','No']} value={bolus} onChange={setBolus}/>
        {bolus==='Yes' && <div style={{marginTop:12,maxWidth:180}}><FL label="Thickness (mm)"><input style={inp} type="number" value={bolusThick} onChange={e=>setBolusThick(e.target.value)} placeholder="e.g. 5"/></FL></div>}
      </Section>
      <Section id="ct" label="CT Simulation" icon="🔬" color="#e8f0fb" open={open.ct} onToggle={()=>tog('ct')} summary={[contrast,sliceThick?sliceThick+'mm':'',fourDct?'4D:'+fourDct:''].filter(Boolean).join(' · ')||null}>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11.5,fontWeight:600,color:'#4a5a70',marginBottom:8}}>Contrast</div>
          <RadioGroup options={['With contrast','No contrast']} value={contrast} onChange={setContrast}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13}}>
          <FL label="Slice thickness (mm)"><input style={inp} type="number" value={sliceThick} onChange={e=>setSliceThick(e.target.value)} placeholder="e.g. 3"/></FL>
          <FL label="Scan region / site"><input style={inp} value={scanRegion} onChange={e=>setScanRegion(e.target.value)} placeholder="e.g. Pelvis, Thorax"/></FL>
        </div>
        <div style={{borderTop:'1px solid #dde3ec',paddingTop:13}}>
          <div style={{fontSize:11.5,fontWeight:600,color:'#4a5a70',marginBottom:8}}>4D-CT (respiratory motion)</div>
          <RadioGroup options={['Yes','No']} value={fourDct} onChange={setFourDct}/>
        </div>
      </Section>
      <Section id="sgrt" label="SGRT – Surface Guided RT (Identify)" icon="📡" color="#eef2ff" open={open.sgrt} onToggle={()=>tog('sgrt')} summary={sgrt}>
        <RadioGroup options={['Yes','No']} value={sgrt} onChange={setSgrt}/>
      </Section>
      <Section id="rpm" label="Respiratory Gating (RPM / ARMS)" icon="🫁" color="#e0f5f3" open={open.rpm} onToggle={()=>tog('rpm')} summary={rpm}>
        <RadioGroup options={['Yes','No']} value={rpm} onChange={setRpm}/>
      </Section>
      <Section id="mri" label="MRI Simulation" icon="🧲" color="#fdecea" open={open.mri} onToggle={()=>tog('mri')} summary={mri}>
        <RadioGroup options={['Yes','No']} value={mri} onChange={setMri}/>
        {mri==='Yes' && (
          <div style={{background:'#fafbfc',borderRadius:8,padding:13,marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:13}}>
            <FL label="Sequence"><input style={inp} value={mriSeq} onChange={e=>setMriSeq(e.target.value)} placeholder="e.g. T2, VIBE, DWI"/></FL>
            <FL label="Contrast"><select style={inp} value={mriContrast} onChange={e=>setMriContrast(e.target.value)}><option value="">Select</option><option>Yes</option><option>No</option></select></FL>
            <FL label="Slice thickness (mm)"><input style={inp} type="number" value={mriSlice} onChange={e=>setMriSlice(e.target.value)} placeholder="e.g. 2"/></FL>
          </div>
        )}
      </Section>
      <Section id="pet" label="PET-CT Simulation" icon="⚛️" color="#fef4e7" open={open.pet} onToggle={()=>tog('pet')} summary={pet}>
        <RadioGroup options={['Yes','No']} value={pet} onChange={setPet}/>
      </Section>
      <Section id="special" label="Special Preparation Orders" icon="📋" color="#fdecea" open={open.special} onToggle={()=>tog('special')} summary={special.length?special.length+' orders':null}>
        <CheckGroup options={SPECIAL} values={special} onChange={setSpecial}/>
      </Section>
      <Section id="notes" label="Notes to Physics Team" icon="📝" color="#f7f9fc" open={open.notes} onToggle={()=>tog('notes')} summary={notes.trim()?'Added':null}>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions, clinical context, or requests for the physics/simulation team…"
          style={{width:'100%',minHeight:80,border:'1px solid #dde3ec',borderRadius:7,padding:'10px 12px',fontSize:13,fontFamily:'inherit',resize:'vertical',outline:'none'}}/>
      </Section>

      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'13px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',bottom:14}}>
        <div style={{fontSize:12.5,color:'#8898aa'}}>{filled} / 8 core fields filled</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={submit} disabled={saving} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>💾 Save</button>
          <button onClick={openPrint} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #dde3ec",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>🖨️ Print only</button>
          <button onClick={async()=>{await submit();openPrint()}} disabled={saving}
            style={{padding:'8px 20px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
            {saving?'Saving…':'💾 Save & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
