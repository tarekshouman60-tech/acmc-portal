import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'
import { useAuth } from '../App.jsx'

const inp = {width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}
const sel = {...inp}
const FL = ({label,children}) => <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{label}</label>{children}</div>

export default function Patients({ navigate }) {
  const { user } = useAuth()
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({full_name:'',date_of_birth:'',gender:'',national_id:'',phone:'',diagnosis:'',icd10_code:''})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { api.patients().then(setPatients).catch(e => console.error(e)) }, [])

  async function save() {
    if (!form.full_name.trim()) { setError('Patient name is required'); return }
    setSaving(true); setError('')
    try {
      await api.createPatient({...form, date_of_birth: form.date_of_birth || null})
      const fresh = await api.patients()
      setPatients(fresh)
      setShowForm(false)
      setForm({full_name:'',date_of_birth:'',gender:'',national_id:'',phone:'',diagnosis:'',icd10_code:''})
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  const filtered = patients.filter(p => [p.full_name, p.diagnosis, p.phone, p.icd10_code, p.national_id].some(v => (v||'').toLowerCase().includes(search.toLowerCase())))

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700}}>{user?.role==='admin' ? 'All Patients' : 'My Patients'}</h1>
          <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>{patients.length} patient{patients.length!==1?'s':''} registered</p>
        </div>
        {user?.role !== 'admin' && (
          <button onClick={() => setShowForm(true)}
            style={{padding:'9px 18px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:7}}>
            + New Patient
          </button>
        )}
      </div>

      {/* New patient form */}
      {showForm && (
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'20px',marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:16,color:'#1a2636'}}>New Patient</div>
          {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:6,padding:'9px 13px',fontSize:13,marginBottom:14}}>{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:13,marginBottom:13}}>
            <FL label="Full name *"><input style={inp} value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Full name"/></FL>
            <FL label="Date of birth"><input style={inp} type="date" value={form.date_of_birth} onChange={e=>setForm(f=>({...f,date_of_birth:e.target.value}))}/></FL>
            <FL label="Gender"><select style={sel} value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))}><option value="">Select</option><option>Male</option><option>Female</option></select></FL>
            <FL label="National ID"><input style={inp} value={form.national_id} onChange={e=>setForm(f=>({...f,national_id:e.target.value}))} placeholder="Optional"/></FL>
            <FL label="Phone"><input style={inp} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="Optional"/></FL>
            <FL label="ICD-10 code"><input style={inp} value={form.icd10_code} onChange={e=>setForm(f=>({...f,icd10_code:e.target.value}))} placeholder="e.g. C50.9"/></FL>
          </div>
          <FL label="Diagnosis"><textarea style={{...inp,resize:'vertical',minHeight:60}} value={form.diagnosis} onChange={e=>setForm(f=>({...f,diagnosis:e.target.value}))} placeholder="e.g. Left breast cancer, conservative surgery T2N0M0, luminal disease"/></FL>
          <div style={{display:'flex',gap:8,marginTop:14,justifyContent:'flex-end'}}>
            <button onClick={()=>setShowForm(false)} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #dde3ec',background:'transparent',cursor:'pointer',fontSize:13}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{padding:'8px 18px',borderRadius:6,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Save Patient'}</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{marginBottom:12}}>
        <input style={{...inp,maxWidth:340}} placeholder="Search by name or diagnosis…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* List */}
      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
        {loadingPatients ? <div style={{padding:32,textAlign:'center'}}><div style={{width:28,height:28,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div> : filtered.length === 0
          ? <div style={{padding:40,textAlign:'center',color:'#8898aa',fontSize:13}}>
              {patients.length===0 ? 'No patients yet. Create your first patient above.' : 'No patients match your search.'}
            </div>
          : <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f7f9fc'}}>
                {['Patient','Gender / DOB','Diagnosis',user?.role==='admin'?'Doctor':'Phone','Actions'].map(h=>(
                  <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{cursor:'pointer'}} onClick={()=>navigate('patient-detail',{patientId:p.id})}>
                    <td style={{padding:'12px 16px',fontSize:13,fontWeight:500,borderBottom:'1px solid #f0f4f8'}}>{p.full_name}</td>
                    <td style={{padding:'12px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{p.gender||'—'} {p.date_of_birth ? '· '+fmtDate(p.date_of_birth) : ''}</td>
                    <td style={{padding:'12px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8',maxWidth:220}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.diagnosis||'—'}</div></td>
                    <td style={{padding:'12px 16px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{user?.role==='admin'?(p.doctor_name||'—'):(p.phone||'—')}</td>
                    <td style={{padding:'12px 16px',borderBottom:'1px solid #f0f4f8'}}>
                      <button onClick={e=>{e.stopPropagation();navigate('patient-detail',{patientId:p.id})}} style={{padding:'5px 11px',borderRadius:5,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12,fontWeight:500,color:'#0b4f82'}}>View →</button>
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
