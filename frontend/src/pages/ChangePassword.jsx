import React, { useState } from 'react'
import { api } from '../api.js'

function PwInput({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:5}}>{label}</label>
      <div style={{position:'relative'}}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e=>onChange(e.target.value)}
          placeholder={placeholder||'••••••••'}
          style={{width:'100%',border:'1px solid #dde3ec',borderRadius:6,padding:'9px 40px 9px 11px',fontSize:13,fontFamily:'inherit',outline:'none'}}/>
        <button type="button" onClick={()=>setShow(s=>!s)}
          style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#8898aa',padding:'2px 4px',lineHeight:1}}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  )
}

export default function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit() {
    setError(''); setSuccess(false)
    if (!current || !newPw || !confirm) { setError('All fields are required'); return }
    if (newPw.length < 8) { setError('New password must be at least 8 characters'); return }
    if (newPw !== confirm) { setError('New passwords do not match'); return }
    setSaving(true)
    try {
      await api.changePassword(current, newPw)
      setSuccess(true)
      setCurrent(''); setNewPw(''); setConfirm('')
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Change Password</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Update your account password.</p>
      </div>
      <div style={{maxWidth:420}}>
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'24px'}}>
          {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:6,padding:'10px 14px',fontSize:13,marginBottom:16}}>{error}</div>}
          {success && <div style={{background:'#e8f7ef',color:'#1a7a4a',border:'1px solid #b7e4cc',borderRadius:6,padding:'10px 14px',fontSize:13,marginBottom:16}}>✓ Password changed successfully.</div>}
          <PwInput label="Current password" value={current} onChange={setCurrent}/>
          <PwInput label="New password" value={newPw} onChange={setNewPw} placeholder="At least 8 characters"/>
          <PwInput label="Confirm new password" value={confirm} onChange={setConfirm} placeholder="Repeat new password"/>
          <button onClick={submit} disabled={saving}
            style={{width:'100%',padding:'10px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',fontSize:13,fontWeight:600,cursor:saving?'not-allowed':'pointer',opacity:saving?.7:1}}>
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
