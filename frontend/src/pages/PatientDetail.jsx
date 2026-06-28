import React, { useEffect, useState } from 'react'
import { api, fmtEGP, fmtDate } from '../api.js'
import { useAuth } from '../App.jsx'
import { StatusBadge, StatusDropdown } from '../components/StatusBadge.jsx'

function MilestoneStep({ label, done, date }) {
  return (
    <div style={{flex:1,textAlign:'center'}}>
      <div style={{width:28,height:28,borderRadius:'50%',margin:'0 auto',position:'relative',zIndex:1,
        background:done?'#1a7a4a':'#fff',border:done?'none':'2px solid #dde3ec',
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff'}}>
        {done?'✓':''}
      </div>
      <div style={{fontSize:11,fontWeight:600,color:done?'#1a7a4a':'#8898aa',marginTop:6}}>{label}</div>
      {date && <div style={{fontSize:10.5,color:'#8898aa',marginTop:2}}>{fmtDate(date)}</div>}
    </div>
  )
}

function MilestoneTimeline({ milestones }) {
  const steps = [
    { label:'CT Simulation',      done: milestones.simulation_done,      date: milestones.simulation_date },
    { label:'Treatment Planning', done: milestones.planning_done,        date: milestones.planning_date },
    { label:'Treatment Started',  done: milestones.treatment_started,    date: milestones.treatment_start_date },
    { label:'Treatment Completed',done: milestones.treatment_completed,  date: milestones.treatment_end_date },
  ]
  return (
    <div>
      {/* Dot track */}
      <div style={{display:'flex',gap:0,position:'relative',marginBottom:20}}>
        <div style={{position:'absolute',top:14,left:'12.5%',right:'12.5%',height:2,background:'#dde3ec',zIndex:0}}/>
        {steps.map(s => (
          <div key={s.label} style={{flex:1,textAlign:'center'}}>
            <div style={{width:28,height:28,borderRadius:'50%',margin:'0 auto',position:'relative',zIndex:1,
              background:s.done?'#1a7a4a':'#fff',border:s.done?'none':'2px solid #dde3ec',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff'}}>
              {s.done?'✓':''}
            </div>
            <div style={{fontSize:11,fontWeight:600,color:s.done?'#1a7a4a':'#8898aa',marginTop:6}}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* Clear date cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
        {steps.map(s => (
          <div key={s.label} style={{
            background: s.done ? '#e8f7ef' : '#f7f9fc',
            border: `1px solid ${s.done ? '#b7e4cc' : '#dde3ec'}`,
            borderRadius:8, padding:'10px 14px'
          }}>
            <div style={{fontSize:10.5,fontWeight:700,color:s.done?'#1a7a4a':'#8898aa',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{s.label}</div>
            {s.done
              ? <div style={{fontSize:13,fontWeight:600,color:'#1a7a4a'}}>✓ {fmtDate(s.date)}</div>
              : <div style={{fontSize:12.5,color:'#aaa',fontStyle:'italic'}}>Not yet done</div>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

const MILESTONE_FIELDS = [
  {doneKey:'simulation_done',    dateKey:'simulation_date',      label:'CT Simulation'},
  {doneKey:'planning_done',      dateKey:'planning_date',        label:'Treatment Planning'},
  {doneKey:'treatment_started',  dateKey:'treatment_start_date', label:'Treatment Started'},
  {doneKey:'treatment_completed',dateKey:'treatment_end_date',   label:'Treatment Completed'},
]

function MilestoneEditor({ patientId, milestones, onSaved }) {
  const [form, setForm] = useState(milestones || {})
  const [saving, setSaving] = useState(false)
  const inp = {border:'1px solid #dde3ec',borderRadius:5,padding:'6px 9px',fontSize:13,fontFamily:'inherit',outline:'none'}

  async function save() {
    setSaving(true)
    try {
      await api.updateMilestones(patientId, form)
      onSaved(form)
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{marginTop:16,borderTop:'1px solid #dde3ec',paddingTop:16}}>
      {MILESTONE_FIELDS.map(({doneKey,dateKey,label}) => (
        <div key={doneKey} style={{display:'grid',gridTemplateColumns:'1fr auto auto',alignItems:'center',gap:14,padding:'10px 0',borderBottom:'1px solid #f0f4f8'}}>
          <div style={{fontSize:13,fontWeight:500}}>{label}</div>
          <input type="date" style={inp} value={form[dateKey]||''} onChange={e=>setForm(f=>({...f,[dateKey]:e.target.value}))}/>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13,whiteSpace:'nowrap'}}>
            <input type="checkbox" checked={!!form[doneKey]} onChange={e=>setForm(f=>({...f,[doneKey]:e.target.checked}))}
              style={{width:16,height:16,cursor:'pointer'}}/>
            Done
          </label>
        </div>
      ))}
      <div style={{marginTop:12}}>
        <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Notes</label>
        <textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}
          style={{...inp,width:'100%',resize:'vertical'}} placeholder="Optional progress notes…"/>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
        <button onClick={save} disabled={saving}
          style={{padding:'8px 18px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
          {saving?'Saving…':'Save Milestones'}
        </button>
      </div>
    </div>
  )
}

export default function PatientDetail({ navigate, patientId }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMilestones, setEditMilestones] = useState(false)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    api.getPatient(patientId).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [patientId])

  function updateOrderStatus(type, id, newStatus) {
    setData(d => ({
      ...d,
      sim_orders:      type==='sim'      ? d.sim_orders.map(o=>o.id===id?{...o,status:newStatus}:o)      : d.sim_orders,
      clinical_orders: type==='clinical' ? d.clinical_orders.map(o=>o.id===id?{...o,status:newStatus}:o) : d.clinical_orders,
      cost_estimates:  type==='estimate' ? d.cost_estimates.map(o=>o.id===id?{...o,status:newStatus}:o)  : d.cost_estimates,
    }))
  }

  if (loading) return <div style={{padding:40,textAlign:'center'}}><div style={{width:32,height:32,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div>
  if (!data) return <div style={{padding:40,color:'#c0392b'}}>Patient not found.</div>

  const { patient, sim_orders, clinical_orders, cost_estimates, milestones, billing, payments } = data

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <button onClick={()=>navigate('patients')} style={{background:'none',border:'none',color:'#0b4f82',cursor:'pointer',fontSize:13,fontWeight:500,marginBottom:8,padding:0}}>← Back to patients</button>
          <h1 style={{fontSize:22,fontWeight:700}}>{patient.full_name}</h1>
          <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>{patient.diagnosis||'No diagnosis recorded'}</p>
        </div>
        {!isAdmin && (
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>navigate('sim-order',{patientId})} style={{padding:'8px 14px',borderRadius:7,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:500}}>+ Sim Order</button>
            <button onClick={()=>navigate('clinical-order',{patientId})} style={{padding:'8px 14px',borderRadius:7,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:500}}>+ Clinical Order</button>
            <button onClick={()=>navigate('cost-estimate',{patientId})} style={{padding:'8px 14px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:600}}>+ Cost Estimate</button>
          </div>
        )}
      </div>

      {/* Patient info */}
      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 22px',marginBottom:12,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:14}}>
        {[['DOB',fmtDate(patient.date_of_birth)],['Gender',patient.gender||'—'],['National ID',patient.national_id||'—'],['Phone',patient.phone||'—'],['ICD-10',patient.icd10_code||'—'],[isAdmin?'Referring Dr':'Registered',isAdmin?(patient.doctor_name||'—'):fmtDate(patient.created_at)]].map(([l,v])=>(
          <div key={l}><div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>{l}</div><div style={{fontSize:13,fontWeight:500}}>{v}</div></div>
        ))}
      </div>

      {/* Milestones */}
      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 22px',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em'}}>Treatment progress</div>
          {isAdmin && (
            <button onClick={()=>setEditMilestones(e=>!e)}
              style={{padding:'5px 12px',borderRadius:6,border:'1px solid #dde3ec',background:editMilestones?'#0b4f82':'#fff',
                color:editMilestones?'#fff':'#0b4f82',cursor:'pointer',fontSize:12,fontWeight:600}}>
              {editMilestones ? '✕ Close' : '✏️ Edit Milestones'}
            </button>
          )}
        </div>

        {milestones
          ? <MilestoneTimeline milestones={milestones}/>
          : <div style={{color:'#8898aa',fontSize:13}}>No milestones recorded yet.</div>
        }

        {milestones?.notes && !editMilestones && (
          <div style={{marginTop:12,fontSize:12.5,color:'#4a5a70',borderTop:'1px solid #f0f4f8',paddingTop:10}}>
            <strong>Notes:</strong> {milestones.notes}
          </div>
        )}

        {isAdmin && editMilestones && (
          <MilestoneEditor
            patientId={patientId}
            milestones={milestones}
            onSaved={updated => {
              setData(d => ({...d, milestones: {...d.milestones, ...updated}}))
              setEditMilestones(false)
            }}
          />
        )}
      </div>

      {/* Orders tables */}
      {[
        {title:'Simulation Orders',         items:sim_orders,     type:'sim',      cols:['Ref','Sim Date','Status']},
        {title:'Clinical Treatment Orders', items:clinical_orders, type:'clinical', cols:['Ref','Technique','Dose','Status']},
        {title:'Cost Estimates',            items:cost_estimates,  type:'estimate', cols:['Ref','Total (EGP)','Status']},
      ].map(({title,items,type,cols})=>(
        <div key={type} style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,marginBottom:12,overflow:'hidden'}}>
          <div style={{padding:'13px 20px',borderBottom:'1px solid #dde3ec',fontWeight:600,fontSize:13.5}}>
            {title} <span style={{color:'#8898aa',fontWeight:400,fontSize:12}}>({items.length})</span>
          </div>
          {items.length===0
            ? <div style={{padding:'18px 20px',color:'#8898aa',fontSize:13}}>No {title.toLowerCase()} yet.</div>
            : <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  {cols.map(c=><th key={c} style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec',background:'#fafbfc'}}>{c}</th>)}
                </tr></thead>
                <tbody>
                  {items.map(item=>(
                    <tr key={item.id} style={{borderBottom:'1px solid #f0f4f8'}}>
                      <td style={{padding:'10px 16px',fontSize:12.5,fontFamily:'monospace'}}>{item.order_ref}</td>
                      {type==='sim' && <td style={{padding:'10px 16px',fontSize:12.5,color:'#4a5a70'}}>{fmtDate(item.sim_date_requested)}</td>}
                      {type==='clinical' && <>
                        <td style={{padding:'10px 16px',fontSize:12.5,color:'#4a5a70'}}>{item.technique||'—'}</td>
                        <td style={{padding:'10px 16px',fontSize:12.5,color:'#4a5a70'}}>{item.total_dose_gy?item.total_dose_gy+'Gy/'+item.fractions+'F':'—'}</td>
                      </>}
                      {type==='estimate' && <td style={{padding:'10px 16px',fontSize:12.5,color:'#4a5a70'}}>{item.total_egp?fmtEGP(item.total_egp)+(item.has_tbd?' + TBD':''):'TBD'}</td>}
                      <td style={{padding:'10px 16px'}}>
                        {isAdmin && adminEdit
                          ? <StatusDropdown type={type} id={item.id} currentStatus={item.status}
                              onUpdated={s=>updateOrderStatus(type,item.id,s)}/>
                          : <StatusBadge status={item.status} doctorView={!isAdmin}/>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      ))}

      {/* Billing */}
      {billing && (
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 22px',marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:14}}>Billing</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:12}}>
            {[['Total',fmtEGP(billing.total_amount_egp)],['Paid',fmtEGP(billing.amount_paid_egp)],['Balance',fmtEGP(billing.balance_egp)]].map(([l,v])=>(
              <div key={l} style={{background:'#f7f9fc',borderRadius:8,padding:'12px 16px'}}>
                <div style={{fontSize:10.5,color:'#8898aa',marginBottom:3,textTransform:'uppercase',fontWeight:700,letterSpacing:'.04em'}}>{l}</div>
                <div style={{fontSize:16,fontWeight:700,fontFamily:'monospace'}}>{v}</div>
              </div>
            ))}
          </div>
          <StatusBadge status={billing.status}/>
          {payments.length>0 && (
            <div style={{marginTop:14,borderTop:'1px solid #f0f4f8',paddingTop:12}}>
              <div style={{fontSize:11,fontWeight:700,color:'#8898aa',marginBottom:8}}>PAYMENT HISTORY</div>
              {payments.map(p=>(
                <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:12.5,padding:'5px 0',borderBottom:'1px solid #f7f9fc'}}>
                  <span style={{color:'#4a5a70'}}>{fmtDate(p.payment_date)} · {p.method}</span>
                  <span style={{fontWeight:600,color:'#1a7a4a'}}>{fmtEGP(p.amount_egp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
