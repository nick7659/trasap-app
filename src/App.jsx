import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Login      from './pages/Login'
import Dashboard  from './pages/Dashboard'
import CreateDoc  from './pages/CreateDoc'
import AckPage    from './pages/AckPage'
import './index.css'

export default function App() {
  // undefined = กำลังโหลด, null = ไม่ได้ login, object = login แล้ว
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // ดึง session ปัจจุบัน
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    // ฟัง event เมื่อ login / logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // หน้าโหลด
  if (session === undefined) {
    return (
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center',
        height:'100vh', background:'#1B2A4A', color:'#F7F3EA', fontSize:'1rem'
      }}>
        กำลังโหลด...
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* หน้าแรก: ถ้า login แล้วไป Dashboard, ถ้ายังไม่ login ไป Login */}
        <Route path="/"          element={session ? <Navigate to="/dashboard" /> : <Login />} />

        {/* หน้า Dashboard: ต้อง login */}
        <Route path="/dashboard" element={session ? <Dashboard session={session} /> : <Navigate to="/" />} />

        {/* หน้าสร้างเรื่อง: ต้อง login */}
        <Route path="/create"    element={session ? <CreateDoc session={session} /> : <Navigate to="/" />} />

        {/* หน้าผู้รับ: ไม่ต้อง login เข้าได้เลยจากลิงก์ */}
        <Route path="/ack/:token" element={<AckPage />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
