import React, { useEffect, useState } from 'react'
import { api, fmtEGP, fmtDate } from '../api.js'

export default function Billing() {
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [payForm, setPayForm] = useState({amount_egp:'',method:'cash',reference:'',notes:'',payment_date:''})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { api.patients().then(setPatients) }, [])

  async function load(pid) {
    setSelected(pid)
    const d = await api.getPatient(pid); setDetail(d)
  }

  async function addPayment() {
    if (!detail?.billing || !payForm.amount_egp) return
    setSaving(true)
    await api.addPayment({billing_id:detail.billing.id, amount_egp:parseFloat(payForm.amount_egp), method:payForm.method, reference:payForm.reference, notes:payForm.notes, payment_date:payForm.payment_date||null})
    await load(selected)
    setPayForm({amount_egp:'',method:'cash',reference:'',notes:'',payment_date:''})
    setSaving(false)
  }

  const filtered = patients.filter(p=>p.full_name.toLowerCase().includes(search.toLowerCase()))
  const inp = {border:'1px solid #dde3ec',borderRadius:5,padding:'7px 10px',fontSize:13,fontFamily:'inherit',outline:'none'}

  return (
    <div>
      <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700}}>Billing</h1><p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Record payments and track outstanding balances.</p></div>
      <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:16,alignItems:'start'}}>
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'12px 14px',borderBottom:'1px solid #dde3ec'}}>
            <input style={{...inp,width:'100%'}} placeholder="Search patients…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {filtered.map(p=>(
            <div key={p.id} onClick={()=>load(p.id)} style={{padding:'11px 14px',cursor:'pointer',borderBottom:'1px solid #f0f4f8',background:selected===p.id?'#f0f6ff':'#fff'}}>
              <div style={{fontSize:13,fontWeight:selected===p.id?600:400}}>{p.full_name}</div>
              <div style={{fontSize:11.5,color:'#8898aa',marginTop:2}}>{p.doctor_name}</div>
            </div>
          ))}
        </div>

        {detail ? (
          <div>
            <div style={{fontWeight:600,fontSize:15,marginBottom:14}}>{detail.patient.full_name}</div>
            {detail.billing ? (
              <>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:14}}>
                  {[['Total Billed',fmtEGP(detail.billing.total_amount_egp),'#1a2636'],['Amount Paid',fmtEGP(detail.billing.amount_paid_egp),'#1a7a4a'],['Balance Due',fmtEGP(detail.billing.balance_egp),'#c0392b']].map(([l,v,c])=>(
                    <div key={l} style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:9,padding:'14px 18px'}}>
                      <div style={{fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{l}</div>
                      <div style={{fontSize:18,fontWeight:700,fontFamily:'monospace',color:c}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Payment history */}
                {detail.payments.length>0 && (
                  <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:9,marginBottom:14,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:'1px solid #dde3ec',fontWeight:600,fontSize:13}}>Payment History</div>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{background:'#f7f9fc'}}>{['Date','Amount','Method','Reference'].map(h=><th key={h} style={{padding:'8px 14px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>)}</tr></thead>
                      <tbody>
                        {detail.payments.map(p=>(
                          <tr key={p.id}>
                            <td style={{padding:'9px 14px',fontSize:12.5,borderBottom:'1px solid #f0f4f8'}}>{fmtDate(p.payment_date)}</td>
                            <td style={{padding:'9px 14px',fontSize:13,fontWeight:600,color:'#1a7a4a',fontFamily:'monospace',borderBottom:'1px solid #f0f4f8'}}>{fmtEGP(p.amount_egp)}</td>
                            <td style={{padding:'9px 14px',fontSize:12.5,color:'#4a5a70',borderBottom:'1px solid #f0f4f8',textTransform:'capitalize'}}>{p.method}</td>
                            <td style={{padding:'9px 14px',fontSize:12,color:'#8898aa',borderBottom:'1px solid #f0f4f8'}}>{p.reference||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add payment */}
                {detail.billing.status !== 'paid' && (
                  <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:9,padding:'18px 20px'}}>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:14}}>Record Payment</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                      <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Amount (EGP)</label><input style={inp} type="number" placeholder="0.00" value={payForm.amount_egp} onChange={e=>setPayForm(f=>({...f,amount_egp:e.target.value}))}/></div>
                      <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Method</label>
                        <select style={{...inp,width:'100%'}} value={payForm.method} onChange={e=>setPayForm(f=>({...f,method:e.target.value}))}>
                          <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option>
                        </select>
                      </div>
                      <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Date</label><input style={inp} type="date" value={payForm.payment_date} onChange={e=>setPayForm(f=>({...f,payment_date:e.target.value}))}/></div>
                    </div>
                    <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Reference / notes</label><input style={{...inp,width:'100%'}} placeholder="Transaction reference or notes" value={payForm.reference} onChange={e=>setPayForm(f=>({...f,reference:e.target.value}))}/></div>
                    <div style={{display:'flex',justifyContent:'flex-end'}}>
                      <button onClick={addPayment} disabled={saving||!payForm.amount_egp} style={{padding:'9px 20px',borderRadius:7,border:'none',background:'#1a7a4a',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Record Payment'}</button>
                    </div>
                  </div>
                )}
                {detail.billing.status==='paid' && <div style={{background:'#e8f7ef',border:'1px solid #b7e4cc',borderRadius:8,padding:'12px 16px',fontSize:13,color:'#1a7a4a',fontWeight:500}}>✓ This account is fully paid.</div>}
              </>
            ) : (
              <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:9,padding:28,textAlign:'center',color:'#8898aa',fontSize:13}}>No cost estimate has been submitted for this patient yet.</div>
            )}
          </div>
        ) : (
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:40,textAlign:'center',color:'#8898aa',fontSize:13}}>Select a patient to view billing.</div>
        )}
      </div>
    </div>
  )
}
