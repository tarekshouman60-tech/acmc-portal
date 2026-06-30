import React, { useEffect, useState } from 'react'
import { api, fmtEGP, fmtDate } from '../api.js'
import { useAuth } from '../App.jsx'

const inp = {border:'1px solid #dde3ec',borderRadius:6,padding:'8px 11px',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%'}
const FL = ({label,children}) => <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4a5a70',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{label}</label>{children}</div>

function Badge({status}) {
  const map = {
    pending:{bg:'#fef4e7',color:'#e67e22'},
    partial:{bg:'#eef2ff',color:'#4338ca'},
    transferred:{bg:'#e8f7ef',color:'#1a7a4a'}
  }
  const s = map[status]||{bg:'#f0f4f8',color:'#8898aa'}
  return <span style={{background:s.bg,color:s.color,fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20}}>{status?.replace('_',' ').toUpperCase()}</span>
}

// ── Admin view ────────────────────────────────────────────────────────────────
function AdminEarnings() {
  const [summary, setSummary] = useState([])
  const [earnings, setEarnings] = useState([])
  const [patients, setPatients] = useState([])
  const [estimates, setEstimates] = useState({})
  const [selDoctor, setSelDoctor] = useState(null)
  const [feeInput, setFeeInput] = useState('')
  const [savingFee, setSavingFee] = useState(false)
  const [earningForm, setEarningForm] = useState({estimate_id:'',doctor_fees_egp:''})
  const [transferForm, setTransferForm] = useState({earning_id:'',amount_egp:'',method:'bank_transfer',reference:'',transfer_date:''})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [allEstimates, setAllEstimates] = useState([])
  const [bonusPct, setBonusPct] = useState('5')
  const [savingBonus, setSavingBonus] = useState(false)

  useEffect(() => {
    api.earningsSummary().then(setSummary)
    api.listEarnings().then(setEarnings)
    api.estimatesList().then(setAllEstimates)
    api.getSetting('workers_bonus_pct').then(s => setBonusPct(s.value || '5'))
  }, [])

  async function saveBonusPct() {
    setSavingBonus(true)
    await api.updateSetting('workers_bonus_pct', bonusPct)
    setSavingBonus(false)
  }

  useEffect(() => {
    if (selDoctor) {
      setFeeInput(selDoctor.referral_fee_pct || '')
      api.patients().then(ps => setPatients(ps.filter(p => p.doctor_id === selDoctor.id || p.doctor_name === selDoctor.full_name)))
    }
  }, [selDoctor])

  async function saveFee() {
    if (!selDoctor) return
    setSavingFee(true)
    await api.setDoctorFee(selDoctor.id, parseFloat(feeInput)||0)
    const fresh = await api.earningsSummary(); setSummary(fresh)
    setSavingFee(false)
  }

  async function createEarning() {
    if (!earningForm.estimate_id) { setError('Select an estimate'); return }
    setSaving(true); setError('')
    try {
      await api.createEarning({estimate_id:parseInt(earningForm.estimate_id), doctor_fees_egp:parseFloat(earningForm.doctor_fees_egp)||0})
      const fresh = await api.listEarnings(); setEarnings(fresh)
      const freshSum = await api.earningsSummary(); setSummary(freshSum)
      setEarningForm({estimate_id:'',doctor_fees_egp:''})
    } catch(e){setError(e.message)} finally{setSaving(false)}
  }

  async function addTransfer() {
    if (!transferForm.earning_id||!transferForm.amount_egp) {setError('Fill earning and amount'); return}
    setSaving(true); setError('')
    try {
      await api.addTransfer({earning_id:parseInt(transferForm.earning_id), amount_egp:parseFloat(transferForm.amount_egp), method:transferForm.method, reference:transferForm.reference, transfer_date:transferForm.transfer_date||null})
      const fresh = await api.listEarnings(); setEarnings(fresh)
      const freshS = await api.earningsSummary(); setSummary(freshS)
      setTransferForm({earning_id:'',amount_egp:'',method:'bank_transfer',reference:'',transfer_date:''})
    } catch(e){setError(e.message)} finally{setSaving(false)}
  }

  const docEarnings = selDoctor ? earnings.filter(e=>e.doctor_id===selDoctor.id) : []

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Doctor Earnings</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Manage referral fees, shares and transfers per doctor.</p>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {['overview','calculate','transfer'].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'7px 16px',borderRadius:20,border:'1px solid #dde3ec',fontSize:13,fontWeight:500,cursor:'pointer',
              background:tab===t?'#0b4f82':'#fff',color:tab===t?'#fff':'#4a5a70'}}>
            {t==='overview'?'Overview':t==='calculate'?'Set Fee & Calculate':'Record Transfer'}
          </button>
        ))}
      </div>

      {error && <div style={{background:'#fdecea',color:'#c0392b',border:'1px solid #f5c6c2',borderRadius:7,padding:'10px 14px',fontSize:13,marginBottom:12}}>{error}</div>}

      {/* Overview tab */}
      {tab==='overview' && (
        <div>
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden',marginBottom:16}}>
            <div style={{padding:'13px 20px',borderBottom:'1px solid #dde3ec',fontWeight:600,fontSize:14}}>Doctor Summary</div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f7f9fc'}}>
                {['Doctor','Fee %','Patients','Total Due (EGP)','Transferred (EGP)','Balance (EGP)'].map(h=>(
                  <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {summary.map(d=>(
                  <tr key={d.id} style={{borderBottom:'1px solid #f0f4f8',cursor:'pointer',background:selDoctor?.id===d.id?'#f0f6ff':'#fff'}}
                    onClick={()=>setSelDoctor(d)}>
                    <td style={{padding:'11px 16px',fontSize:13,fontWeight:500}}>{d.full_name}</td>
                    <td style={{padding:'11px 16px',fontSize:13}}>{d.referral_fee_pct}%</td>
                    <td style={{padding:'11px 16px',fontSize:13}}>{d.patient_count}</td>
                    <td style={{padding:'11px 16px',fontSize:13,fontFamily:'monospace',fontWeight:500}}>{fmtEGP(d.total_due)}</td>
                    <td style={{padding:'11px 16px',fontSize:13,fontFamily:'monospace',color:'#1a7a4a'}}>{fmtEGP(d.total_transferred)}</td>
                    <td style={{padding:'11px 16px',fontSize:13,fontFamily:'monospace',color:parseFloat(d.total_balance)>0?'#c0392b':'#1a7a4a',fontWeight:600}}>{fmtEGP(d.total_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected doctor detail */}
          {selDoctor && (
            <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'13px 20px',borderBottom:'1px solid #dde3ec',fontWeight:600,fontSize:14}}>
                {selDoctor.full_name} — Patient Earnings Detail
              </div>
              {docEarnings.length===0
                ? <div style={{padding:24,color:'#8898aa',fontSize:13,textAlign:'center'}}>No earnings calculated yet for this doctor.</div>
                : <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f7f9fc'}}>
                      {['Patient','Month','Billed','Fee %','Ref. Amount','Bonus','Dr. Fees','Total Due','Transferred','Balance','Status'].map(h=>(
                        <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:'10px',fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.04em',borderBottom:'1px solid #dde3ec',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {docEarnings.map(e=>(
                        <tr key={e.id} style={{borderBottom:'1px solid #f0f4f8'}}>
                          <td style={{padding:'9px 12px',fontSize:13,fontWeight:500}}>{e.patient_name}</td>
                          <td style={{padding:'9px 12px',fontSize:12,color:'#4a5a70'}}>{e.month}</td>
                          <td style={{padding:'9px 12px',fontSize:12,fontFamily:'monospace'}}>{fmtEGP(e.total_billed_egp)}</td>
                          <td style={{padding:'9px 12px',fontSize:12}}>{e.referral_pct}%</td>
                          <td style={{padding:'9px 12px',fontSize:12,fontFamily:'monospace'}}>{fmtEGP(e.referral_amount_egp)}</td>
                          <td style={{padding:'9px 12px',fontSize:12,fontFamily:'monospace',color:'#c0392b'}}>-{fmtEGP(e.workers_bonus_egp)}</td>
                          <td style={{padding:'9px 12px',fontSize:12,fontFamily:'monospace'}}>{fmtEGP(e.doctor_fees_egp)}</td>
                          <td style={{padding:'9px 12px',fontSize:12,fontFamily:'monospace',fontWeight:600}}>{fmtEGP(e.total_due_egp)}</td>
                          <td style={{padding:'9px 12px',fontSize:12,fontFamily:'monospace',color:'#1a7a4a'}}>{fmtEGP(e.transferred_egp)}</td>
                          <td style={{padding:'9px 12px',fontSize:12,fontFamily:'monospace',color:parseFloat(e.balance_egp)>0?'#c0392b':'#1a7a4a',fontWeight:600}}>{fmtEGP(e.balance_egp)}</td>
                          <td style={{padding:'9px 12px'}}><Badge status={e.status}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          )}
        </div>
      )}

      {/* Calculate tab */}
      {tab==='calculate' && (
        <div>
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 20px',marginBottom:16,maxWidth:420}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Workers Bonus Deduction</div>
            <div style={{fontSize:12.5,color:'#8898aa',marginBottom:14}}>Automatically deducted from every doctor's referral amount.</div>
            <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
              <div style={{flex:1}}>
                <FL label="Bonus % (deducted from referral amount)">
                  <input style={inp} type="number" min="0" max="100" step="0.5" value={bonusPct} onChange={e=>setBonusPct(e.target.value)}/>
                </FL>
              </div>
              <button onClick={saveBonusPct} disabled={savingBonus}
                style={{padding:'9px 18px',borderRadius:7,border:'none',background:'#7c3aed',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,whiteSpace:'nowrap'}}>
                {savingBonus?'Saving…':'Save %'}
              </button>
            </div>
          </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Set fee per doctor */}
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'20px'}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:16}}>Set Referral Fee % per Doctor</div>
            <div style={{marginBottom:14}}>
              <FL label="Select doctor">
                <select style={inp} value={selDoctor?.id||''} onChange={e=>{const d=summary.find(x=>x.id===parseInt(e.target.value));setSelDoctor(d);setFeeInput(d?.referral_fee_pct||'')}}>
                  <option value="">Select doctor</option>
                  {summary.map(d=><option key={d.id} value={d.id}>{d.full_name} (current: {d.referral_fee_pct}%)</option>)}
                </select>
              </FL>
            </div>
            <div style={{marginBottom:14}}>
              <FL label="Referral fee (%)">
                <input style={inp} type="number" min="0" max="100" step="0.5" value={feeInput} onChange={e=>setFeeInput(e.target.value)} placeholder="e.g. 10"/>
              </FL>
            </div>
            <button onClick={saveFee} disabled={savingFee||!selDoctor}
              style={{width:'100%',padding:'9px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
              {savingFee?'Saving…':'Save Fee %'}
            </button>
          </div>

          {/* Calculate earning for patient */}
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'20px'}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:16}}>Calculate Doctor Earning per Patient</div>
            <div style={{marginBottom:14}}>
              <FL label="Cost estimate (patient)">
                <select style={inp} value={earningForm.estimate_id} onChange={e=>setEarningForm(f=>({...f,estimate_id:e.target.value}))}>
                  <option value="">Select patient estimate</option>
                  {allEstimates.map(e=>(
                    <option key={e.id} value={e.id}>
                      {e.patient_name} — {e.doctor_name} — {e.total_egp ? fmtEGP(e.total_egp) : 'TBD'} ({e.order_ref})
                    </option>
                  ))}
                </select>
              </FL>
            </div>
            <div style={{marginBottom:14}}>
              <FL label="Doctor's own fees (EGP)">
                <input style={inp} type="number" min="0" value={earningForm.doctor_fees_egp} onChange={e=>setEarningForm(f=>({...f,doctor_fees_egp:e.target.value}))} placeholder="Consultation + follow-up + MDT"/>
              </FL>
            </div>
            <button onClick={createEarning} disabled={saving}
              style={{width:'100%',padding:'9px',borderRadius:7,border:'none',background:'#1a7a4a',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
              {saving?'Calculating…':'Calculate & Save'}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Transfer tab */}
      {tab==='transfer' && (
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'20px',maxWidth:600}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:16}}>Record Transfer to Doctor</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13}}>
            <FL label="Earning record">
              <select style={inp} value={transferForm.earning_id} onChange={e=>setTransferForm(f=>({...f,earning_id:e.target.value}))}>
                <option value="">Select patient earning</option>
                {earnings.filter(e=>e.status!=='transferred').map(e=>(
                  <option key={e.id} value={e.id}>{e.patient_name} — Balance: {fmtEGP(e.balance_egp)}</option>
                ))}
              </select>
            </FL>
            <FL label="Amount (EGP)">
              <input style={inp} type="number" value={transferForm.amount_egp} onChange={e=>setTransferForm(f=>({...f,amount_egp:e.target.value}))} placeholder="Amount to transfer"/>
            </FL>
            <FL label="Method">
              <select style={inp} value={transferForm.method} onChange={e=>setTransferForm(f=>({...f,method:e.target.value}))}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Cheque</option>
              </select>
            </FL>
            <FL label="Date">
              <input style={inp} type="date" value={transferForm.transfer_date} onChange={e=>setTransferForm(f=>({...f,transfer_date:e.target.value}))}/>
            </FL>
          </div>
          <div style={{marginBottom:14}}>
            <FL label="Reference / notes">
              <input style={inp} value={transferForm.reference} onChange={e=>setTransferForm(f=>({...f,reference:e.target.value}))} placeholder="Transaction reference or notes"/>
            </FL>
          </div>
          <button onClick={addTransfer} disabled={saving||!transferForm.earning_id||!transferForm.amount_egp}
            style={{width:'100%',padding:'9px',borderRadius:7,border:'none',background:'#0b4f82',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
            {saving?'Saving…':'Record Transfer'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Doctor view ───────────────────────────────────────────────────────────────
function DoctorEarnings() {
  const [summary, setSummary] = useState(null)
  const [earnings, setEarnings] = useState([])
  const [month, setMonth] = useState('')

  useEffect(() => {
    api.earningsSummary().then(setSummary)
    api.listEarnings().then(setEarnings)
    api.estimatesList().then(setAllEstimates)
    api.getSetting('workers_bonus_pct').then(s => setBonusPct(s.value || '5'))
  }, [])

  async function saveBonusPct() {
    setSavingBonus(true)
    await api.updateSetting('workers_bonus_pct', bonusPct)
    setSavingBonus(false)
  }

  const months = [...new Set(earnings.map(e=>e.month))].sort().reverse()
  const filtered = month ? earnings.filter(e=>e.month===month) : earnings

  if (!summary) return <div style={{padding:40,textAlign:'center'}}><div style={{width:28,height:28,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto'}}/></div>

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700}}>My Earnings</h1>
        <p style={{color:'#4a5a70',fontSize:13,marginTop:3}}>Your referral fees and transfer history.</p>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:20}}>
        {[
          ['Patients',summary.summary?.patient_count,'#0b4f82'],
          ['Total Due',fmtEGP(summary.summary?.total_due),'#1a2636'],
          ['Transferred',fmtEGP(summary.summary?.transferred),'#1a7a4a'],
          ['Pending',fmtEGP(summary.summary?.balance),'#c0392b'],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,padding:'18px 20px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em'}}>{l}</div>
            <div style={{fontSize:22,fontWeight:700,color:c,marginTop:6,fontFamily:'monospace'}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Monthly filter */}
      {months.length > 0 && (
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          <button onClick={()=>setMonth('')} style={{padding:'5px 13px',borderRadius:20,border:'1px solid #dde3ec',fontSize:12.5,fontWeight:500,cursor:'pointer',background:!month?'#0b4f82':'#fff',color:!month?'#fff':'#4a5a70'}}>All</button>
          {months.map(m=>(
            <button key={m} onClick={()=>setMonth(m)} style={{padding:'5px 13px',borderRadius:20,border:'1px solid #dde3ec',fontSize:12.5,fontWeight:500,cursor:'pointer',background:month===m?'#0b4f82':'#fff',color:month===m?'#fff':'#4a5a70'}}>{m}</button>
          ))}
        </div>
      )}

      {/* Earnings table */}
      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'13px 20px',borderBottom:'1px solid #dde3ec',fontWeight:600,fontSize:14}}>Earnings per Patient</div>
        {filtered.length===0
          ? <div style={{padding:32,textAlign:'center',color:'#8898aa',fontSize:13}}>No earnings recorded yet. ACMC admin will calculate your fees after patient billing.</div>
          : <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f7f9fc'}}>
                {['Patient','Month','Total Billed','Your Fee %','Referral Amt','Bonus Deduction','Your Fees','Total Due','Transferred','Balance','Status'].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.04em',borderBottom:'1px solid #dde3ec',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(e=>(
                  <tr key={e.id} style={{borderBottom:'1px solid #f0f4f8'}}>
                    <td style={{padding:'10px 12px',fontSize:13,fontWeight:500}}>{e.patient_name}</td>
                    <td style={{padding:'10px 12px',fontSize:12,color:'#4a5a70'}}>{e.month}</td>
                    <td style={{padding:'10px 12px',fontSize:12,fontFamily:'monospace'}}>{fmtEGP(e.total_billed_egp)}</td>
                    <td style={{padding:'10px 12px',fontSize:12}}>{e.referral_pct}%</td>
                    <td style={{padding:'10px 12px',fontSize:12,fontFamily:'monospace'}}>{fmtEGP(e.referral_amount_egp)}</td>
                    <td style={{padding:'10px 12px',fontSize:12,fontFamily:'monospace',color:'#c0392b'}}>-{fmtEGP(e.workers_bonus_egp)}</td>
                    <td style={{padding:'10px 12px',fontSize:12,fontFamily:'monospace'}}>{fmtEGP(e.doctor_fees_egp)}</td>
                    <td style={{padding:'10px 12px',fontSize:13,fontFamily:'monospace',fontWeight:700}}>{fmtEGP(e.total_due_egp)}</td>
                    <td style={{padding:'10px 12px',fontSize:12,fontFamily:'monospace',color:'#1a7a4a'}}>{fmtEGP(e.transferred_egp)}</td>
                    <td style={{padding:'10px 12px',fontSize:12,fontFamily:'monospace',color:parseFloat(e.balance_egp)>0?'#c0392b':'#1a7a4a',fontWeight:600}}>{fmtEGP(e.balance_egp)}</td>
                    <td style={{padding:'10px 12px'}}><Badge status={e.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {/* Monthly breakdown */}
      {summary.monthly?.length > 0 && (
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:10,overflow:'hidden',marginTop:16}}>
          <div style={{padding:'13px 20px',borderBottom:'1px solid #dde3ec',fontWeight:600,fontSize:14}}>Monthly Summary</div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#f7f9fc'}}>
              {['Month','Patients','Due','Transferred','Balance'].map(h=>(
                <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10.5,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #dde3ec'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {summary.monthly.map(m=>(
                <tr key={m.month} style={{borderBottom:'1px solid #f0f4f8'}}>
                  <td style={{padding:'10px 16px',fontSize:13,fontWeight:500}}>{m.month}</td>
                  <td style={{padding:'10px 16px',fontSize:13}}>{m.patients}</td>
                  <td style={{padding:'10px 16px',fontSize:13,fontFamily:'monospace',fontWeight:600}}>{fmtEGP(m.due)}</td>
                  <td style={{padding:'10px 16px',fontSize:13,fontFamily:'monospace',color:'#1a7a4a'}}>{fmtEGP(m.transferred)}</td>
                  <td style={{padding:'10px 16px',fontSize:13,fontFamily:'monospace',color:parseFloat(m.balance)>0?'#c0392b':'#1a7a4a',fontWeight:600}}>{fmtEGP(m.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Earnings() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <AdminEarnings/> : <DoctorEarnings/>
}
