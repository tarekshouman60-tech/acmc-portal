import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../App.jsx'

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024*1024) return Math.round(bytes/1024)+' KB'
  return (bytes/(1024*1024)).toFixed(1)+' MB'
}

function AttachmentThumb({ item, onDeleted, canDelete }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let revoke
    api.attachmentBlobUrl(item.id).then(u => { setUrl(u); revoke = u }).catch(() => setError(true))
    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [item.id])

  async function del() {
    if (!confirm('Delete this attachment?')) return
    await api.deleteAttachment(item.id)
    onDeleted()
  }

  return (
    <div style={{position:'relative',border:'1px solid #dde3ec',borderRadius:8,overflow:'hidden',background:'#f7f9fc',width:150}}>
      {canDelete && (
        <button onClick={del} title="Delete"
          style={{position:'absolute',top:4,right:4,zIndex:1,width:20,height:20,borderRadius:'50%',border:'none',background:'rgba(0,0,0,.55)',color:'#fff',cursor:'pointer',fontSize:11,lineHeight:1}}>✕</button>
      )}
      {error ? (
        <div style={{padding:12,fontSize:11,color:'#e11d48'}}>Failed to load</div>
      ) : !url ? (
        <div style={{padding:20,textAlign:'center'}}><div style={{width:18,height:18,border:'2px solid #dde3ec',borderTopColor:'#155eef',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div>
      ) : item.file_type==='image' ? (
        <img src={url} alt={item.original_filename} style={{width:'100%',height:110,objectFit:'cover',display:'block'}}/>
      ) : item.file_type==='video' ? (
        <video src={url} controls style={{width:'100%',height:110,objectFit:'cover',display:'block',background:'#000'}}/>
      ) : (
        <div style={{padding:'14px 10px'}}>
          <div style={{fontSize:11,color:'#4a5a70',marginBottom:6}}>🎙️ Voice note</div>
          <audio src={url} controls style={{width:'100%',height:32}}/>
        </div>
      )}
      <div style={{padding:'5px 8px',fontSize:10,color:'#8898aa',display:'flex',justifyContent:'space-between',gap:4}}>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.uploaded_by_role}</span>
        <span>{fmtSize(item.size_bytes)}</span>
      </div>
    </div>
  )
}

export function AttachmentGallery({ orderType, orderId, refreshKey, allowDelete=true }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  function load() {
    api.listAttachments(orderType, orderId).then(d=>{setItems(d); setLoading(false)}).catch(()=>setLoading(false))
  }
  useEffect(load, [orderType, orderId, refreshKey])

  if (loading) return null
  if (items.length === 0) return null

  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:10}}>
      {items.map(item => (
        <AttachmentThumb key={item.id} item={item} onDeleted={load}
          canDelete={allowDelete && (user?.role==='admin' || (item.uploaded_by_role===user?.role))}/>
      ))}
    </div>
  )
}

export function AttachmentUploader({ orderType, orderId, onUploaded }) {
  const photoRef = useRef(null)
  const videoRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  async function handleFile(e, kind) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true); setError('')
    try {
      await api.uploadAttachment(orderType, orderId, kind, file, file.name)
      onUploaded()
    } catch(err) { setError(err.message) } finally { setUploading(false) }
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => chunksRef.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setUploading(true)
        try {
          await api.uploadAttachment(orderType, orderId, 'audio', blob, `voice-note-${Date.now()}.webm`)
          onUploaded()
        } catch(err) { setError(err.message) } finally { setUploading(false) }
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s+1), 1000)
    } catch(err) {
      setError('Microphone access denied or unavailable')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <input ref={photoRef} type="file" accept="image/jpeg" style={{display:'none'}} onChange={e=>handleFile(e,'image')}/>
        <button type="button" disabled={uploading||recording} onClick={()=>photoRef.current?.click()}
          style={{padding:'7px 13px',borderRadius:7,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:500}}>📷 Photo</button>

        <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" style={{display:'none'}} onChange={e=>handleFile(e,'video')}/>
        <button type="button" disabled={uploading||recording} onClick={()=>videoRef.current?.click()}
          style={{padding:'7px 13px',borderRadius:7,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:500}}>🎥 Video</button>

        {!recording ? (
          <button type="button" disabled={uploading} onClick={startRecording}
            style={{padding:'7px 13px',borderRadius:7,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:500}}>🎙️ Record voice note</button>
        ) : (
          <button type="button" onClick={stopRecording}
            style={{padding:'7px 13px',borderRadius:7,border:'1px solid #e11d48',background:'#ffe4e6',color:'#e11d48',cursor:'pointer',fontSize:12.5,fontWeight:600}}>
            ⏹ Stop ({recSeconds}s)
          </button>
        )}
        {uploading && <span style={{fontSize:12,color:'#8898aa'}}>Uploading…</span>}
      </div>
      {error && <div style={{color:'#e11d48',fontSize:12,marginTop:6}}>{error}</div>}
      <div style={{fontSize:11,color:'#aaa',marginTop:4}}>JPG up to 8MB · MP4/MOV/WebM up to 30MB (keep clips short) · Voice notes up to 15MB</div>
    </div>
  )
}
