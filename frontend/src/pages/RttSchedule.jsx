import React, { useEffect, useState } from 'react'
import { api, fmtDate, fmtDateTime, fmtDateTimeInput } from '../api.js'

const inp = {width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}
const FL = ({label,children}) => <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{label}</label>{children}</div>

const STATUS_META = {
  pending:   {bg:'#fef4e7',color:'#e67e22',label:'Pending'},
  scheduled: {bg:'#eef2ff',color:'#4338ca',label:'Scheduled'},
  done:      {bg:'#e8f7ef',color:'#1a7a4a',label:'Done'},
  cancelled: {bg:'#f0f4f8',color:'#8898aa',label:'Cancelled'},
}
function Badge({status}) {
  const s = STATUS_META[status] || STATUS_META.pending
  return <span style={{background:s.bg,color:s.color,fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20,whiteSpace:'nowrap'}}>{s.label}</span>
}

function RequestDetail({ o }) {
  const rows = [
    ['Positioning', o.positioning], ['Fixation', o.fixation],
    ['Shielding', o.shields?.join(', ')], ['Bolus', o.bolus==='Yes'&&o.bolus_thickness ? `Yes · ${o.bolus_thickness}mm` : o.bolus],
    ['CT contrast', o.ct_contrast], ['CT slice', o.ct_slice_thickness&&o.ct_slice_thickness+'mm'], ['Scan region', o.ct_scan_region],
    ['4D-CT', o.ct_4d], ['SGRT', o.sgrt], ['Respiratory gating', o.rpm],
    ['MRI-sim', o.mri], ['PET-CT sim', o.pet_ct],
    ['Special prep', o.special_orders?.join(', ')],
  ].filter(([,v])=>v)
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,marginBottom:14}}>
      {rows.map(([l,v])=>(
        <div key={l} style={{background:'#f7f9fc',borderRadius:6,padding:'8px 11px'}}>
          <div style={{fontSize:10,color:'#8898aa',marginBottom:2,textTransform:'uppercase',letterSpacing:'.03em'}}>{l}</div>
          <div style={{fontSize:12.5,fontWeight:500}}>{v}</div>
        </div>
      ))}
      {o.notes_to_physics && (
        <div style={{gridColumn:'1/-1',background:'#f0f4f8',borderLeft:'3px solid #0b4f82',borderRadius:'0 6px 6px 0',padding:'9px 13px'}}>
          <div style={{fontSize:10,color:'#8898aa',marginBottom:2,textTransform:'uppercase',letterSpacing:'.03em'}}>Notes to physics team</div>
          <div style={{fontSize:12.5}}>{o.notes_to_physics}</div>
        </div>
      )}
    </div>
  )
}

function ManageRow({ o, onSaved, onClose }) {
  const [scheduledAt, setScheduledAt] = useState(fmtDateTimeInput(o.scheduled_at))
  const [status, setStatus] = useState(o.status || 'pending')
  const [notes, setNotes] = useState(o.completion_notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      await api.updateRttSimOrder(o.id, {
        scheduled_at: scheduledAt || null,
        status,
        completion_notes: notes,
      })
      onSaved()
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{background:'#fafbfc',borderTop:'1px solid #dde3ec',padding:'16px 20px'}}>
      <RequestDetail o={o}/>
      {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:6,padding:'9px 13px',fontSize:13,marginBottom:12}}>{error}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13}}>
        <FL label="Reserve simulation time">
          <input style={inp} type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/>
        </FL>
        <FL label="Status">
          <select style={inp} value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </FL>
      </div>
      <FL label="Documentation — what was done">
        <textarea style={{...inp,resize:'vertical',minHeight:70}} value={notes} onChange={e=>setNotes(e.target.value)}
          placeholder="e.g. CT sim completed supine, head & neck mask fitted, no complications. Images sent to planning."/>
      </FL>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:13}}>
        <button onClick={onClose} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #dde3ec',background:'transparent',cursor:'pointer',fontSize:13}}>Close</button>
        <button onClick={save} disabled={saving} style={{padding:'8px 18px',borderRadius:6,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
          {saving?'Saving…':'💾 Save'}
        </button>
      </div>
    </div>
  )
}

export default function RttSchedule() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  function load() {
    api.rttSimOrders().then(d=>{setOrders(d); setLoading(false)}).catch(e=>{setError(e.message); setLoading(false)})
  }
  useEffect(load, [])

  const filtered = orders
    .filter(o => filter==='all' || o.status===filter)
    .filter(o => !search || [o.patient_name, o.diagnosis, o.doctor_name, o.order_ref].some(v => (v||'').toLowerCase().includes(search.toLowerCase())))

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Simulation Schedule</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Reserve simulation slots and document completed CT-sims for all patients.</p>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {['all','pending','scheduled','done','cancelled'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'6px 14px',borderRadius:20,border:'1px solid #dde3ec',
              background:filter===f?'#0b4f82':'#fff',color:filter===f?'#fff':'#4a5a70',
              cursor:'pointer',fontSize:12.5,fontWeight:500,textTransform:'capitalize'}}>
            {f}
          </button>
        ))}
        <input style={{...inp,maxWidth:260,marginLeft:'auto'}} placeholder="Search by patient, doctor, ref…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
        {error ? <div style={{padding:24,color:'#c0392b',fontSize:13}}>{error}</div> : loading
          ? <div style={{padding:40,textAlign:'center'}}><div style={{width:28,height:28,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div>
          : filtered.length===0
            ? <div style={{padding:40,textAlign:'center',color:'#8898aa',fontSize:13}}>No simulation orders found.</div>
            : <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f7f9fc'}}>
                  {['Ref','Patient','Doctor','Requested','Reserved','Status',''].map(h=>(
                    <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(o=>(
                    <React.Fragment key={o.id}>
                      <tr onClick={()=>setExpanded(expanded===o.id?null:o.id)} style={{borderBottom:'1px solid #f0f4f8',cursor:'pointer',background:expanded===o.id?'#f0f6ff':'#fff'}}>
                        <td style={{padding:'11px 16px',fontSize:12,fontFamily:'monospace',color:'#4a5a70'}}>{o.order_ref}</td>
                        <td style={{padding:'11px 16px',fontSize:13,fontWeight:500}}>{o.patient_name}</td>
                        <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70'}}>{o.doctor_name}</td>
                        <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70'}}>{fmtDate(o.sim_date_requested)}</td>
                        <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70'}}>{o.scheduled_at ? fmtDateTime(o.scheduled_at) : '—'}</td>
                        <td style={{padding:'11px 16px'}}><Badge status={o.status}/></td>
                        <td style={{padding:'11px 16px',textAlign:'right'}}>
                          <span style={{fontSize:12,color:'#0b4f82',fontWeight:500}}>{expanded===o.id?'Close ▲':'Manage ▾'}</span>
                        </td>
                      </tr>
                      {expanded===o.id && (
                        <tr><td colSpan={7} style={{padding:0}}>
                          <ManageRow o={o} onClose={()=>setExpanded(null)} onSaved={()=>{setExpanded(null); load()}}/>
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
        }
      </div>
    </div>
  )
}
