import React, { useEffect, useState } from 'react'
import { api, fmtEGP } from '../api.js'
import { useAuth } from '../App.jsx'

const CATS = ['Simulation','Immobilization','Special Technique','Planning','Treatment Delivery','SBRT/SRS Package','Special Procedure','Quality & Review']
const CAT_COLORS = {'Simulation':'#e8f0fb','Immobilization':'#f3e8ff','Special Technique':'#eef2ff','Planning':'#e0f5f3','Treatment Delivery':'#fef4e7','SBRT/SRS Package':'#fdecea','Special Procedure':'#fdecea','Quality & Review':'#e0f5f3'}
const CAT_TEXT = {'Simulation':'#0c447c','Immobilization':'#5b21b6','Special Technique':'#3730a3','Planning':'#085041','Treatment Delivery':'#633806','SBRT/SRS Package':'#791f1f','Special Procedure':'#791f1f','Quality & Review':'#085041'}

export default function Services() {
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState({})

  useEffect(() => { api.services().then(setServices) }, [])

  async function savePrice(svc) {
    const val = parseFloat(editing[svc.id])
    if (isNaN(val) || val < 0) return
    setSaving(s=>({...s,[svc.id]:true}))
    await api.updateServicePrice(svc.id, val)
    setServices(svcs => svcs.map(s => s.id===svc.id ? {...s,price_egp:val} : s))
    setEditing(e=>({...e,[svc.id]:undefined}))
    setSaving(s=>({...s,[svc.id]:false}))
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Price Management</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>{isAdmin ? 'Edit prices per service. Changes apply immediately to all new orders.' : 'Current ACMC service price list.'}</p>
      </div>

      {CATS.map(cat => {
        const svcs = services.filter(s=>s.category===cat)
        if (!svcs.length) return null
        return (
          <div key={cat} style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,marginBottom:12,overflow:'hidden'}}>
            <div style={{padding:'12px 18px',background:'#fafbfc',borderBottom:'1px solid #dde3ec',display:'flex',alignItems:'center',gap:10}}>
              <span style={{background:CAT_COLORS[cat],color:CAT_TEXT[cat],fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:20}}>{cat}</span>
              <span style={{color:'#8898aa',fontSize:12}}>{svcs.length} service{svcs.length!==1?'s':''}</span>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f7f9fc'}}>
                <th style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec',width:70}}>Code</th>
                <th style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>Service</th>
                <th style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec',width:110}}>Unit</th>
                <th style={{padding:'8px 16px',textAlign:'right',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec',width:200}}>Price (EGP)</th>
              </tr></thead>
              <tbody>
                {svcs.map(svc=>(
                  <tr key={svc.id}>
                    <td style={{padding:'10px 16px',fontSize:11.5,fontFamily:'monospace',color:'#8898aa',borderBottom:'1px solid #f0f4f8'}}>{svc.code}</td>
                    <td style={{padding:'10px 16px',fontSize:13,borderBottom:'1px solid #f0f4f8'}}>
                      {svc.name}
                      {svc.notes && <div style={{fontSize:11,color:'#8898aa',marginTop:1}}>{svc.notes}</div>}
                    </td>
                    <td style={{padding:'10px 16px',fontSize:12,color:'#8898aa',borderBottom:'1px solid #f0f4f8'}}>{svc.unit}{svc.per_fraction && <span style={{marginLeft:5,background:'#e8f0fb',color:'#0b4f82',fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:600}}>×Fx</span>}</td>
                    <td style={{padding:'10px 16px',textAlign:'right',borderBottom:'1px solid #f0f4f8'}}>
                      {isAdmin ? (
                        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:7}}>
                          <input type="number" min="0" step="0.01"
                            value={editing[svc.id] !== undefined ? editing[svc.id] : (svc.price_egp ?? '')}
                            onChange={e=>setEditing(ed=>({...ed,[svc.id]:e.target.value}))}
                            placeholder="Enter price"
                            style={{width:110,border:'1px solid #dde3ec',borderRadius:5,padding:'5px 9px',fontSize:13,textAlign:'right',fontFamily:'monospace',outline:'none'}}/>
                          {editing[svc.id] !== undefined && (
                            <button onClick={()=>savePrice(svc)} disabled={saving[svc.id]}
                              style={{padding:'5px 12px',borderRadius:5,border:'none',background:'#1a7a4a',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>
                              {saving[svc.id]?'…':'Save'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{fontSize:13,fontWeight:500,fontFamily:'monospace'}}>
                          {svc.price_egp ? fmtEGP(svc.price_egp) : <span style={{color:'#c8d0da',fontStyle:'italic',fontSize:12}}>TBD</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
