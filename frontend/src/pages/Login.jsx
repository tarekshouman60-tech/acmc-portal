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
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f0f4f8'}}>
      <div style={{width:380}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:52,height:52,background:'#0b4f82',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,margin:'0 auto 14px'}}>⚕️</div>
          <h1 style={{fontSize:20,fontWeight:700,color:'#1a2636'}}>ACMC Portal</h1>
          <p style={{color:'#4a5a70',fontSize:13,marginTop:4}}>Advanced Cancer Management Center</p>
        </div>

        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:12,padding:28}}>
          <form onSubmit={submit}>
            {error && (
              <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:6,padding:'10px 14px',fontSize:13,marginBottom:16}}>
                {error}
              </div>
            )}

            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                style={{width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'9px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}}
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
                  style={{width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'9px 40px 9px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}}
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
              style={{width:'100%',padding:'10px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',fontSize:14,fontWeight:600,cursor:loading?'not-allowed':'pointer',opacity:loading?.7:1}}>
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
