import React, { useState } from 'react'
import { api } from '../api.js'

const SIM_STATUSES    = ['pending','scheduled','done','cancelled']
const CLINICAL_STATUSES = ['pending','in_progress','completed','cancelled']
const ESTIMATE_STATUSES = ['pending','in_settlement','paid','cancelled']

const COLORS = {
  pending:       {bg:'#fef4e7',color:'#e67e22'},
  scheduled:     {bg:'#e8f0fb',color:'#0b4f82'},
  done:          {bg:'#e8f7ef',color:'#1a7a4a'},
  in_progress:   {bg:'#eef2ff',color:'#4338ca'},
  completed:     {bg:'#e8f7ef',color:'#1a7a4a'},
  in_settlement: {bg:'#fef4e7',color:'#e67e22'},
  paid:          {bg:'#e8f7ef',color:'#1a7a4a'},
  cancelled:     {bg:'#fdecea',color:'#c0392b'},
  unpaid:        {bg:'#fdecea',color:'#c0392b'},
  partial:       {bg:'#fef4e7',color:'#e67e22'},
}

const LABELS = {
  pending:'Pending', scheduled:'Scheduled', done:'Done',
  in_progress:'In Progress', completed:'Completed',
  in_settlement:'In Settlement', paid:'Paid',
  cancelled:'Cancelled', unpaid:'Unpaid', partial:'Partial'
}

export function StatusBadge({ status }) {
  const s = COLORS[status] || {bg:'#f0f4f8',color:'#8898aa'}
  return (
    <span style={{display:'inline-block',background:s.bg,color:s.color,
      fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20,whiteSpace:'nowrap'}}>
      {LABELS[status] || status?.toUpperCase()}
    </span>
  )
}

export function StatusDropdown({ type, id, currentStatus, onUpdated }) {
  const [loading, setLoading] = useState(false)
  const options = type==='sim' ? SIM_STATUSES : type==='clinical' ? CLINICAL_STATUSES : ESTIMATE_STATUSES
  const s = COLORS[currentStatus] || {bg:'#f0f4f8',color:'#8898aa'}

  async function change(e) {
    const newStatus = e.target.value
    if (newStatus === currentStatus) return
    setLoading(true)
    try {
      if (type==='sim')      await api.updateSimStatus(id, newStatus)
      if (type==='clinical') await api.updateClinicalStatus(id, newStatus)
      if (type==='estimate') await api.updateEstimateStatus(id, newStatus)
      if (onUpdated) onUpdated(newStatus)
    } catch(err) { alert('Failed to update status: ' + err.message) }
    finally { setLoading(false) }
  }

  return (
    <select value={currentStatus} onChange={change} disabled={loading}
      style={{border:'none',borderRadius:20,padding:'2px 9px',fontSize:11,fontWeight:600,
        cursor:'pointer',outline:'none',background:s.bg,color:s.color,
        appearance:'none',WebkitAppearance:'none',paddingRight:20,
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${s.color.replace('#','%23')}'/%3E%3C/svg%3E")`,
        backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center'}}>
      {options.map(o => (
        <option key={o} value={o}>{LABELS[o]}</option>
      ))}
    </select>
  )
}
