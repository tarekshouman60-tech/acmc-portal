import React, { useEffect, useState } from 'react'
import { api, fmtEGP, fmtDate } from '../api.js'

const round2 = n => Math.round(n * 100) / 100

export default function Billing() {
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [payForm, setPayForm] = useState({amount_egp:'',method:'cash',reference:'',notes:'',payment_date:''})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editStatus, setEditStatus] = useState('confirmed')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [discountSaving, setDiscountSaving] = useState(false)
  const [discountError, setDiscountError] = useState('')

  useEffect(() => { api.patients().then(setPatients) }, [])

  async function load(pid) {
    setSelected(pid)
    setError('')
    const d = await api.getPatient(pid)
    setDetail(d)
  }

  async function addPayment() {
    if (!detail?.billing) return
    const amount = parseFloat(payForm.amount_egp)
    if (!amount || amount <= 0) { setError('Enter a valid payment amount'); return }
    if (amount > parseFloat(detail.billing.balance_egp)) { setError(`Amount exceeds balance due (${fmtEGP(detail.billing.balance_egp)})`); return }
    if (payForm.method === 'credit' && !payForm.reference.trim()) { setError('Enter the insurance / company name for credit payments'); return }
    setSaving(true); setError('')
    try {
      await api.addPayment({
        billing_id: detail.billing.id,
        amount_egp: amount,
        method: payForm.method,
        reference: payForm.reference || null,
        notes: payForm.notes || null,
        payment_date: payForm.payment_date || null
      })
      await load(selected)
      setPayForm({amount_egp:'',method:'cash',reference:'',notes:'',payment_date:''})
    } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  function startEdit(p) {
    setEditingId(p.id)
    setEditAmount(String(p.amount_egp))
    setEditStatus(p.status || 'confirmed')
    setEditError('')
  }

  async function saveEdit(pid) {
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) { setEditError('Enter a valid amount'); return }
    setEditSaving(true); setEditError('')
    try {
      await api.editPayment(pid, { amount_egp: amount, status: editStatus })
      await load(selected)
      setEditingId(null)
    } catch(e) { setEditError(e.message) } finally { setEditSaving(false) }
  }

  function startDiscount() {
    setDiscountAmount(detail?.billing?.discount_egp ? String(detail.billing.discount_egp) : '')
    setDiscountReason(detail?.billing?.discount_reason || '')
    setDiscountError('')
    setEditingDiscount(true)
  }

  async function saveDiscount() {
    if (!detail?.billing) return
    const amount = parseFloat(discountAmount) || 0
    if (amount < 0) { setDiscountError('Discount cannot be negative'); return }
    if (amount > discountableMax) { setDiscountError(`Discount cannot exceed ${fmtEGP(discountableMax)} — consultation fees are excluded`); return }
    if (amount > 0 && !discountReason.trim()) { setDiscountError("Enter the referring doctor's request / reason for the discount"); return }
    setDiscountSaving(true); setDiscountError('')
    try {
      await api.setBillingDiscount(detail.billing.id, { discount_egp: amount, reason: discountReason || null })
      await load(selected)
      setEditingDiscount(false)
    } catch(e) { setDiscountError(e.message) } finally { setDiscountSaving(false) }
  }

  const filtered = patients.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
  const inp = {border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%'}

  const balance = detail?.billing ? parseFloat(detail.billing.balance_egp) : 0
  const totalBilled = detail?.billing ? parseFloat(detail.billing.total_amount_egp) : 0
  const totalPaid = detail?.billing ? parseFloat(detail.billing.amount_paid_egp) : 0
  const grossTotal = detail?.billing ? parseFloat(detail.billing.gross_total_egp) : 0
  const consultationTotal = detail?.billing ? parseFloat(detail.billing.consultation_total_egp) : 0
  const currentDiscount = detail?.billing ? parseFloat(detail.billing.discount_egp || 0) : 0
  const discountableMax = Math.max(0, round2(grossTotal - consultationTotal))
  const isFullyPaid = balance <= 0
  const billingStatus = isFullyPaid ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

  const STATUS_COLORS = {
    paid:    {bg:'#d1fae5',color:'#059669'},
    partial: {bg:'#fef3c7',color:'#f59e0b'},
    unpaid:  {bg:'#ffe4e6',color:'#e11d48'},
  }
  const sc = STATUS_COLORS[billingStatus]

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Billing</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Record payments and track outstanding balances.</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:16,alignItems:'start'}}>
        {/* Patient list */}
        <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:14,overflow:'hidden'}}>
          <div style={{padding:'12px 14px',borderBottom:'1px solid #dde3ec'}}>
            <input style={{...inp}} placeholder="Search patients…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {filtered.length===0 && <div style={{padding:20,color:'#8898aa',fontSize:13,textAlign:'center'}}>No patients found</div>}
          {filtered.map(p=>(
            <div key={p.id} onClick={()=>load(p.id)}
              style={{padding:'11px 14px',cursor:'pointer',borderBottom:'1px solid #f0f4f8',
                background:selected===p.id?'#f0f6ff':'#fff',transition:'background .1s'}}>
              <div style={{fontSize:13,fontWeight:selected===p.id?600:400}}>{p.full_name}</div>
              <div style={{fontSize:11.5,color:'#8898aa',marginTop:2}}>{p.doctor_name}</div>
            </div>
          ))}
        </div>

        {/* Billing detail */}
        {detail ? (
          <div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:14,color:'#1a2636'}}>{detail.patient.full_name}</div>

            {detail.billing ? (
              <>
                {/* Summary cards */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:14}}>
                  {[
                    ['Total Billed', fmtEGP(totalBilled), '#1a2636'],
                    ['Amount Paid',  fmtEGP(totalPaid),   '#059669'],
                    ['Balance Due',  fmtEGP(balance),      balance>0?'#e11d48':'#059669'],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:9,padding:'14px 18px'}}>
                      <div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>{l}</div>
                      <div style={{fontSize:20,fontWeight:700,fontFamily:'monospace',color:c}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Status badge */}
                <div style={{marginBottom:14}}>
                  <span style={{display:'inline-block',background:sc.bg,color:sc.color,fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:20,textTransform:'uppercase',letterSpacing:'.04em'}}>
                    {billingStatus === 'paid' ? '✓ Fully Paid' : billingStatus === 'partial' ? '◐ Partial Payment' : '✕ Unpaid'}
                  </span>
                </div>

                {/* Discount */}
                <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:9,padding:'18px 20px',marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:currentDiscount>0||editingDiscount?10:0}}>
                    <div style={{fontWeight:600,fontSize:13}}>Discount</div>
                    {!editingDiscount && (
                      <button onClick={startDiscount}
                        style={{padding:'5px 12px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12,color:'#155eef',fontWeight:500}}>
                        {currentDiscount>0 ? '✎ Edit discount' : '+ Apply discount'}
                      </button>
                    )}
                  </div>

                  {!editingDiscount && currentDiscount > 0 && (
                    <div style={{fontSize:12.5,color:'#4a5a70'}}>
                      <div>Gross total: <strong style={{fontFamily:'monospace'}}>{fmtEGP(grossTotal)}</strong></div>
                      <div style={{color:'#e11d48'}}>Discount: <strong style={{fontFamily:'monospace'}}>−{fmtEGP(currentDiscount)}</strong></div>
                      {detail.billing.discount_reason && <div style={{marginTop:4,fontStyle:'italic'}}>"{detail.billing.discount_reason}"</div>}
                    </div>
                  )}
                  {!editingDiscount && currentDiscount === 0 && (
                    <div style={{fontSize:12.5,color:'#8898aa'}}>No discount applied. Consultation fees ({fmtEGP(consultationTotal)}) are always excluded from any discount.</div>
                  )}

                  {editingDiscount && (
                    <div>
                      <div style={{fontSize:12,color:'#8898aa',marginBottom:10}}>
                        Consultation fees (<strong>{fmtEGP(consultationTotal)}</strong>) are excluded — max discount available: <strong style={{color:'#155eef'}}>{fmtEGP(discountableMax)}</strong>
                      </div>
                      {discountError && <div style={{background:'#ffe4e6',color:'#e11d48',border:'1px solid #fecdd3',borderRadius:6,padding:'9px 13px',fontSize:13,marginBottom:12}}>{discountError}</div>}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:12}}>
                        <div>
                          <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Discount (EGP)</label>
                          <input style={inp} type="number" step="0.01" min="0" max={discountableMax}
                            placeholder={`Max: ${fmtEGP(discountableMax)}`}
                            value={discountAmount} onChange={e=>setDiscountAmount(e.target.value)}/>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Referring doctor's request / reason</label>
                          <input style={inp} placeholder="e.g. Requested by Dr. Shouman — financial hardship"
                            value={discountReason} onChange={e=>setDiscountReason(e.target.value)}/>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                        <button onClick={()=>setEditingDiscount(false)} disabled={discountSaving}
                          style={{padding:'8px 16px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:13}}>Cancel</button>
                        <button onClick={saveDiscount} disabled={discountSaving}
                          style={{padding:'8px 18px',borderRadius:6,border:'none',background:'#155eef',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
                          {discountSaving?'Saving…':'Apply Discount'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment history */}
                {detail.payments.length > 0 && (
                  <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:9,marginBottom:14,overflow:'hidden'}}>
                    <div style={{padding:'12px 18px',borderBottom:'1px solid #dde3ec',fontWeight:600,fontSize:13}}>Payment History</div>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{background:'#f7f9fc'}}>
                        {['Date','Amount (EGP)','Method','Insurance / Company / Notes','Status',''].map(h=>(
                          <th key={h} style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {detail.payments.map(p=>{
                          const editing = editingId === p.id
                          const st = p.status || 'confirmed'
                          const PAY_STATUS_COLORS = {
                            confirmed: {bg:'#d1fae5',color:'#059669'},
                            pending:   {bg:'#fef3c7',color:'#f59e0b'},
                            cancelled: {bg:'#ffe4e6',color:'#e11d48'},
                          }
                          const psc = PAY_STATUS_COLORS[st] || PAY_STATUS_COLORS.confirmed
                          return (
                          <tr key={p.id} style={{borderBottom:'1px solid #f0f4f8',background:editing?'#f0f6ff':'transparent'}}>
                            <td style={{padding:'10px 16px',fontSize:13}}>{fmtDate(p.payment_date)}</td>
                            <td style={{padding:'10px 16px',fontSize:13,fontWeight:600,color:'#059669',fontFamily:'monospace'}}>
                              {editing
                                ? <input style={{...inp,width:110,padding:'5px 8px'}} type="number" step="0.01" min="0.01"
                                    value={editAmount} onChange={e=>setEditAmount(e.target.value)}/>
                                : fmtEGP(p.amount_egp)}
                            </td>
                            <td style={{padding:'10px 16px'}}>
                              <span style={{fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,textTransform:'capitalize',
                                background:p.method==='credit'?'#eef2ff':'#d1fae5',color:p.method==='credit'?'#4338ca':'#059669'}}>
                                {p.method.replace('_',' ')}
                              </span>
                            </td>
                            <td style={{padding:'10px 16px',fontSize:12.5,color:'#8898aa'}}>{p.reference||'—'}</td>
                            <td style={{padding:'10px 16px'}}>
                              {editing
                                ? <select style={{...inp,width:120,padding:'5px 8px'}} value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="pending">Pending</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                : <span style={{fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,textTransform:'capitalize',background:psc.bg,color:psc.color}}>{st}</span>}
                            </td>
                            <td style={{padding:'10px 16px',textAlign:'right',whiteSpace:'nowrap'}}>
                              {editing ? (
                                <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                                  <button onClick={()=>setEditingId(null)} disabled={editSaving}
                                    style={{padding:'5px 10px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12}}>Cancel</button>
                                  <button onClick={()=>saveEdit(p.id)} disabled={editSaving}
                                    style={{padding:'5px 12px',borderRadius:6,border:'none',background:'#155eef',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>
                                    {editSaving?'Saving…':'Save'}
                                  </button>
                                </div>
                              ) : (
                                <button onClick={()=>startEdit(p)}
                                  style={{padding:'5px 10px',borderRadius:6,border:'1px solid #dde3ec',background:'#fff',cursor:'pointer',fontSize:12,color:'#155eef',fontWeight:500}}>✎ Edit</button>
                              )}
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {editError && editingId && <div style={{padding:'10px 18px',background:'#ffe4e6',color:'#e11d48',fontSize:12.5,borderTop:'1px solid #fecdd3'}}>{editError}</div>}
                  </div>
                )}

                {/* Add payment — always show if balance > 0 */}
                {!isFullyPaid && (
                  <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:9,padding:'18px 20px'}}>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Record Payment</div>
                    <div style={{fontSize:12.5,color:'#8898aa',marginBottom:14}}>
                      Balance due: <strong style={{color:'#e11d48'}}>{fmtEGP(balance)}</strong>
                    </div>

                    {error && <div style={{background:'#ffe4e6',color:'#e11d48',border:'1px solid #fecdd3',borderRadius:6,padding:'9px 13px',fontSize:13,marginBottom:12}}>{error}</div>}

                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                      <div>
                        <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Amount (EGP) *</label>
                        <input style={inp} type="number" step="0.01" min="0.01"
                          placeholder={`Max: ${fmtEGP(balance)}`}
                          value={payForm.amount_egp}
                          onChange={e=>setPayForm(f=>({...f,amount_egp:e.target.value}))}/>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Method *</label>
                        <select style={inp} value={payForm.method} onChange={e=>setPayForm(f=>({...f,method:e.target.value}))}>
                          <option value="cash">Cash</option>
                          <option value="credit">Credit</option>
                        </select>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Date</label>
                        <input style={inp} type="date" value={payForm.payment_date} onChange={e=>setPayForm(f=>({...f,payment_date:e.target.value}))}/>
                      </div>
                    </div>
                    <div style={{marginBottom:14}}>
                      <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>
                        {payForm.method === 'credit' ? 'Insurance / Company name *' : 'Reference / notes'}
                      </label>
                      <input style={inp}
                        placeholder={payForm.method === 'credit' ? 'e.g. Allianz, Bupa, employer name…' : 'Transaction reference, cheque number, or notes'}
                        value={payForm.reference} onChange={e=>setPayForm(f=>({...f,reference:e.target.value}))}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'flex-end'}}>
                      <button onClick={addPayment} disabled={saving||!payForm.amount_egp||(payForm.method==='credit'&&!payForm.reference.trim())}
                        style={{padding:'9px 22px',borderRadius:7,border:'none',background:'#059669',color:'#fff',
                          cursor:saving||!payForm.amount_egp?'not-allowed':'pointer',fontSize:13,fontWeight:600,
                          opacity:(!payForm.amount_egp||(payForm.method==='credit'&&!payForm.reference.trim()))?.6:1}}>
                        {saving ? 'Saving…' : 'Record Payment'}
                      </button>
                    </div>
                  </div>
                )}

                {isFullyPaid && (
                  <div style={{background:'#d1fae5',border:'1px solid #a7f3d0',borderRadius:8,padding:'14px 18px',fontSize:13,color:'#059669',fontWeight:500}}>
                    ✓ This account is fully settled. No balance remaining.
                  </div>
                )}
              </>
            ) : (
              <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:9,padding:32,textAlign:'center',color:'#8898aa',fontSize:13}}>
                No cost estimate has been submitted for this patient yet. A billing record is created automatically when the doctor submits a cost estimate.
              </div>
            )}
          </div>
        ) : (
          <div style={{background:'#fff',border:'1px solid #e7ebf1',boxShadow:'0 2px 6px rgba(15,23,42,.06),0 14px 32px -12px rgba(21,94,239,.28)',borderRadius:14,padding:48,textAlign:'center',color:'#8898aa',fontSize:13}}>
            Select a patient from the list to view and manage billing.
          </div>
        )}
      </div>
    </div>
  )
}
