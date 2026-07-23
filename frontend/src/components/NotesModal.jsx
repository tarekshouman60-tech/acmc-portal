import React from 'react'
import { AttachmentGallery } from './Attachments.jsx'

export default function NotesModal({ title, subtitle, notes, orderType, orderId, onClose }) {
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(20,30,45,.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:12,maxWidth:560,width:'100%',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
        <div style={{padding:'18px 22px',borderBottom:'1px solid #dde3ec',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:15,fontWeight:700}}>{title}</div>
            {subtitle && <div style={{fontSize:12.5,color:'#8898aa',marginTop:2}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{border:'none',background:'transparent',fontSize:18,color:'#8898aa',cursor:'pointer',lineHeight:1,padding:4}}>✕</button>
        </div>
        <div style={{padding:'18px 22px'}}>
          <div style={{fontSize:14,lineHeight:1.7,color:'#1a2636',whiteSpace:'pre-wrap'}}>{notes || 'No notes recorded.'}</div>
          {orderType && orderId && <AttachmentGallery orderType={orderType} orderId={orderId} allowDelete={false}/>}
        </div>
      </div>
    </div>
  )
}
