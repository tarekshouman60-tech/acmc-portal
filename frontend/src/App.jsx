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
import ChangePassword from './pages/ChangePassword.jsx'

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

  function navigate(p, pr={}) { setPage(p); setParams(pr) }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><div style={{width:32,height:32,border:'3px solid #dde3ec',borderTopColor:'#0b4f82',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!user) return <Login onLogin={u=>setUser(u)}/>

  function renderPage() {
    switch(page) {
      case 'dashboard':      return <Dashboard navigate={navigate}/>
      case 'patients':       return <Patients navigate={navigate}/>
      case 'patient-detail': return <PatientDetail navigate={navigate} patientId={params.patientId}/>
      case 'sim-order':      return <SimOrder navigate={navigate} patientId={params.patientId}/>
      case 'clinical-order': return <ClinicalOrder navigate={navigate} patientId={params.patientId}/>
      case 'cost-estimate':  return <CostEstimate navigate={navigate} patientId={params.patientId}/>
      case 'my-orders':      return <AllOrders navigate={navigate} doctorOnly/>
      case 'all-orders':     return <AllOrders navigate={navigate}/>
      case 'services':       return <Services/>
      case 'doctors':        return <Doctors/>
      case 'milestones':     return <Milestones navigate={navigate}/>
      case 'billing':          return <Billing navigate={navigate}/>
      case 'change-password': return <ChangePassword/>
      default:               return <Dashboard navigate={navigate}/>
    }
  }

  return (
    <AuthCtx.Provider value={{user, logout:()=>{localStorage.clear();setUser(null)}}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Layout page={page} navigate={navigate}>{renderPage()}</Layout>
    </AuthCtx.Provider>
  )
}
