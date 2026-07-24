import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../App.jsx'

function fmtWhen(d) {
  return new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
}

function MsgAttachment({ item }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let revoke
    api.attachmentBlobUrl(item.id).then(u => { setUrl(u); revoke = u }).catch(()=>{})
    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [item.id])
  if (!url) return <div style={{fontSize:11,color:'#8898aa'}}>Loading attachment…</div>
  if (item.file_type==='image') return <img src={url} alt={item.original_filename} style={{maxWidth:220,borderRadius:8,display:'block',marginTop:6}}/>
  if (item.file_type==='video') return <video src={url} controls style={{maxWidth:240,borderRadius:8,display:'block',marginTop:6,background:'#000'}}/>
  return <audio src={url} controls style={{marginTop:6,height:32}}/>
}

function Bubble({ msg, isMine }) {
  return (
    <div style={{display:'flex',justifyContent:isMine?'flex-end':'flex-start',marginBottom:10}}>
      <div style={{maxWidth:'78%'}}>
        <div style={{fontSize:10.5,color:'#8898aa',marginBottom:3,textAlign:isMine?'right':'left'}}>
          {msg.sender_name||msg.sender_role} · {fmtWhen(msg.created_at)}
        </div>
        <div style={{
          background: msg.is_flagged ? '#ffe4e6' : (isMine ? '#155eef' : '#f0f4f8'),
          color: msg.is_flagged ? '#7a1a1a' : (isMine ? '#fff' : '#1a2636'),
          border: msg.is_flagged ? '1.5px solid #e0554a' : 'none',
          borderRadius:12,
          borderTopRightRadius:isMine?4:12,
          borderTopLeftRadius:isMine?12:4,
          padding:'9px 13px',
          fontSize:13.5,
          lineHeight:1.5,
          whiteSpace:'pre-wrap',
        }}>
          {msg.is_flagged && <div style={{fontWeight:700,fontSize:11.5,marginBottom:4,display:'flex',alignItems:'center',gap:5}}>🚩 URGENT</div>}
          {msg.body}
          {msg.attachments?.map(a => <MsgAttachment key={a.id} item={a}/>)}
        </div>
      </div>
    </div>
  )
}

export default function MessageThread({ orderType, orderId, title="Discussion" }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null) // {kind, blob, name}
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const photoRef = useRef(null)
  const videoRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  function load() {
    api.listMessages(orderType, orderId).then(async d => {
      setMessages(d)
      setLoading(false)
      const mine = m => m.sender_role===user?.role && m.sender_id===user?.id
      const toMark = d.filter(m => !m.read_at && !mine(m))
      for (const m of toMark) { try { await api.markMessageRead(m.id) } catch {} }
    }).catch(e => { setError(e.message); setLoading(false) })
  }
  useEffect(load, [orderType, orderId])

  function pickFile(e, kind) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setPending({ kind, blob:f, name:f.name })
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => chunksRef.current.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type:'audio/webm' })
        setPending({ kind:'audio', blob, name:`voice-note-${Date.now()}.webm` })
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
      setRecSeconds(0)
      timerRef.current = setInterval(()=>setRecSeconds(s=>s+1),1000)
    } catch { setError('Microphone access denied or unavailable') }
  }
  function stopRecording() { recorderRef.current?.stop(); setRecording(false) }

  async function send() {
    if (!body.trim() && !pending) return
    setSending(true); setError('')
    try {
      const msg = await api.createMessage(orderType, orderId, body.trim() || null, flagged)
      if (pending) await api.uploadAttachment(orderType, orderId, pending.kind, pending.blob, pending.name, msg.id)
      setBody(''); setFlagged(false); setPending(null)
      load()
    } catch(e) { setError(e.message) } finally { setSending(false) }
  }

  return (
    <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:14,padding:'16px 20px',marginTop:10}}>
      <div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:12}}>💬 {title}</div>

      {loading ? (
        <div style={{padding:20,textAlign:'center'}}><div style={{width:22,height:22,border:'3px solid #dde3ec',borderTopColor:'#155eef',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div>
      ) : messages.length===0 ? (
        <div style={{padding:'10px 0',color:'#8898aa',fontSize:12.5}}>No messages yet. Start the conversation below.</div>
      ) : (
        <div style={{maxHeight:340,overflowY:'auto',padding:'4px 2px',marginBottom:10}}>
          {messages.map(m => <Bubble key={m.id} msg={m} isMine={m.sender_role===user?.role && m.sender_id===user?.id}/>)}
        </div>
      )}

      {error && <div style={{background:'#ffe4e6',color:'#e11d48',border:'1px solid #fecdd3',borderRadius:6,padding:'8px 12px',fontSize:12.5,marginBottom:10}}>{error}</div>}

      {pending && (
        <div style={{display:'flex',alignItems:'center',gap:8,background:'#f0f6ff',border:'1px solid #c5d8f5',borderRadius:7,padding:'6px 10px',marginBottom:8,fontSize:12}}>
          <span>📎 {pending.kind === 'audio' ? 'Voice note ready' : pending.name}</span>
          <button onClick={()=>setPending(null)} style={{marginLeft:'auto',border:'none',background:'transparent',color:'#e11d48',cursor:'pointer',fontSize:13}}>✕</button>
        </div>
      )}

      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Type a note to the physicist/oncologist…"
        style={{width:'100%',minHeight:60,border:'1px solid #dde3ec',borderRadius:7,padding:'8px 11px',fontSize:13,fontFamily:'inherit',resize:'vertical',outline:'none',marginBottom:8}}/>

      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <input ref={photoRef} type="file" accept="image/jpeg" style={{display:'none'}} onChange={e=>pickFile(e,'image')}/>
        <button type="button" disabled={recording} onClick={()=>photoRef.current?.click()}
          style={{padding:'6px 11px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12}}>📷</button>

        <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" style={{display:'none'}} onChange={e=>pickFile(e,'video')}/>
        <button type="button" disabled={recording} onClick={()=>videoRef.current?.click()}
          style={{padding:'6px 11px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12}}>🎥</button>

        {!recording ? (
          <button type="button" onClick={startRecording} style={{padding:'6px 11px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12}}>🎙️</button>
        ) : (
          <button type="button" onClick={stopRecording} style={{padding:'6px 11px',borderRadius:6,border:'1px solid #e11d48',background:'#ffe4e6',color:'#e11d48',cursor:'pointer',fontSize:12,fontWeight:600}}>⏹ {recSeconds}s</button>
        )}

        <button type="button" onClick={()=>setFlagged(f=>!f)}
          style={{padding:'6px 12px',borderRadius:6,border:flagged?'1px solid #e11d48':'1px solid #dde3ec',
            background:flagged?'#ffe4e6':'#fff',color:flagged?'#e11d48':'#4a5a70',cursor:'pointer',fontSize:12,fontWeight:flagged?700:500}}>
          🚩 {flagged?'Urgent':'Mark urgent'}
        </button>

        <button type="button" onClick={send} disabled={sending||(!body.trim()&&!pending)}
          style={{marginLeft:'auto',padding:'8px 18px',borderRadius:7,border:'none',background:'#155eef',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,opacity:(sending||(!body.trim()&&!pending))?.6:1}}>
          {sending?'Sending…':'Send'}
        </button>
      </div>
    </div>
  )
}
