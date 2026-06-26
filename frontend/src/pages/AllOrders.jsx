import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'

const TYPE_LABELS = { sim:{label:'SIM',bg:'#e8f0fb',color:'#0c447c'}, clinical:{label:'CLN',bg:'#e0f5f3',color:'#085041'}, estimate:{label:'EST',bg:'#fef4e7',color:'#633806'} }

export default function AllOrders({ navigate }) {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => { api.allOrders().then(setOrders) }, [])

  const filtered = filter==='all' ? orders : orders.filter(o=>o.type===filter)

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700}}>All Orders</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>{orders.length} total orders across all doctors</p>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {['all','sim','clinical','estimate'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'6px 14px',borderRadius:20,border:'1px solid #dde3ec',background:filter===f?'#0b4f82':'#fff',color:filter===f?'#fff':'#4a5a70',cursor:'pointer',fontSize:12.5,fontWeight:500}}>
            {f==='all'?'All':f==='sim'?'Simulation':f==='clinical'?'Clinical':'Cost Estimates'}
          </button>
        ))}
      </div>

      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{background:'#f7f9fc'}}>
            {['Type','Reference','Patient','Doctor','Date','Status'].map(h=>(
              <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(o => {
              const t = TYPE_LABELS[o.type]
              return (
                <tr key={`${o.type}-${o.id}`}>
                  <td style={{padding:'10px 16px',borderBottom:'1px solid #f0f4f8'}}>
                    <span style={{background:t.bg,color:t.color,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:5,fontFamily:'monospace'}}>{t.label}</span>
                  </td>
                  <td style={{padding:'10px 16px',fontSize:12,fontFamily:'monospace',color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{o.order_ref}</td>
                  <td style={{padding:'10px 16px',fontSize:13,fontWeight:500,borderBottom:'1px solid #f0f4f8'}}>{o.patient}</td>
                  <td style={{padding:'10px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{o.doctor}</td>
                  <td style={{padding:'10px 16px',fontSize:12,color:'#8898aa',borderBottom:'1px solid #f0f4f8'}}>{fmtDate(o.created_at)}</td>
                  <td style={{padding:'10px 16px',borderBottom:'1px solid #f0f4f8'}}>
                    <span style={{background:'#fef4e7',color:'#e67e22',fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20}}>{(o.status||'pending').toUpperCase()}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length===0 && <div style={{padding:32,textAlign:'center',color:'#8898aa',fontSize:13}}>No orders found.</div>}
      </div>
    </div>
  )
}
