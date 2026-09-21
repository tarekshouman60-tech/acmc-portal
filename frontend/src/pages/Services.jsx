import React, { useEffect, useState } from 'react'
import { api, fmtEGP } from '../api.js'
import { useAuth } from '../App.jsx'

const CATS = ['Simulation','Immobilization','Special Technique','Planning','Treatment Delivery','SBRT/SRS Package','Special Procedure','Quality & Review']
const CAT_COLORS = {'Simulation':'#dce9ff','Immobilization':'#f3e8ff','Special Technique':'#eef2ff','Planning':'#c9f7ee','Treatment Delivery':'#fef3c7','SBRT/SRS Package':'#ffe4e6','Special Procedure':'#ffe4e6','Quality & Review':'#c9f7ee'}
const CAT_TEXT = {'Simulation':'#0c447c','Immobilization':'#5b21b6','Special Technique':'#3730a3','Planning':'#085041','Treatment Delivery':'#633806','SBRT/SRS Package':'#791f1f','Special Procedure':'#791f1f','Quality & Review':'#085041'}

export default function Services() {
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState({})
  const [saved, setSaved] = useState({})
  const [error, setError] = useState('')
  const [nameEdit, setNameEdit] = useState({})
  const [adding, setAdding] = useState(false)
  const [nw, setNw] = useState({name:'',category:CATS[0],unit:'session',price_egp:''})
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    api.services().then(setServices).catch(e => setError(e.message))
  }, [])

  async function savePrice(svc) {
    const val = parseFloat(editing[svc.id])
    if (isNaN(val) || val < 0) { setError('Invalid price — must be a positive number'); return }
    setError('')
    setSaving(s => ({...s, [svc.id]: true}))
    try {
      await api.updateServicePrice(svc.id, val)
      setServices(svcs => svcs.map(s => s.id === svc.id ? {...s, price_egp: val} : s))
      setEditing(e => ({...e, [svc.id]: undefined}))
      setSaved(s => ({...s, [svc.id]: true}))
      setTimeout(() => setSaved(s => ({...s, [svc.id]: false})), 2000)
    } catch(e) {
      setError('Failed to save: ' + e.message)
    } finally {
      setSaving(s => ({...s, [svc.id]: false}))
    }
  }

  async function downloadList() {
    try {
      const res = await fetch('/api/services/export', {headers:{Authorization:`Bearer ${localStorage.getItem('acmc_token')}`}})
      if (!res.ok) throw new Error('Download failed')
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a'); a.href = url; a.download = 'ACMC_Price_List.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch(e) { setError(e.message) }
  }

  async function saveName(svc) {
    const name = (nameEdit[svc.id] ?? '').trim()
    if (!name) { setError('Service name cannot be empty'); return }
    try {
      await api.updateServiceName(svc.id, name)
      setServices(svcs => svcs.map(s => s.id === svc.id ? {...s, name} : s))
      setNameEdit(e => ({...e, [svc.id]: undefined})); setError('')
    } catch(e) { setError('Failed to save name: ' + e.message) }
  }

  async function addService() {
    if (!nw.name.trim()) { setError('Enter a service name'); return }
    try {
      const price = nw.price_egp === '' ? null : parseFloat(nw.price_egp)
      const r = await api.createService({...nw, price_egp: price})
      setServices(svcs => [...svcs, r]); setAdding(false); setError('')
      setNw({name:'',category:CATS[0],unit:'session',price_egp:''})
    } catch(e) { setError('Failed to add: ' + e.message) }
  }

  function handleKey(e, svc) {
    if (e.key === 'Enter') savePrice(svc)
    if (e.key === 'Escape') setEditing(ed => ({...ed, [svc.id]: undefined}))
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Price Management</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>
          {isAdmin ? 'Edit prices per service. Press Enter or click Save to confirm each change.' : 'Current ACMC service price list.'}
        </p>
      </div>

      <div style={{marginBottom:14}}>
        <button onClick={downloadList} style={{padding:'8px 16px',borderRadius:7,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>⬇ Download price list (Excel)</button>
      </div>

      {isAdmin && (
        <div style={{marginBottom:14}}>
          {!adding ? <button onClick={()=>setAdding(true)} style={{padding:'8px 16px',borderRadius:7,border:'none',background:'#155eef',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>+ Add service</button> : (
            <div style={{background:'#fff',border:'1px solid #e7ebf1',borderRadius:12,padding:14,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <input placeholder="Service name" value={nw.name} onChange={e=>setNw({...nw,name:e.target.value})} style={{flex:'1 1 220px',border:'1px solid #dde3ec',borderRadius:6,padding:'7px 10px',fontSize:13}}/>
              <select value={nw.category} onChange={e=>setNw({...nw,category:e.target.value})} style={{border:'1px solid #dde3ec',borderRadius:6,padding:'7px 10px',fontSize:13}}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
              <input placeholder="Unit" value={nw.unit} onChange={e=>setNw({...nw,unit:e.target.value})} style={{width:90,border:'1px solid #dde3ec',borderRadius:6,padding:'7px 10px',fontSize:13}}/>
              <input type="number" min="0" placeholder="Price" value={nw.price_egp} onChange={e=>setNw({...nw,price_egp:e.target.value})} style={{width:100,border:'1px solid #dde3ec',borderRadius:6,padding:'7px 10px',fontSize:13}}/>
              <button onClick={addService} style={{padding:'7px 14px',borderRadius:6,border:'none',background:'#059669',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>Add</button>
              <button onClick={()=>setAdding(false)} style={{padding:'7px 12px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:13}}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {error && <div style={{background:'#ffe4e6',color:'#e11d48',border:'1px solid #fecdd3',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:14}}>{error}</div>}

      {CATS.map(cat => {
        const svcs = services.filter(s => s.category === cat)
        if (!svcs.length) return null
        const priced = svcs.filter(s => s.price_egp != null).length
        return (
          <div key={cat} style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:14,marginBottom:12,overflow:'hidden'}}>
            <div style={{padding:'12px 18px',background:'#fafbfc',borderBottom:'1px solid #dde3ec',display:'flex',alignItems:'center',gap:10}}>
              <span style={{background:CAT_COLORS[cat],color:CAT_TEXT[cat],fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:20}}>{cat}</span>
              <span style={{color:'#8898aa',fontSize:12}}>{svcs.length} service{svcs.length!==1?'s':''}</span>
              {isAdmin && <span style={{color:priced===svcs.length?'#059669':'#f59e0b',fontSize:11.5,marginLeft:'auto',fontWeight:500}}>
                {priced}/{svcs.length} priced
              </span>}
            </div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f7f9fc'}}>
                <th style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec',width:70}}>Code</th>
                <th style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>Service</th>
                <th style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec',width:110}}>Unit</th>
                <th style={{padding:'8px 16px',textAlign:'right',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec',width:220}}>Price (EGP)</th>
              </tr></thead>
              <tbody>
                {svcs.map(svc => (
                  <tr key={svc.id} style={{borderBottom:'1px solid #f0f4f8'}}>
                    <td style={{padding:'10px 16px',fontSize:11.5,fontFamily:'monospace',color:'#8898aa'}}>{svc.code}</td>
                    <td style={{padding:'10px 16px',fontSize:13}}>
                      {isAdmin && nameEdit[svc.id] !== undefined ? (
                        <span style={{display:'flex',gap:6}}>
                          <input autoFocus value={nameEdit[svc.id]} onChange={e=>setNameEdit(n=>({...n,[svc.id]:e.target.value}))}
                            onKeyDown={e=>{ if(e.key==='Enter') saveName(svc); if(e.key==='Escape') setNameEdit(n=>({...n,[svc.id]:undefined})) }}
                            style={{flex:1,border:'1px solid #155eef',borderRadius:5,padding:'4px 8px',fontSize:13}}/>
                          <button onClick={()=>saveName(svc)} style={{padding:'4px 10px',borderRadius:5,border:'none',background:'#059669',color:'#fff',cursor:'pointer',fontSize:12}}>Save</button>
                        </span>
                      ) : (<>
                        {svc.name}
                        {isAdmin && <button title="Rename" onClick={()=>setNameEdit(n=>({...n,[svc.id]:svc.name}))} style={{marginLeft:8,border:'none',background:'transparent',cursor:'pointer',fontSize:12,color:'#8898aa'}}>✏️</button>}
                      </>)}
                      {svc.notes && <div style={{fontSize:11,color:'#8898aa',marginTop:1}}>{svc.notes}</div>}
                    </td>
                    <td style={{padding:'10px 16px',fontSize:12,color:'#8898aa'}}>
                      {svc.unit}
                      {svc.per_fraction && <span style={{marginLeft:5,background:'#dce9ff',color:'#155eef',fontSize:10,padding:'1px 6px',borderRadius:14,fontWeight:600}}>×Fx</span>}
                    </td>
                    <td style={{padding:'10px 16px',textAlign:'right'}}>
                      {isAdmin ? (
                        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:7}}>
                          {saved[svc.id] && <span style={{fontSize:11.5,color:'#059669',fontWeight:500}}>✓ Saved</span>}
                          <input
                            type="number" min="0" step="0.01"
                            value={editing[svc.id] !== undefined ? editing[svc.id] : (svc.price_egp ?? '')}
                            onChange={e => setEditing(ed => ({...ed, [svc.id]: e.target.value}))}
                            onKeyDown={e => handleKey(e, svc)}
                            placeholder="Enter price"
                            style={{width:110,border:'1px solid #dde3ec',borderRadius:5,padding:'5px 9px',fontSize:13,textAlign:'right',fontFamily:'monospace',outline:'none',
                              borderColor: editing[svc.id] !== undefined ? '#155eef' : '#dde3ec'}}/>
                          {editing[svc.id] !== undefined && (
                            <button onClick={() => savePrice(svc)} disabled={saving[svc.id]}
                              style={{padding:'5px 12px',borderRadius:5,border:'none',background:'#059669',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>
                              {saving[svc.id] ? '…' : 'Save'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{fontSize:13,fontWeight:500,fontFamily:'monospace'}}>
                          {svc.price_egp != null ? fmtEGP(svc.price_egp) : <span style={{color:'#c8d0da',fontStyle:'italic',fontSize:12}}>Not set</span>}
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
