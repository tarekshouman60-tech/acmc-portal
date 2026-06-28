import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'
import { useAuth } from '../App.jsx'
import { StatusBadge, StatusDropdown } from '../components/StatusBadge.jsx'

const TYPE_META = {
  sim:      { label:'SIM', bg:'#e8f0fb', color:'#0c447c' },
  clinical: { label:'CLN', bg:'#e0f5f3', color:'#085041' },
  estimate: { label:'EST', bg:'#fef4e7', color:'#633806' },
}

export default function AllOrders({ navigate }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fn = isAdmin ? api.allOrders : api.myOrders
    fn().then(data => { setOrders(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function updateStatus(id, type, newStatus) {
    setOrders(os => os.map(o => o.id===id && o.type===type ? {...o, status:newStatus} : o))
  }

  const filtered = filter==='all' ? orders : orders.filter(o => o.type===filter)

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700}}>{isAdmin ? 'All Orders' : 'My Orders'}</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>{filtered.length} order{filtered.length!==1?'s':''}</p>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {['all','sim','clinical','estimate'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'6px 14px',borderRadius:20,border:'1px solid #dde3ec',
              background:filter===f?'#0b4f82':'#fff',color:filter===f?'#fff':'#4a5a70',
              cursor:'pointer',fontSize:12.5,fontWeight:500}}>
            {f==='all'?'All':f==='sim'?'Simulation':f==='clinical'?'Clinical':'Cost Estimates'}
          </button>
        ))}
      </div>

      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
        {loading
          ? <div style={{padding:40,textAlign:'center'}}><div style={{width:28,height:28,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div>
          : filtered.length === 0
            ? <div style={{padding:40,textAlign:'center',color:'#8898aa',fontSize:13}}>
                No orders found.{!isAdmin && <span> Open a patient record to create your first order.</span>}
              </div>
            : <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f7f9fc'}}>
                  {['Type','Reference','Patient', isAdmin?'Doctor':null,'Date','Status'].filter(Boolean).map(h=>(
                    <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,
                      color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(o => {
                    const t = TYPE_META[o.type]
                    return (
                      <tr key={`${o.type}-${o.id}`} style={{borderBottom:'1px solid #f0f4f8',cursor:'pointer'}}
                        onClick={()=>navigate('patient-detail',{patientId:o.patient_id})}>
                        <td style={{padding:'10px 16px'}}>
                          <span style={{background:t.bg,color:t.color,fontSize:11,fontWeight:700,
                            padding:'2px 8px',borderRadius:5,fontFamily:'monospace'}}>{t.label}</span>
                        </td>
                        <td style={{padding:'10px 16px',fontSize:12,fontFamily:'monospace',color:'#4a5a70'}}>{o.order_ref}</td>
                        <td style={{padding:'10px 16px',fontSize:13,fontWeight:500}}>{o.patient}</td>
                        {isAdmin && <td style={{padding:'10px 16px',fontSize:12.5,color:'#4a5a70'}}>{o.doctor}</td>}
                        <td style={{padding:'10px 16px',fontSize:12,color:'#8898aa',whiteSpace:'nowrap'}}>{fmtDate(o.created_at)}</td>
                        <td style={{padding:'10px 16px'}} onClick={e=>e.stopPropagation()}>
                          {isAdmin
                            ? <StatusDropdown type={o.type} id={o.id} currentStatus={o.status}
                                onUpdated={s=>updateStatus(o.id,o.type,s)}/>
                            : <StatusBadge status={o.status}/>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
        }
      </div>
    </div>
  )
}
