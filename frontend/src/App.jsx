import React, { useState, useEffect, createContext, useContext } from 'react'
import { api } from './api.js'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Patients from './pages/Patients.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import Services from './pages/Services.jsx'
import Doctors from './pages/Doctors.jsx'
import AllOrders from './pages/AllOrders.jsx'
import SimOrder from './pages/SimOrder.jsx'
import ClinicalOrder from './pages/ClinicalOrder.jsx'
import CostEstimate from './pages/CostEstimate.jsx'
import Milestones from './pages/Milestones.jsx'
import Billing from './pages/Billing.jsx'
import Earnings from './pages/Earnings.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import RttSchedule from './pages/RttSchedule.jsx'
import RttAccounts from './pages/RttAccounts.jsx'
import PhysicistPlanning from './pages/PhysicistPlanning.jsx'
import PhysicistAccounts from './pages/PhysicistAccounts.jsx'

export const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [params, setParams] = useState({})

  useEffect(() => {
    const t = localStorage.getItem('acmc_token')
    if (t) { api.me().then(u=>{setUser(u);setLoading(false)}).catch(()=>{localStorage.clear();setLoading(false)}) }
    else setLoading(false)
  }, [])

  useEffect(() => {
    if (page !== 'dashboard') return
    if (user?.role === 'rtt') setPage('rtt-schedule')
    else if (user?.role === 'physicist') setPage('physicist-planning')
  }, [user])

  function navigate(p, pr={}) { setPage(p); setParams(pr) }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><div style={{width:32,height:32,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!user) return <Login onLogin={u=>{setUser(u);setPage('dashboard');setParams({})}}/>

  function renderPage() {
    switch(page) {
      case 'dashboard':      return user.role === 'rtt' ? <RttSchedule/> : user.role === 'physicist' ? <PhysicistPlanning/> : <Dashboard navigate={navigate}/>
      case 'patients':       return <Patients navigate={navigate}/>
      case 'patient-detail': return <PatientDetail navigate={navigate} patientId={params.patientId}/>
      case 'sim-order':      return <SimOrder key={params.patientId} navigate={navigate} patientId={params.patientId}/>
      case 'clinical-order': return <ClinicalOrder key={params.patientId} navigate={navigate} patientId={params.patientId}/>
      case 'cost-estimate':  return <CostEstimate key={params.patientId} navigate={navigate} patientId={params.patientId}/>
      case 'my-orders':      return <AllOrders navigate={navigate} doctorOnly/>
      case 'all-orders':     return <AllOrders navigate={navigate}/>
      case 'services':       return <Services/>
      case 'doctors':        return <Doctors/>
      case 'milestones':     return <Milestones navigate={navigate}/>
      case 'billing':          return <Billing navigate={navigate}/>
      case 'earnings':         return <Earnings/>
      case 'change-password': return <ChangePassword/>
      case 'rtt-schedule':    return <RttSchedule/>
      case 'rtt-accounts':    return <RttAccounts/>
      case 'physicist-planning': return <PhysicistPlanning/>
      case 'physicist-accounts': return <PhysicistAccounts/>
      default:               return <Dashboard navigate={navigate}/>
    }
  }

  return (
    <AuthCtx.Provider value={{user, logout:()=>{localStorage.clear();setUser(null);setPage('dashboard');setParams({})}}}>
      <Layout page={page} navigate={navigate}>{renderPage()}</Layout>
    </AuthCtx.Provider>
  )
}
