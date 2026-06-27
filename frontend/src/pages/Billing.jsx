import React, { useEffect, useState } from 'react'
import { api, fmtEGP, fmtDate } from '../api.js'

export default function Billing() {
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [payForm, setPayForm] = useState({amount_egp:'',method:'cash',reference:'',notes:'',payment_date:''})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

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

  const filtered = patients.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
  const inp = {border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%'}

  const balance = detail?.billing ? parseFloat(detail.billing.balance_egp) : 0
  const totalBilled = detail?.billing ? parseFloat(detail.billing.total_amount_egp) : 0
  const totalPaid = detail?.billing ? parseFloat(detail.billing.amount_paid_egp) : 0
  const isFullyPaid = balance <= 0
  const billingStatus = isFullyPaid ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

  const STATUS_COLORS = {
    paid:    {bg:'#e8f7ef',color:'#1a7a4a'},
    partial: {bg:'#fef4e7',color:'#e67e22'},
    unpaid:  {bg:'#fdecea',color:'#c0392b'},
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
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
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
                    ['Amount Paid',  fmtEGP(totalPaid),   '#1a7a4a'],
                    ['Balance Due',  fmtEGP(balance),      balance>0?'#c0392b':'#1a7a4a'],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:9,padding:'14px 18px'}}>
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

                {/* Payment history */}
                {detail.payments.length > 0 && (
                  <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:9,marginBottom:14,overflow:'hidden'}}>
                    <div style={{padding:'12px 18px',borderBottom:'1px solid #dde3ec',fontWeight:600,fontSize:13}}>Payment History</div>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{background:'#f7f9fc'}}>
                        {['Date','Amount (EGP)','Method','Reference'].map(h=>(
                          <th key={h} style={{padding:'8px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {detail.payments.map(p=>(
                          <tr key={p.id} style={{borderBottom:'1px solid #f0f4f8'}}>
                            <td style={{padding:'10px 16px',fontSize:13}}>{fmtDate(p.payment_date)}</td>
                            <td style={{padding:'10px 16px',fontSize:13,fontWeight:600,color:'#1a7a4a',fontFamily:'monospace'}}>{fmtEGP(p.amount_egp)}</td>
                            <td style={{padding:'10px 16px',fontSize:13,color:'#4a5a70',textTransform:'capitalize'}}>{p.method.replace('_',' ')}</td>
                            <td style={{padding:'10px 16px',fontSize:12.5,color:'#8898aa'}}>{p.reference||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add payment — always show if balance > 0 */}
                {!isFullyPaid && (
                  <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:9,padding:'18px 20px'}}>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Record Payment</div>
                    <div style={{fontSize:12.5,color:'#8898aa',marginBottom:14}}>
                      Balance due: <strong style={{color:'#c0392b'}}>{fmtEGP(balance)}</strong>
                    </div>

                    {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:6,padding:'9px 13px',fontSize:13,marginBottom:12}}>{error}</div>}

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
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="card">Card</option>
                          <option value="installment">Instalment</option>
                        </select>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Date</label>
                        <input style={inp} type="date" value={payForm.payment_date} onChange={e=>setPayForm(f=>({...f,payment_date:e.target.value}))}/>
                      </div>
                    </div>
                    <div style={{marginBottom:14}}>
                      <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Reference / notes</label>
                      <input style={inp} placeholder="Transaction reference, cheque number, or notes"
                        value={payForm.reference} onChange={e=>setPayForm(f=>({...f,reference:e.target.value}))}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'flex-end'}}>
                      <button onClick={addPayment} disabled={saving||!payForm.amount_egp}
                        style={{padding:'9px 22px',borderRadius:7,border:'none',background:'#1a7a4a',color:'#fff',
                          cursor:saving||!payForm.amount_egp?'not-allowed':'pointer',fontSize:13,fontWeight:600,
                          opacity:!payForm.amount_egp?.6:1}}>
                        {saving ? 'Saving…' : 'Record Payment'}
                      </button>
                    </div>
                  </div>
                )}

                {isFullyPaid && (
                  <div style={{background:'#e8f7ef',border:'1px solid #b7e4cc',borderRadius:8,padding:'14px 18px',fontSize:13,color:'#1a7a4a',fontWeight:500}}>
                    ✓ This account is fully settled. No balance remaining.
                  </div>
                )}
              </>
            ) : (
              <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:9,padding:32,textAlign:'center',color:'#8898aa',fontSize:13}}>
                No cost estimate has been submitted for this patient yet. A billing record is created automatically when the doctor submits a cost estimate.
              </div>
            )}
          </div>
        ) : (
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:48,textAlign:'center',color:'#8898aa',fontSize:13}}>
            Select a patient from the list to view and manage billing.
          </div>
        )}
      </div>
    </div>
  )
}
