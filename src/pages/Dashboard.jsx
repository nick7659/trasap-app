import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import DocCard from '../components/DocCard'

function showToast(msg) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg; el.classList.add('show')
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2500)
}

export default function Dashboard({ session }) {
  const navigate        = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState('')   // ← เพิ่ม: แสดง error ถ้าโหลดไม่ได้
  const [ackModal, setAckModal] = useState(null)
  const [sigUrls, setSigUrls]   = useState({})

  const fetchDocs = useCallback(async () => {
    setFetchError('')
    const { data, error } = await supabase
      .from('documents')
      .select('*, document_recipients(*), acknowledgments(*)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('fetchDocs error:', error)
      setFetchError('โหลดข้อมูลไม่สำเร็จ: ' + error.message)  // ← แสดง error จริง
    } else {
      setDocs(data || [])
    }
    setLoading(false)  // ← ต้องรันเสมอไม่ว่าจะ error หรือไม่
  }, [])

  useEffect(() => {
    fetchDocs()

    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'documents' }, fetchDocs)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'acknowledgments' }, fetchDocs)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchDocs])

  // ← แก้ไข: รอ signOut เสร็จก่อนค่อย navigate
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url)
      .then(() => showToast('คัดลอกลิงก์เรียบร้อยแล้ว'))
      .catch(() => showToast('ไม่สามารถคัดลอกได้'))
  }

  const handleViewAcks = async (doc) => {
    setAckModal(doc)
    const urls = {}
    for (const ack of (doc.acknowledgments || [])) {
      if (!ack.signature_url) continue
      const { data } = await supabase.storage
        .from('signatures')
        .createSignedUrl(ack.signature_url, 3600)
      if (data?.signedUrl) urls[ack.id] = data.signedUrl
    }
    setSigUrls(urls)
  }

  function fmtDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">ต</div>
          <div className="brand-name">ตราทราบ</div>
        </div>
        <div className="topbar-right">
          <span className="topbar-user">{session.user.email}</span>
          <button className="btn-ghost" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="page">
        <div className="page-head">
          <div>
            <h2>สร้างรับเอกสาร</h2>
            <p>สร้าง Link แล้วส่งให้ผู้รับเซ็นรับเอกสาร</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/create')}>
            + สร้าง Link รับเอกสาร
          </button>
        </div>

        {/* แสดง error ถ้าโหลดไม่ได้ */}
        {fetchError && (
          <div className="error-box" style={{marginBottom:'16px'}}>
            ⚠️ {fetchError}
            <button onClick={fetchDocs}
              style={{marginLeft:'12px', background:'none', border:'none',
                color:'#7a1a1a', textDecoration:'underline', cursor:'pointer'}}>
              ลองใหม่
            </button>
          </div>
        )}

        {loading ? (
          <p style={{color:'rgba(247,243,234,.6)', textAlign:'center', padding:'40px'}}>
            กำลังโหลด...
          </p>
        ) : docs.length === 0 && !fetchError ? (
          <div className="empty-state">
            ยังไม่มีรายการ — กด "สร้าง Link รับเอกสาร" เพื่อเริ่มต้น
          </div>
        ) : (
          docs.map(doc => (
            <DocCard
              key={doc.id}
              doc={doc}
              onCopyLink={handleCopyLink}
              onViewAcks={handleViewAcks}
            />
          ))
        )}
      </div>

      {/* Modal ดูลายเซ็น */}
      {ackModal && (
        <div className="modal-overlay" onClick={() => setAckModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}
            style={{maxWidth:'520px', maxHeight:'85vh', overflowY:'auto'}}>
            <h3>รายชื่อผู้รับทราบ</h3>
            <p style={{fontSize:'.85rem', color:'#5C6470', marginBottom:'16px'}}>
              เรื่อง: {ackModal.title}
            </p>
            {ackModal.document_recipients?.length > 0 && (
              <div style={{marginBottom:'16px'}}>
                <p style={{fontSize:'.8rem', fontWeight:'600', color:'#2E4368', marginBottom:'8px'}}>
                  รายชื่อที่กำหนดไว้
                </p>
                {ackModal.document_recipients.map(r => {
                  const signed = ackModal.acknowledgments?.find(a => a.recipient_id === r.id)
                  return (
                    <div key={r.id} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'8px 12px', background:'#f4f1ea', borderRadius:'6px',
                      marginBottom:'6px', fontSize:'.88rem'
                    }}>
                      <span>{r.name}</span>
                      {signed
                        ? <span style={{color:'#3C5E4A', fontWeight:'600', fontSize:'.78rem'}}>
                            ✓ {fmtDate(signed.signed_at)}
                          </span>
                        : <span style={{color:'#856404', fontSize:'.78rem'}}>⏳ รอรับทราบ</span>
                      }
                    </div>
                  )
                })}
              </div>
            )}
            {ackModal.acknowledgments?.length > 0 ? (
              ackModal.acknowledgments.map(ack => (
                <div key={ack.id} style={{
                  border:'1px solid #D8D0BC', borderRadius:'8px',
                  padding:'14px 16px', marginBottom:'12px'
                }}>
                  <div style={{fontSize:'.85rem', color:'#1B2A4A', fontWeight:'600', marginBottom:'4px'}}>
                    {ack.signer_name}
                  </div>
                  <div style={{fontSize:'.78rem', color:'#5C6470', marginBottom:'10px'}}>
                    {fmtDate(ack.signed_at)}
                  </div>
                  {sigUrls[ack.id]
                    ? <img src={sigUrls[ack.id]} alt="ลายเซ็น"
                        style={{maxWidth:'100%', maxHeight:'90px', display:'block', margin:'0 auto'}} />
                    : <p style={{fontSize:'.8rem', color:'#5C6470', textAlign:'center'}}>
                        กำลังโหลดลายเซ็น...
                      </p>
                  }
                </div>
              ))
            ) : (
              <p style={{color:'#5C6470', fontSize:'.88rem'}}>ยังไม่มีผู้รับทราบ</p>
            )}
            <div className="modal-foot">
              <button className="btn-secondary" onClick={() => setAckModal(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      <div id="toast" />
    </>
  )
}