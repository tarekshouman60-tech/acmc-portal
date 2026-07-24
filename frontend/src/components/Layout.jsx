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

  const initials = (user?.full_name||'').split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase()

  return (
    <div style={{display:'flex',minHeight:'100vh'}}>
      <div style={{width:228,background:'linear-gradient(180deg,#0c5490 0%,#0a4470 55%,#083758 100%)',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,bottom:0,zIndex:100,boxShadow:'2px 0 24px rgba(3,15,30,.18)'}}>
        <div style={{padding:'22px 20px 19px',borderBottom:'1px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:'rgba(255,255,255,.14)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,boxShadow:'inset 0 0 0 1px rgba(255,255,255,.12)'}}>⚕️</div>
          <div>
            <div style={{color:'#fff',fontSize:15.5,fontWeight:700,letterSpacing:'-.01em'}}>ACMC</div>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:10.5,marginTop:1}}>Referring Physician Portal</div>
          </div>
        </div>
        <nav style={{flex:1,padding:'14px 10px',overflowY:'auto'}}>
          {nav.map(item => {
            const active = page===item.id
            return (
              <div key={item.id} onClick={() => navigate(item.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,position:'relative',
                  color: active ? '#fff' : 'rgba(255,255,255,.62)',
                  background: active ? 'rgba(255,255,255,.12)' : 'transparent',
                  boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,.08)' : 'none',
                  cursor:'pointer',fontSize:13,fontWeight:active?600:500,marginBottom:2,transition:'background .15s,color .15s'}}>
                {active && <span style={{position:'absolute',left:-10,top:'50%',transform:'translateY(-50%)',width:3,height:16,borderRadius:3,background:'#4fb0ff'}}/>}
                <span style={{fontSize:15,opacity:active?1:.85}}>{item.icon}</span>{item.label}
                {item.id===badgeNavId && unread>0 && (
                  <span style={{marginLeft:'auto',background:'#e0554a',color:'#fff',fontSize:10.5,fontWeight:700,
                    borderRadius:20,padding:'1px 7px',minWidth:16,textAlign:'center',boxShadow:'0 1px 4px rgba(224,85,74,.5)'}}>🚩{unread}</span>
                )}
              </div>
            )
          })}
        </nav>
        <div style={{padding:'14px 16px',borderTop:'1px solid rgba(255,255,255,.1)'}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
            <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,.14)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11.5,fontWeight:700,color:'#fff',flexShrink:0,boxShadow:'inset 0 0 0 1px rgba(255,255,255,.15)'}}>{initials||'?'}</div>
            <div style={{minWidth:0}}>
              <div style={{color:'rgba(255,255,255,.92)',fontSize:12.5,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.full_name}</div>
              <div style={{color:'rgba(255,255,255,.42)',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.05em'}}>{user?.role}</div>
            </div>
          </div>
          <button onClick={()=>navigate('change-password')}
            style={{width:'100%',padding:'7px',borderRadius:7,border:'1px solid rgba(255,255,255,.16)',background:'rgba(255,255,255,.03)',color:'rgba(255,255,255,.65)',cursor:'pointer',fontSize:12,fontWeight:500,marginBottom:6,transition:'background .15s'}}>
            🔑 Change Password
          </button>
          <button onClick={logout}
            style={{width:'100%',padding:'7px',borderRadius:7,border:'1px solid rgba(255,255,255,.16)',background:'rgba(255,255,255,.03)',color:'rgba(255,255,255,.65)',cursor:'pointer',fontSize:12,fontWeight:500,transition:'background .15s'}}>
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
