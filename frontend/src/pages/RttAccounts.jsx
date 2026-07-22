import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'

const inp = {width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}
const FL = ({label,children}) => <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{label}</label>{children}</div>

export default function RttAccounts() {
  const [rtts, setRtts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({full_name:'',email:'',password:''})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.rtts().then(setRtts) }, [])

  async function save() {
    if (!form.full_name || !form.email || !form.password) { setError('Name, email and password are required'); return }
    setSaving(true); setError('')
    try {
      await api.createRtt(form)
      const fresh = await api.rtts(); setRtts(fresh)
      setShowForm(false)
      setForm({full_name:'',email:'',password:''})
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  async function toggle(id) {
    await api.toggleRtt(id)
    const fresh = await api.rtts(); setRtts(fresh)
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700}}>RTT Accounts</h1>
          <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>{rtts.length} registered technologist{rtts.length!==1?'s':''}</p>
        </div>
        <button onClick={()=>setShowForm(true)} style={{padding:'9px 18px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>+ Add RTT</button>
      </div>

      {showForm && (
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:20,marginBottom:14}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:14}}>New RTT Account</div>
          {error && <div style={{background:'#fdecea',color:'#c0392b',borderRadius:6,padding:'9px 13px',fontSize:13,marginBottom:12}}>{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:13,marginBottom:13}}>
            <FL label="Full name *"><input style={inp} value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Full name"/></FL>
            <FL label="Email *"><input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="rtt@acmc.eg"/></FL>
            <FL label="Password *"><input style={inp} type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Temporary password"/></FL>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setShowForm(false)} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #dde3ec',background:'transparent',cursor:'pointer',fontSize:13}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{padding:'8px 18px',borderRadius:6,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Create Account'}</button>
          </div>
        </div>
      )}

      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
        {rtts.length===0
          ? <div style={{padding:32,textAlign:'center',color:'#8898aa',fontSize:13}}>No RTT accounts yet.</div>
          : <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f7f9fc'}}>
                {['Name','Email','Joined','Status','Action'].map(h=>(
                  <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rtts.map(r=>(
                  <tr key={r.id}>
                    <td style={{padding:'11px 16px',fontSize:13,fontWeight:500,borderBottom:'1px solid #f0f4f8'}}>{r.full_name}</td>
                    <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{r.email}</td>
                    <td style={{padding:'11px 16px',fontSize:12,color:'#8898aa',borderBottom:'1px solid #f0f4f8'}}>{fmtDate(r.created_at)}</td>
                    <td style={{padding:'11px 16px',borderBottom:'1px solid #f0f4f8'}}>
                      <span style={{background:r.is_active?'#e8f7ef':'#fdecea',color:r.is_active?'#1a7a4a':'#c0392b',fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20}}>{r.is_active?'ACTIVE':'INACTIVE'}</span>
                    </td>
                    <td style={{padding:'11px 16px',borderBottom:'1px solid #f0f4f8'}}>
                      <button onClick={()=>toggle(r.id)} style={{padding:'5px 12px',borderRadius:5,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12,fontWeight:500,color:r.is_active?'#c0392b':'#1a7a4a'}}>
                        {r.is_active?'Deactivate':'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  )
}
