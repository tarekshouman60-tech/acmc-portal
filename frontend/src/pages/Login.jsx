import React, { useState } from 'react'
import { api } from '../api.js'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [fEmail, setFEmail] = useState('')
  const [fMsg, setFMsg] = useState('')

  async function sendForgot(e) {
    e.preventDefault()
    setLoading(true); setFMsg('')
    try { await api.forgot(fEmail); setFMsg('If that email belongs to an account, the username and a new temporary password have been sent to it. Check your inbox (and spam).') }
    catch { setFMsg('Something went wrong. Please try again or contact the administrator.') }
    finally { setLoading(false) }
  }

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.login(email, password)
      localStorage.setItem('acmc_token', res.token)
      const me = await api.me()
      onLogin(me)
    } catch(err) {
      setError('Invalid username or password')
    } finally { setLoading(false) }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'radial-gradient(circle at 25% 15%,#dbe9ff 0%,#eef2fb 40%,#e4ecfa 100%)'}}>
      <div style={{width:380}}>
        <div style={{textAlign:'center',marginBottom:30}}>
          <div style={{width:60,height:60,background:'linear-gradient(145deg,#3d8bff,#0d3fb0)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,margin:'0 auto 16px',boxShadow:'0 10px 26px -6px rgba(21,94,239,.55)'}}>⚕️</div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#1a2636',letterSpacing:'-.02em'}}>ACMC Portal</h1>
          <p style={{color:'#4a5a70',fontSize:13,marginTop:4}}>Advanced Cancer Management Center</p>
        </div>

        <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 4px 10px rgba(15,23,42,.06),0 24px 48px -16px rgba(21,94,239,.24)',borderRadius:18,padding:30}}>
          {forgot ? (
          <form onSubmit={sendForgot}>
            <p style={{fontSize:13,color:'#4a5a70',marginBottom:14}}>Enter the email address registered on your account. We will email you your username and a new temporary password.</p>
            {fMsg && <div style={{background:'#e8f5ee',color:'#0f6b3a',border:'1px solid #b7e0c8',borderRadius:6,padding:'10px 14px',fontSize:13,marginBottom:14}}>{fMsg}</div>}
            <input type="email" required autoCapitalize="none" value={fEmail} onChange={e=>setFEmail(e.target.value)} placeholder="Registered email"
              style={{width:'100%',border:'1.5px solid #dde3ec',borderRadius:8,padding:'10px 12px',fontSize:13,fontFamily:'inherit',outline:'none',marginBottom:16}}/>
            <button type="submit" disabled={loading}
              style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'linear-gradient(145deg,#3d8bff,#155eef)',color:'#fff',fontSize:14.5,fontWeight:700,cursor:'pointer',opacity:loading?.7:1}}>
              {loading ? 'Sending…' : 'Send my login details'}
            </button>
            <div style={{textAlign:'center',marginTop:14}}>
              <button type="button" onClick={()=>{setForgot(false);setFMsg('')}} style={{background:'none',border:'none',color:'#155eef',cursor:'pointer',fontSize:13}}>← Back to sign in</button>
            </div>
          </form>
          ) : (
          <form onSubmit={submit}>
            {error && (
              <div style={{background:'#ffe4e6',color:'#e11d48',border:'1px solid #fecdd3',borderRadius:6,padding:'10px 14px',fontSize:13,marginBottom:16}}>
                {error}
              </div>
            )}

            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5}}>Username</label>
              <input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} required
                style={{width:'100%',border:'1.5px solid #dde3ec',borderRadius:8,padding:'10px 12px',fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color .15s,box-shadow .15s'}}
                placeholder="Username"/>
            </div>

            <div style={{marginBottom:22}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5}}>Password</label>
              <div style={{position:'relative'}}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  required
                  style={{width:'100%',border:'1.5px solid #dde3ec',borderRadius:8,padding:'10px 40px 10px 12px',fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color .15s,box-shadow .15s'}}
                  placeholder="••••••••"/>
                <button
                  type="button"
                  onClick={()=>setShowPw(s=>!s)}
                  style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#8898aa',padding:'2px 4px',lineHeight:1}}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'linear-gradient(145deg,#3d8bff,#155eef)',color:'#fff',fontSize:14.5,fontWeight:700,cursor:loading?'not-allowed':'pointer',opacity:loading?.7:1,boxShadow:'0 8px 20px -6px rgba(21,94,239,.6)'}}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <div style={{textAlign:'center',marginTop:14}}>
              <button type="button" onClick={()=>setForgot(true)} style={{background:'none',border:'none',color:'#155eef',cursor:'pointer',fontSize:13}}>Forgot username or password?</button>
            </div>
          </form>
          )}
        </div>

        <p style={{textAlign:'center',color:'#8898aa',fontSize:11.5,marginTop:16}}>
          Access restricted to registered referring physicians.
        </p>
      </div>
    </div>
  )
}
