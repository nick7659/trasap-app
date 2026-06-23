import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async () => {
    if (!email || !password) { setError('กรุณากรอกอีเมลและรหัสผ่าน'); return }
    setLoading(true); setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    // ถ้า login สำเร็จ App.jsx จะ redirect ไป /dashboard อัตโนมัติ
    setLoading(false)
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleLogin() }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', padding:'24px'
    }}>
      <div className="card" style={{width:'100%', maxWidth:'380px'}}>
        {/* Logo */}
        <div style={{textAlign:'center', marginBottom:'22px'}}>
          <div style={{
            width:'54px', height:'54px', borderRadius:'50%',
            border:'2.5px solid #B33A3A', display:'flex',
            alignItems:'center', justifyContent:'center',
            margin:'0 auto 14px', color:'#B33A3A', fontWeight:'700', fontSize:'1.5rem'
          }}>DD</div>
          <h1 style={{fontSize:'1.5rem', color:'#1B2A4A', marginBottom:'4px'}}>Document Distribution</h1>
          <p style={{color:'#5C6470', fontSize:'.86rem'}}>ระบบเซ็นรับเอกสารดิจิทัล</p>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="field">
          <label>อีเมล</label>
          <input
            type="email" placeholder="name@company.com"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="field">
          <label>รหัสผ่าน</label>
          <input
            type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          className="btn-primary" onClick={handleLogin} disabled={loading}
          style={{width:'100%', marginTop:'6px'}}
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </div>
    </div>
  )
}
