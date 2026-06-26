import React, { useEffect, useState } from 'react'
import { api, fmtEGP, fmtDate } from '../api.js'
import { useAuth } from '../App.jsx'

function Stat({ label, value, sub, color='#0b4f82' }) {
  return (
    <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 22px'}}>
      <div style={{fontSize:11,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</div>
      <div style={{fontSize:28,fontWeight:700,color,marginTop:6}}>{value}</div>
      {sub && <div style={{fontSize:12,color:'#8898aa',marginTop:3}}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ navigate }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => { api.dashboard().then(setData).catch(console.error) }, [])

  if (!data) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200}}><div style={{width:32,height:32,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite'}}/></div>

  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Welcome, {user?.full_name}</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:4}}>{isAdmin ? 'ACMC Admin — full portal access' : user?.clinic_affiliation || 'Referring Physician'}</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:24}}>
        <Stat label="Patients" value={data.total_patients}/>
        <Stat label="Sim Orders" value={data.sim_orders} color="#4338ca"/>
        <Stat label="Clinical Orders" value={data.clinical_orders} color="#00a896"/>
        <Stat label="Cost Estimates" value={data.cost_estimates} color="#e67e22"/>
        {isAdmin && <>
          <Stat label="Total Billed" value={fmtEGP(data.total_billed_egp)} color="#1a7a4a"/>
          <Stat label="Total Paid" value={fmtEGP(data.total_paid_egp)} color="#0b4f82"/>
        </>}
      </div>

      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid #dde3ec',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontWeight:600,fontSize:14}}>Recent Patients</span>
          <button onClick={() => navigate('patients')} style={{fontSize:12.5,color:'#0b4f82',background:'none',border:'none',cursor:'pointer',fontWeight:500}}>View all →</button>
        </div>
        {data.recent_patients?.length === 0
          ? <div style={{padding:32,textAlign:'center',color:'#8898aa',fontSize:13}}>No patients yet. <button onClick={()=>navigate('patients')} style={{color:'#0b4f82',background:'none',border:'none',cursor:'pointer',fontWeight:500}}>Add your first patient →</button></div>
          : <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                <th style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>Patient</th>
                {isAdmin && <th style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>Doctor</th>}
                <th style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>Added</th>
              </tr></thead>
              <tbody>
                {data.recent_patients?.map((p,i) => (
                  <tr key={i} style={{cursor:'pointer'}} onClick={()=>navigate('patient-detail',{patientId:p.id})}>
                    <td style={{padding:'11px 16px',fontSize:13,borderBottom:'1px solid #f0f4f8'}}>{p.full_name}{p.diagnosis && <div style={{fontSize:11,color:'#8898aa',marginTop:1}}>{p.diagnosis}</div>}</td>
                    {isAdmin && <td style={{padding:'11px 16px',fontSize:13,color:'#4a5a70',borderBottom:'1px solid #f0f4f8'}}>{p.doctor}</td>}
                    <td style={{padding:'11px 16px',fontSize:12.5,color:'#8898aa',borderBottom:'1px solid #f0f4f8'}}>{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  )
}
