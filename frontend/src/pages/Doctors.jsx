import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'

const inp = {width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}
const FL = ({label,children}) => <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{label}</label>{children}</div>

export default function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({full_name:'',email:'',username:'',phone:'',specialty:'',clinic_affiliation:'',bank_name:'',bank_account_name:'',bank_account_number:'',bank_iban:'',bank_swift:'',password:''})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const EMPTY = {full_name:'',email:'',username:'',phone:'',specialty:'',clinic_affiliation:'',bank_name:'',bank_account_name:'',bank_account_number:'',bank_iban:'',bank_swift:'',password:''}

  useEffect(() => { api.doctors().then(setDoctors) }, [])

  async function save() {
    if (!form.full_name || !form.email || (!editId && (!form.username || !form.password))) { setError('Name, email'+(editId?'':', username and password')+' are required'); return }
    setSaving(true); setError('')
    try {
      if (editId) { const d={...form}; if (!d.password) delete d.password; await api.updateDoctor(editId, d) } else await api.createDoctor(form)
      const fresh = await api.doctors(); setDoctors(fresh)
      setShowForm(false); setEditId(null)
      setForm({full_name:'',email:'',username:'',phone:'',specialty:'',clinic_affiliation:'',bank_name:'',bank_account_name:'',bank_account_number:'',bank_iban:'',bank_swift:'',password:''})
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  async function toggle(id) {
    await api.toggleDoctor(id)
    const fresh = await api.doctors(); setDoctors(fresh)
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700}}>Doctor Accounts</h1>
          <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>{doctors.length} registered physician{doctors.length!==1?'s':''}</p>
        </div>
        <button onClick={()=>{setEditId(null);setForm(EMPTY);setError('');setShowForm(true)}} style={{padding:'9px 18px',borderRadius:7,border:'none',background:'#155eef',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>+ Add Doctor</button>
      </div>

      {showForm && (
        <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:14,padding:20,marginBottom:14}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:14}}>{editId?'Edit account':'New Doctor Account'}</div>
          {error && <div style={{background:'#ffe4e6',color:'#e11d48',borderRadius:6,padding:'9px 13px',fontSize:13,marginBottom:12}}>{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:13,marginBottom:13}}>
            <FL label="Full name *"><input style={inp} value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Dr. Full Name"/></FL>
            <FL label="Email *"><input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="doctor@clinic.com"/></FL>
            <FL label="Username *"><input style={inp} autoCapitalize="none" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="Login username"/></FL>
            <FL label="Mobile"><input style={inp} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></FL>
            <FL label="Specialty"><input style={inp} value={form.specialty} onChange={e=>setForm(f=>({...f,specialty:e.target.value}))} placeholder="e.g. Radiation Oncology"/></FL>
            <FL label="Clinic / affiliation"><input style={inp} value={form.clinic_affiliation} onChange={e=>setForm(f=>({...f,clinic_affiliation:e.target.value}))}/></FL>
            <FL label={editId?"New password (leave blank to keep)":"Password *"}><input style={inp} type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Temporary password"/></FL>
          </div>
          <div style={{fontSize:11,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',margin:'4px 0 10px'}}>Bank account (for transfers)</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:13,marginBottom:13}}>
            <FL label="Bank name"><input style={inp} value={form.bank_name} onChange={e=>setForm(f=>({...f,bank_name:e.target.value}))}/></FL>
            <FL label="Account holder"><input style={inp} value={form.bank_account_name} onChange={e=>setForm(f=>({...f,bank_account_name:e.target.value}))}/></FL>
            <FL label="Account number"><input style={inp} value={form.bank_account_number} onChange={e=>setForm(f=>({...f,bank_account_number:e.target.value}))}/></FL>
            <FL label="IBAN"><input style={inp} value={form.bank_iban} onChange={e=>setForm(f=>({...f,bank_iban:e.target.value}))}/></FL>
            <FL label="SWIFT / BIC"><input style={inp} value={form.bank_swift} onChange={e=>setForm(f=>({...f,bank_swift:e.target.value}))}/></FL>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>{setShowForm(false);setEditId(null)}} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #dde3ec',background:'transparent',cursor:'pointer',fontSize:13}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{padding:'8px 18px',borderRadius:6,border:'none',background:'#155eef',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':(editId?'Save changes':'Create Account')}</button>
          </div>
        </div>
      )}

      <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:14,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{background:'#f7f9fc'}}>
            {['Name','Username','Email','Mobile','Specialty','Clinic','Joined','Status','Action'].map(h=>(
              <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {doctors.map(d=>(
              <tr key={d.id}>
                <td style={{padding:'11px 16px',fontSize:13,fontWeight:500,borderBottom:'1px solid #f0f4f8'}}>{d.full_name}</td>
                    <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{d.username||'—'}</td>
                <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{d.email}</td>
                    <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{d.phone||'—'}</td>
                <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{d.specialty||'—'}</td>
                <td style={{padding:'11px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{d.clinic_affiliation||'—'}</td>
                <td style={{padding:'11px 16px',fontSize:12,color:'#8898aa',borderBottom:'1px solid #f0f4f8'}}>{fmtDate(d.created_at)}</td>
                <td style={{padding:'11px 16px',borderBottom:'1px solid #f0f4f8'}}>
                  <span style={{background:d.is_active?'#d1fae5':'#ffe4e6',color:d.is_active?'#059669':'#e11d48',fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20}}>{d.is_active?'ACTIVE':'INACTIVE'}</span>
                </td>
                <td style={{padding:'11px 16px',borderBottom:'1px solid #f0f4f8'}}>
                  <button onClick={()=>{setEditId(d.id);setForm({full_name:d.full_name||'',email:d.email||'',username:d.username||'',phone:d.phone||'',specialty:d.specialty||'',clinic_affiliation:d.clinic_affiliation||'',bank_name:d.bank_name||'',bank_account_name:d.bank_account_name||'',bank_account_number:d.bank_account_number||'',bank_iban:d.bank_iban||'',bank_swift:d.bank_swift||'',password:''});setError('');setShowForm(true);window.scrollTo(0,0)}} style={{padding:'5px 12px',borderRadius:5,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12,fontWeight:500,marginRight:6}}>Edit</button>
                      <button onClick={()=>toggle(d.id)} style={{padding:'5px 12px',borderRadius:5,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12,fontWeight:500,color:d.is_active?'#e11d48':'#059669'}}>
                    {d.is_active?'Deactivate':'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
