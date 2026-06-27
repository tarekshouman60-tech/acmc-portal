import React, { useEffect, useState } from 'react'
import { api, fmtEGP, fmtDate } from '../api.js'
import { useAuth } from '../App.jsx'
import { StatusBadge, StatusDropdown } from '../components/StatusBadge.jsx'

function Milestone({ label, done, date }) {
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

export default function PatientDetail({ navigate, patientId }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
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
        <div style={{fontSize:11,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:16}}>Treatment progress</div>
        {milestones
          ? <div style={{display:'flex',gap:0,position:'relative'}}>
              <div style={{position:'absolute',top:14,left:'12.5%',right:'12.5%',height:2,background:'#dde3ec',zIndex:0}}/>
              <Milestone label="Simulation" done={milestones.simulation_done} date={milestones.simulation_date}/>
              <Milestone label="Planning" done={milestones.planning_done} date={milestones.planning_date}/>
              <Milestone label="Treatment start" done={milestones.treatment_started} date={milestones.treatment_start_date}/>
              <Milestone label="Completed" done={milestones.treatment_completed} date={milestones.treatment_end_date}/>
            </div>
          : <div style={{color:'#8898aa',fontSize:13}}>No milestones recorded yet.</div>
        }
        {milestones?.notes && <div style={{marginTop:12,fontSize:12.5,color:'#4a5a70',borderTop:'1px solid #f0f4f8',paddingTop:10}}><strong>Notes:</strong> {milestones.notes}</div>}
      </div>

      {/* Orders tables */}
      {[
        {title:'Simulation Orders',         items:sim_orders,      type:'sim',      cols:['Ref','Sim Date','Status']},
        {title:'Clinical Treatment Orders', items:clinical_orders,  type:'clinical', cols:['Ref','Technique','Dose','Status']},
        {title:'Cost Estimates',            items:cost_estimates,   type:'estimate', cols:['Ref','Total (EGP)','Status']},
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
                        {isAdmin
                          ? <StatusDropdown type={type} id={item.id} currentStatus={item.status}
                              onUpdated={s => updateOrderStatus(type, item.id, s)}/>
                          : <StatusBadge status={item.status}/>
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
