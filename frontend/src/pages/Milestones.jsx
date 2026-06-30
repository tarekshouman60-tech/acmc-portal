import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'

export default function Milestones({ navigate }) {
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { api.patients().then(setPatients) }, [])

  async function load(pid) {
    setSelected(pid)
    const d = await api.getPatient(pid)
    setDetail(d)
    setForm(d.milestones || {})
  }

  async function save() {
    setSaving(true)
    await api.updateMilestones(selected, form)
    await load(selected)
    setSaving(false)
  }

  async function testNotify(pid) {
    setNotifyMsg('Sending…')
    try {
      await api.notifyTest(pid, 'simulation_done')
      setNotifyMsg('✓ Test email sent — check the doctor\'s inbox (and spam folder).')
    } catch(e) {
      setNotifyMsg('✗ Failed: ' + e.message)
    }
  }

  const filtered = patients.filter(p=>p.full_name.toLowerCase().includes(search.toLowerCase()))
  const inp = {border:'1px solid #dde3ec',borderRadius:5,padding:'6px 9px',fontSize:13,fontFamily:'inherit',outline:'none'}

  return (
    <div>
      <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700}}>Treatment Milestones</h1><p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Update patient progress for all referred cases.</p></div>
      <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:16,alignItems:'start'}}>
        {/* Patient list */}
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'12px 14px',borderBottom:'1px solid #dde3ec'}}>
            <input style={{...inp,width:'100%'}} placeholder="Search patients…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {filtered.map(p=>(
            <div key={p.id} onClick={()=>load(p.id)}
              style={{padding:'11px 14px',cursor:'pointer',borderBottom:'1px solid #f0f4f8',
                background:selected===p.id?'#f0f6ff':'#fff'}}>
              <div style={{fontSize:13,fontWeight:selected===p.id?600:400}}>{p.full_name}</div>
              <div style={{fontSize:11.5,color:'#8898aa',marginTop:2}}>{p.doctor_name}</div>
            </div>
          ))}
        </div>

        {/* Milestone editor */}
        {detail ? (
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'20px'}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{detail.patient.full_name}</div>
            <div style={{fontSize:12.5,color:'#4a5a70',marginBottom:18}}>{detail.patient.diagnosis}</div>
            {[
              {key:'simulation',label:'CT Simulation',dateKey:'simulation_date'},
              {key:'planning',label:'Treatment Planning',dateKey:'planning_date'},
              {key:'treatment_started',label:'Treatment Started',dateKey:'treatment_start_date'},
              {key:'treatment_completed',label:'Treatment Completed',dateKey:'treatment_end_date'},
            ].map(({key,label,dateKey})=>(
              <div key={key} style={{display:'grid',gridTemplateColumns:'1fr auto auto',alignItems:'center',gap:14,padding:'12px 0',borderBottom:'1px solid #f0f4f8'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{label}</div>
                  {form[dateKey] && <div style={{fontSize:11.5,color:'#1a7a4a',marginTop:2}}>✓ {fmtDate(form[dateKey])}</div>}
                </div>
                <input type="date" style={inp} value={form[dateKey]||''} onChange={e=>setForm(f=>({...f,[dateKey]:e.target.value}))}/>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                  <input type="checkbox" checked={!!form[key+'_done']} onChange={e=>setForm(f=>({...f,[key+'_done']:e.target.checked}))} style={{width:16,height:16,cursor:'pointer'}}/>
                  Done
                </label>
              </div>
            ))}
            <div style={{marginTop:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5}}>Notes</label>
              <textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3}
                style={{...inp,width:'100%',resize:'vertical'}} placeholder="Optional notes about the patient's progress…"/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:14,alignItems:'center'}}>
              <button onClick={()=>testNotify(selected)} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #dde3ec',background:'#fff',color:'#0b4f82',cursor:'pointer',fontSize:12.5,fontWeight:500}}>
                📧 Test notification email
              </button>
              <button onClick={save} disabled={saving} style={{padding:'9px 20px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Save Milestones'}</button>
            </div>
            {notifyMsg && <div style={{marginTop:10,fontSize:12.5,color:'#1a7a4a',background:'#e8f7ef',padding:'8px 12px',borderRadius:6}}>{notifyMsg}</div>}
          </div>
        ) : (
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:40,textAlign:'center',color:'#8898aa',fontSize:13}}>
            Select a patient from the list to update their milestones.
          </div>
        )}
      </div>
    </div>
  )
}
