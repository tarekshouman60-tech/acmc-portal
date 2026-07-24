import React, { useEffect, useState } from 'react'
import { useAuth } from '../App.jsx'
import { api } from '../api.js'

const BADGE_NAV_ID = { physicist:'physicist-planning', rtt:'rtt-schedule', doctor:'my-orders', admin:'all-orders' }

const DOCTOR_NAV = [
  { id:'dashboard', icon:'📊', label:'Dashboard' },
  { id:'patients',  icon:'👤', label:'My Patients' },
  { id:'my-orders', icon:'📁', label:'My Orders' },
  { id:'earnings',  icon:'💵', label:'My Earnings' },
]
const ADMIN_NAV = [
  { id:'dashboard',  icon:'📊', label:'Dashboard' },
  { id:'patients',   icon:'👤', label:'All Patients' },
  { id:'all-orders', icon:'📁', label:'All Orders' },
  { id:'milestones', icon:'🏁', label:'Milestones' },
  { id:'billing',    icon:'💳', label:'Billing' },
  { id:'services',   icon:'💰', label:'Price Management' },
  { id:'doctors',    icon:'👨‍⚕️', label:'Doctor Accounts' },
  { id:'rtt-accounts', icon:'🧑‍⚕️', label:'RTT Accounts' },
  { id:'physicist-accounts', icon:'🧬', label:'Physicist Accounts' },
  { id:'earnings',   icon:'💵', label:'Doctor Earnings' },
]
const RTT_NAV = [
  { id:'rtt-schedule', icon:'🗓️', label:'Simulation Schedule' },
]
const PHYSICIST_NAV = [
  { id:'physicist-planning', icon:'🧮', label:'Treatment Planning' },
]

export default function Layout({ page, navigate, children }) {
  const { user, logout } = useAuth()
  const nav = user?.role === 'admin' ? ADMIN_NAV
    : user?.role === 'rtt' ? RTT_NAV
    : user?.role === 'physicist' ? PHYSICIST_NAV
    : DOCTOR_NAV
  const [unread, setUnread] = useState(0)
  const badgeNavId = BADGE_NAV_ID[user?.role]

  useEffect(() => {
    if (!user) return
    let cancelled = false
    function poll() { api.unreadMessageCount().then(d=>{ if(!cancelled) setUnread(d.total||0) }).catch(()=>{}) }
    poll()
    const t = setInterval(poll, 30000)
    return () => { cancelled = true; clearInterval(t) }
  }, [user])

  return (
    <div style={{display:'flex',minHeight:'100vh'}}>
      <div style={{width:228,background:'#0b4f82',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,bottom:0,zIndex:100}}>
        <div style={{padding:'20px 18px',borderBottom:'1px solid rgba(255,255,255,.12)'}}>
          <div style={{color:'#fff',fontSize:16,fontWeight:700,letterSpacing:'-.01em'}}>ACMC</div>
          <div style={{color:'rgba(255,255,255,.45)',fontSize:11,marginTop:2}}>Referring Physician Portal</div>
        </div>
        <nav style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
          {nav.map(item => (
            <div key={item.id} onClick={() => navigate(item.id)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:7,
                color: page===item.id ? '#fff' : 'rgba(255,255,255,.65)',
                background: page===item.id ? 'rgba(255,255,255,.14)' : 'transparent',
                cursor:'pointer',fontSize:13,fontWeight:500,marginBottom:2,transition:'all .12s'}}>
              <span style={{fontSize:15}}>{item.icon}</span>{item.label}
              {item.id===badgeNavId && unread>0 && (
                <span style={{marginLeft:'auto',background:'#e0554a',color:'#fff',fontSize:10.5,fontWeight:700,
                  borderRadius:20,padding:'1px 7px',minWidth:16,textAlign:'center'}}>🚩{unread}</span>
              )}
            </div>
          ))}
        </nav>
        <div style={{padding:'14px 16px',borderTop:'1px solid rgba(255,255,255,.12)'}}>
          <div style={{color:'rgba(255,255,255,.85)',fontSize:12.5,fontWeight:600,marginBottom:1}}>{user?.full_name}</div>
          <div style={{color:'rgba(255,255,255,.4)',fontSize:11,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:10}}>{user?.role}</div>
          <button onClick={()=>navigate('change-password')}
            style={{width:'100%',padding:'7px',borderRadius:6,border:'1px solid rgba(255,255,255,.2)',background:'transparent',color:'rgba(255,255,255,.6)',cursor:'pointer',fontSize:12,fontWeight:500,marginBottom:6}}>
            🔑 Change Password
          </button>
          <button onClick={logout}
            style={{width:'100%',padding:'7px',borderRadius:6,border:'1px solid rgba(255,255,255,.2)',background:'transparent',color:'rgba(255,255,255,.6)',cursor:'pointer',fontSize:12,fontWeight:500}}>
            Sign out
          </button>
        </div>
      </div>
      <div style={{marginLeft:228,flex:1,padding:'28px 32px',maxWidth:'100%',minHeight:'100vh',background:'#f0f4f8'}}>
        {children}
      </div>
    </div>
  )
}
