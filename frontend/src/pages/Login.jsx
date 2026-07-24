import React, { useState } from 'react'
import { api } from '../api.js'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.login(email, password)
      localStorage.setItem('acmc_token', res.token)
      const me = await api.me()
      onLogin(me)
    } catch(err) {
      setError('Invalid email or password')
    } finally { setLoading(false) }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'radial-gradient(circle at 30% 20%,#eef4fb 0%,#f0f4f8 45%,#eceff4 100%)'}}>
      <div style={{width:380}}>
        <div style={{textAlign:'center',marginBottom:30}}>
          <div style={{width:56,height:56,background:'linear-gradient(145deg,#0f5a9c,#083758)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 16px',boxShadow:'0 8px 20px -6px rgba(11,79,130,.45)'}}>⚕️</div>
          <h1 style={{fontSize:21,fontWeight:700,color:'#1a2636',letterSpacing:'-.01em'}}>ACMC Portal</h1>
          <p style={{color:'#4a5a70',fontSize:13,marginTop:4}}>Advanced Cancer Management Center</p>
        </div>

        <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.05),0 20px 40px -16px rgba(15,23,42,.14)',borderRadius:14,padding:30}}>
          <form onSubmit={submit}>
            {error && (
              <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:6,padding:'10px 14px',fontSize:13,marginBottom:16}}>
                {error}
              </div>
            )}

            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                style={{width:'100%',border:'1.5px solid #dde3ec',borderRadius:8,padding:'10px 12px',fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color .15s,box-shadow .15s'}}
                placeholder="doctor@clinic.com"/>
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
              style={{width:'100%',padding:'11px',borderRadius:8,border:'none',background:'linear-gradient(145deg,#0f5a9c,#0b4f82)',color:'#fff',fontSize:14,fontWeight:600,cursor:loading?'not-allowed':'pointer',opacity:loading?.7:1,boxShadow:'0 6px 16px -6px rgba(11,79,130,.55)'}}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{textAlign:'center',color:'#8898aa',fontSize:11.5,marginTop:16}}>
          Access restricted to registered referring physicians.
        </p>
      </div>
    </div>
  )
}
