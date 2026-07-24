import React, { useEffect, useState } from 'react'
import { api, fmtDate, fmtDateTime, fmtDateTimeInput } from '../api.js'
import { useAuth } from '../App.jsx'
import { AttachmentUploader, AttachmentGallery } from '../components/Attachments.jsx'
import MessageThread from '../components/MessageThread.jsx'

const inp = {width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}
const FL = ({label,children}) => <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{label}</label>{children}</div>

const STATUS_META = {
  pending:     {bg:'#fef4e7',color:'#e67e22',label:'Pending'},
  in_progress: {bg:'#eef2ff',color:'#4338ca',label:'In Progress'},
  completed:   {bg:'#e8f7ef',color:'#1a7a4a',label:'Completed'},
  cancelled:   {bg:'#f0f4f8',color:'#8898aa',label:'Cancelled'},
}
function Badge({status}) {
  const s = STATUS_META[status] || STATUS_META.pending
  return <span style={{background:s.bg,color:s.color,fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20,whiteSpace:'nowrap'}}>{s.label}</span>
}

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day===0 ? -6 : 1) - day
  date.setDate(date.getDate()+diff)
  date.setHours(0,0,0,0)
  return date
}
function addDays(d,n) { const x = new Date(d); x.setDate(x.getDate()+n); return x }
function sameDay(a,b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function fmtDayHeader(d) { return d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'}) }
function fmtTime(d) { return new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) }
function fmtWeekRange(start) {
  const end = addDays(start,6)
  const sameMonth = start.getMonth()===end.getMonth()
  const s = start.toLocaleDateString('en-GB',{day:'2-digit',month: sameMonth?undefined:'short'})
  const e = end.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
  return `${s} – ${e}`
}

function RequestDetail({ o }) {
  const rows = [
    ['Technique', o.technique], ['Treatment site', o.treatment_site],
    ['Dose', o.total_dose_gy && `${o.total_dose_gy}Gy / ${o.fractions}F`],
    ['Duration', o.duration_weeks && `${o.duration_weeks} weeks`],
    ['Dose/fraction', o.dose_per_fraction_gy && `${o.dose_per_fraction_gy}Gy`],
    ['Intent', o.intent], ['Sequence', o.sequence],
    ['SGRT', o.sgrt], ['DIBH', o.dibh], ['IGRT', o.igrt],
  ].filter(([,v])=>v)
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,marginBottom:14}}>
      {o.clinical_history && (
        <div style={{gridColumn:'1/-1',fontSize:12.5,color:'#4a5a70',lineHeight:1.6}}>{o.clinical_history}</div>
      )}
      {rows.map(([l,v])=>(
        <div key={l} style={{background:'#f7f9fc',borderRadius:6,padding:'8px 11px'}}>
          <div style={{fontSize:10,color:'#8898aa',marginBottom:2,textTransform:'uppercase',letterSpacing:'.03em'}}>{l}</div>
          <div style={{fontSize:12.5,fontWeight:500}}>{v}</div>
        </div>
      ))}
      {o.special_instructions && (
        <div style={{gridColumn:'1/-1',background:'#f0f4f8',borderLeft:'3px solid #0b4f82',borderRadius:'0 6px 6px 0',padding:'9px 13px'}}>
          <div style={{fontSize:10,color:'#8898aa',marginBottom:2,textTransform:'uppercase',letterSpacing:'.03em'}}>Special instructions</div>
          <div style={{fontSize:12.5}}>{o.special_instructions}</div>
        </div>
      )}
    </div>
  )
}

function ManageRow({ o, onSaved, onClose }) {
  const [scheduledAt, setScheduledAt] = useState(fmtDateTimeInput(o.planning_scheduled_at))
  const [status, setStatus] = useState(o.planning_status || 'pending')
  const [notes, setNotes] = useState(o.planning_notes || '')
  const [saving, setSaving] = useState(false)
  const [replanning, setReplanning] = useState(false)
  const [error, setError] = useState('')
  const [attachRefresh, setAttachRefresh] = useState(0)

  async function save() {
    setSaving(true); setError('')
    try {
      await api.updatePhysicistClinicalOrder(o.id, {
        planning_scheduled_at: scheduledAt || null,
        status,
        planning_notes: notes,
      })
      onSaved()
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  async function replan() {
    if (!confirm('Start a new planning cycle for this patient? This resets planning status to In Progress and clears the completed date.')) return
    setReplanning(true); setError('')
    try {
      await api.updatePhysicistClinicalOrder(o.id, { replan: true })
      onSaved()
    } catch(e) { setError(e.message) } finally { setReplanning(false) }
  }

  return (
    <div style={{background:'#fafbfc',border:'1px solid #dde3ec',borderRadius:10,padding:'16px 20px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600}}>{o.patient_name} <span style={{color:'#8898aa',fontWeight:400}}>· {o.order_ref} · {o.doctor_name}</span></div>
        {o.replan_count>0 && <span style={{background:'#fdecea',color:'#c0392b',fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20}}>Replanned {o.replan_count}×</span>}
      </div>
      <RequestDetail o={o}/>
      {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:6,padding:'9px 13px',fontSize:13,marginBottom:12}}>{error}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13}}>
        <FL label="Reserve planning time">
          <input style={inp} type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/>
        </FL>
        <FL label="Planning status">
          <select style={inp} value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </FL>
      </div>
      <FL label="Documentation — what was done">
        <textarea style={{...inp,resize:'vertical',minHeight:70}} value={notes} onChange={e=>setNotes(e.target.value)}
          placeholder="e.g. VMAT plan optimized, 2 arcs, dose constraints met for OARs. Sent for physics QA."/>
      </FL>
      <div style={{marginTop:13}}>
        <AttachmentUploader orderType="clinical" orderId={o.id} onUploaded={()=>setAttachRefresh(n=>n+1)}/>
        <AttachmentGallery orderType="clinical" orderId={o.id} refreshKey={attachRefresh}/>
      </div>
      <MessageThread orderType="clinical" orderId={o.id} title="Discussion with Oncologist"/>
      <div style={{display:'flex',gap:8,justifyContent:'space-between',marginTop:13}}>
        <button onClick={replan} disabled={replanning} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #f5c6c2',background:'#fdecea',color:'#c0392b',cursor:'pointer',fontSize:13,fontWeight:600}}>
          {replanning?'Starting…':'🔁 Replan'}
        </button>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #dde3ec',background:'transparent',cursor:'pointer',fontSize:13}}>Close</button>
          <button onClick={save} disabled={saving} style={{padding:'8px 18px',borderRadius:6,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
            {saving?'Saving…':'💾 Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WeekCalendar({ orders, weekStart, setWeekStart, selectedId, onSelect }) {
  const days = [...Array(7)].map((_,i)=>addDays(weekStart,i))
  const today = new Date()
  return (
    <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 1px 2px rgba(15,23,42,.04),0 8px 20px -8px rgba(15,23,42,.08)',borderRadius:10,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #dde3ec'}}>
        <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{padding:'5px 11px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:13}}>‹ Prev</button>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:13.5,fontWeight:600}}>{fmtWeekRange(weekStart)}</span>
          <button onClick={()=>setWeekStart(startOfWeek(new Date()))} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #dde3ec',background:'#f7f9fc',cursor:'pointer',fontSize:11.5,color:'#4a5a70'}}>Today</button>
        </div>
        <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{padding:'5px 11px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:13}}>Next ›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
        {days.map(d=>{
          const dayOrders = orders
            .filter(o=>o.planning_scheduled_at && sameDay(new Date(o.planning_scheduled_at), d))
            .sort((a,b)=>new Date(a.planning_scheduled_at)-new Date(b.planning_scheduled_at))
          const isToday = sameDay(d, today)
          return (
            <div key={d.toISOString()} style={{borderRight:'1px solid #f0f4f8',minHeight:220,padding:'8px 6px'}}>
              <div style={{fontSize:11,fontWeight:700,textAlign:'center',padding:'4px 0',marginBottom:6,borderRadius:6,
                color:isToday?'#fff':'#4a5a70',background:isToday?'#0b4f82':'transparent'}}>{fmtDayHeader(d)}</div>
              {dayOrders.length===0
                ? <div style={{textAlign:'center',color:'#dde3ec',fontSize:11,marginTop:10}}>—</div>
                : dayOrders.map(o=>{
                    const s = STATUS_META[o.planning_status]||STATUS_META.pending
                    return (
                      <div key={o.id} onClick={()=>onSelect(o.id)}
                        style={{background:selectedId===o.id?'#0b4f82':s.bg,color:selectedId===o.id?'#fff':s.color,
                          borderRadius:6,padding:'6px 8px',marginBottom:5,cursor:'pointer',fontSize:11.5}}>
                        <div style={{fontWeight:700}}>{fmtTime(o.planning_scheduled_at)}</div>
                        <div style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.patient_name}</div>
                      </div>
                    )
                  })
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PhysicistPlanning() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [view, setView] = useState('list')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()))
  const [flaggedOrders, setFlaggedOrders] = useState(new Set())

  function load() {
    api.physicistClinicalOrders().then(d=>{setOrders(d); setLoading(false)}).catch(e=>{setError(e.message); setLoading(false)})
    api.unreadMessageCount().then(d=>setFlaggedOrders(new Set((d.by_order||[]).map(r=>r.order_id)))).catch(()=>{})
  }
  useEffect(load, [])

  const filtered = orders
    .filter(o => filter==='all' || (o.planning_status||'pending')===filter)
    .filter(o => !mineOnly || o.physicist_id===user?.id)
    .filter(o => !search || [o.patient_name, o.diagnosis, o.doctor_name, o.order_ref, o.technique].some(v => (v||'').toLowerCase().includes(search.toLowerCase())))

  const selected = expanded!=null ? orders.find(o=>o.id===expanded) : null

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Treatment Planning</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Reserve planning slots, document completed plans, and replan when needed — for all patients.</p>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {['all','pending','in_progress','completed','cancelled'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'6px 14px',borderRadius:20,border:'1px solid #dde3ec',
              background:filter===f?'#0b4f82':'#fff',color:filter===f?'#fff':'#4a5a70',
              cursor:'pointer',fontSize:12.5,fontWeight:500}}>
            {f==='all'?'All':f==='in_progress'?'In Progress':f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <button onClick={()=>setMineOnly(m=>!m)}
          style={{padding:'6px 14px',borderRadius:20,border:mineOnly?'1px solid #0b4f82':'1px solid #dde3ec',
            background:mineOnly?'#e8f0fb':'#fff',color:mineOnly?'#0b4f82':'#4a5a70',
            cursor:'pointer',fontSize:12.5,fontWeight:600}}>
          👤 My planning
        </button>

        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {view==='list' && <input style={{...inp,maxWidth:220}} placeholder="Search by patient, doctor, ref…" value={search} onChange={e=>setSearch(e.target.value)}/>}
          <div style={{display:'flex',border:'1px solid #dde3ec',borderRadius:20,overflow:'hidden'}}>
            {['list','calendar'].map(v=>(
              <button key={v} onClick={()=>{setView(v); setExpanded(null)}}
                style={{padding:'6px 14px',border:'none',background:view===v?'#0b4f82':'#fff',color:view===v?'#fff':'#4a5a70',
                  cursor:'pointer',fontSize:12.5,fontWeight:500,textTransform:'capitalize'}}>
                {v==='list'?'☰ List':'📅 Calendar'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>{error}</div>}

      {loading
        ? <div style={{padding:40,textAlign:'center',background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 1px 2px rgba(15,23,42,.04),0 8px 20px -8px rgba(15,23,42,.08)',borderRadius:10}}><div style={{width:28,height:28,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div>
        : view==='calendar' ? (
          <>
            <WeekCalendar orders={filtered} weekStart={weekStart} setWeekStart={setWeekStart} selectedId={expanded} onSelect={id=>setExpanded(expanded===id?null:id)}/>
            {selected && (
              <div style={{marginTop:14}}>
                <ManageRow o={selected} onClose={()=>{setExpanded(null); load()}} onSaved={()=>{setExpanded(null); load()}}/>
              </div>
            )}
          </>
        ) : (
          <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 1px 2px rgba(15,23,42,.04),0 8px 20px -8px rgba(15,23,42,.08)',borderRadius:10,overflow:'hidden'}}>
            {filtered.length===0
              ? <div style={{padding:40,textAlign:'center',color:'#8898aa',fontSize:13}}>No clinical treatment orders found.</div>
              : <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:'#f7f9fc'}}>
                    {['Ref','Patient','Doctor','Rx','Reserved','Status',''].map(h=>(
                      <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map(o=>(
                      <React.Fragment key={o.id}>
                        <tr onClick={()=>setExpanded(expanded===o.id?null:o.id)} style={{borderBottom:'1px solid #f0f4f8',cursor:'pointer',background:expanded===o.id?'#f0f6ff':'#fff'}}>
                          <td style={{padding:'11px 16px',fontSize:12,fontFamily:'monospace',color:'#4a5a70'}}>{o.order_ref}</td>
                          <td style={{padding:'11px 16px',fontSize:13,fontWeight:500}}>
                            {flaggedOrders.has(o.id) && <span title="Unread urgent message" style={{marginRight:5}}>🚩</span>}
                            {o.patient_name}
                          </td>
                          <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70'}}>{o.doctor_name}</td>
                          <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70'}}>{o.technique||'—'}{o.total_dose_gy?` · ${o.total_dose_gy}Gy/${o.fractions}F`:''}</td>
                          <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70'}}>{o.planning_scheduled_at ? fmtDateTime(o.planning_scheduled_at) : '—'}</td>
                          <td style={{padding:'11px 16px'}}>
                            <Badge status={o.planning_status||'pending'}/>
                            {o.replan_count>0 && <span style={{marginLeft:6,fontSize:10.5,color:'#c0392b',fontWeight:600}}>↻{o.replan_count}</span>}
                          </td>
                          <td style={{padding:'11px 16px',textAlign:'right'}}>
                            <span style={{fontSize:12,color:'#0b4f82',fontWeight:500}}>{expanded===o.id?'Close ▲':'Manage ▾'}</span>
                          </td>
                        </tr>
                        {expanded===o.id && (
                          <tr><td colSpan={7} style={{padding:0}}>
                            <ManageRow o={o} onClose={()=>{setExpanded(null); load()}} onSaved={()=>{setExpanded(null); load()}}/>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )
      }
    </div>
  )
}
