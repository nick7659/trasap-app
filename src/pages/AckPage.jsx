import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import SignatureCanvas from '../components/SignatureCanvas'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
    day:'numeric', month:'long', year:'numeric'
  })
}
function fmtRev(n) {
  if (n === null || n === undefined || n === '') return '—'
  return String(n).padStart(2, '0')
}

export default function AckPage() {
  const { token } = useParams()

  // ข้อมูลเอกสาร
  const [doc,     setDoc]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // ขั้นตอน: 'select' | 'sign' | 'done' | 'already'
  const [step, setStep]   = useState('select')

  // ผู้รับที่เลือก
  const [selectedRecipientId,   setSelectedRecipientId]   = useState('')
  const [lockedRecipient,       setLockedRecipient]       = useState(null)  // { id, name }

  // ฟอร์มเซ็น
  const [signerName, setSignerName] = useState('')
  const [checked,    setChecked]    = useState(false)
  const [hasDrawn,   setHasDrawn]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ข้อมูลการเซ็นที่ทำไปแล้ว (สำหรับหน้า 'already')
  const [existingAck, setExistingAck] = useState(null)
  const [existingSigUrl, setExistingSigUrl] = useState('')

  const sigCanvasRef = useRef(null)

  // โหลดข้อมูลเอกสาร
  useEffect(() => {
    const load = async () => {
      const { data, error: err } = await supabase.rpc('get_document_by_token', { p_token: token })
      if (err || !data || data.error) {
        setError('ไม่พบเอกสารนี้ หรือลิงก์ไม่ถูกต้อง')
      } else {
        setDoc(data)
        // ถ้าไม่มีรายชื่อ (โหมดเปิด) ข้ามขั้น select ไปเลย
        if (!data.recipients || data.recipients.length === 0) {
          setStep('sign')
        }
      }
      setLoading(false)
    }
    load()
  }, [token])

  // ผู้รับกดยืนยันชื่อของตัวเอง
  const confirmRecipient = async () => {
    if (!selectedRecipientId) return
    const recipient = doc.recipients.find(r => r.id === selectedRecipientId)

    if (recipient.signed) {
      // เคยเซ็นแล้ว — โหลดลายเซ็นเดิมมาแสดง
      const ack = doc.acks?.find(a => a.recipient_id === selectedRecipientId)
      setExistingAck(ack)
      if (ack?.signature_url) {
        const { data } = await supabase.storage
          .from('signatures')
          .createSignedUrl(ack.signature_url, 3600)
        if (data?.signedUrl) setExistingSigUrl(data.signedUrl)
      }
      setStep('already')
    } else {
      setLockedRecipient(recipient)
      setSignerName(recipient.name)
      setStep('sign')
    }
  }

  // ส่งลายเซ็น
  const handleSubmit = async () => {
    if (!checked)              { setSubmitError('กรุณาติ๊ก checkbox รับทราบก่อน'); return }
    if (!signerName.trim())    { setSubmitError('กรุณากรอกชื่อ-นามสกุล'); return }
    if (sigCanvasRef.current?.isEmpty()) { setSubmitError('กรุณาวาดลายเซ็นก่อน'); return }

    setSubmitting(true); setSubmitError('')

    const signatureBase64 = sigCanvasRef.current.getDataURL()

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-signature`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          token,
          recipient_id:     lockedRecipient?.id || null,
          signer_name:      signerName.trim(),
          signature_base64: signatureBase64,
        })
      })
      const result = await res.json()

      if (result.success) {
        setStep('done')
      } else {
        const msg = {
          invalid_token:    'ลิงก์ไม่ถูกต้องหรือหมดอายุ',
          already_signed:   'ชื่อนี้รับทราบไปแล้ว',
          invalid_recipient:'ไม่พบชื่อในรายการ',
          upload_failed:    'อัปโหลดลายเซ็นไม่สำเร็จ กรุณาลองใหม่',
          save_failed:      'บันทึกไม่สำเร็จ กรุณาลองใหม่',
        }[result.error] || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
        setSubmitError(msg)
      }
    } catch {
      setSubmitError('ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต')
    }
    setSubmitting(false)
  }

  // รายชื่อที่ยังไม่เซ็น (ใช้ใน dropdown)
  const pendingRecipients  = doc?.recipients?.filter(r => !r.signed)  || []
  const signedRecipients   = doc?.recipients?.filter(r =>  r.signed)  || []
  const hasNamedRecipients = doc?.recipients?.length > 0
  const ackCount           = doc?.acks?.length || 0
  const totalCount         = doc?.recipients?.length || 0

  // ===== Loading =====
  if (loading) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      color:'rgba(247,243,234,.7)', fontSize:'.95rem'}}>
      กำลังโหลดเอกสาร...
    </div>
  )

  // ===== Error =====
  if (error) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px'}}>
      <div className="card" style={{maxWidth:'400px', textAlign:'center'}}>
        <div style={{fontSize:'2rem', marginBottom:'12px'}}>⚠️</div>
        <h2 style={{color:'#1B2A4A', marginBottom:'8px'}}>ไม่พบเอกสาร</h2>
        <p style={{color:'#5C6470', fontSize:'.88rem'}}>{error}</p>
      </div>
    </div>
  )

  return (
    <div style={{maxWidth:'620px', margin:'0 auto', padding:'32px 16px 60px'}}>
      <div className="card">

        {/* Letterhead */}
        <div style={{
          display:'flex', alignItems:'center', gap:'10px',
          paddingBottom:'16px', borderBottom:'1.5px solid #D8D0BC', marginBottom:'20px'
        }}>
          <div style={{
            width:'30px', height:'30px', borderRadius:'50%',
            border:'2px solid #B33A3A', color:'#B33A3A',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:'700', fontSize:'.85rem', flexShrink:0
          }}>DD</div>
          <span style={{fontSize:'.78rem', color:'#5C6470', letterSpacing:'.04em'}}>
            ตรวจสอบเอกสารเพื่อเซ็นรับ
          </span>
        </div>

        {/* หัวเรื่อง */}
        <h1 style={{fontSize:'1.4rem', color:'#1B2A4A', marginBottom:'14px', lineHeight:1.4}}>
          {doc.title}
        </h1>

        {/* ตารางข้อมูลเอกสาร */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px',
          background:'#f4f1ea', border:'1px solid #D8D0BC',
          borderRadius:'8px', padding:'14px 16px', marginBottom:'16px'
        }}>
          {[
            ['Document No.', doc.doc_no],
            ['DAR No.', doc.dar_no || 'N/A'],
            ['Document Type', doc.doc_type],
            ['Customer', doc.customer || 'N/A'],
            ['Part No.', doc.part_no || 'N/A'],
            ['Rev.', fmtRev(doc.revision_no)],
            ['Create Date', fmtDate(doc.revision_date)],
            ['Eff. Date', fmtDate(doc.eff_date)],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{fontSize:'.83rem'}}>
              <span style={{color:'#5C6470'}}>{lbl}: </span>
              <span style={{color:'#1B2A4A', fontWeight:'600'}}>{val}</span>
            </div>
          ))}
        </div>

        {/* รายละเอียด */}
        {doc.description && (
          <p style={{fontSize:'.94rem', lineHeight:'1.8', color:'#3c3a33',
            whiteSpace:'pre-wrap', marginBottom:'20px'}}>
            {doc.description}
          </p>
        )}

        {/* ===== แถบเส้นกั้น ===== */}
        <div style={{position:'relative', textAlign:'center',
          margin:'0 -28px 24px', borderTop:'1.5px dashed #D8D0BC'}}>
          <span style={{
            position:'relative', top:'-10px', background:'#FFFDF8',
            padding:'0 12px', fontSize:'.74rem', color:'#5C6470',
            letterSpacing:'.06em', textTransform:'uppercase'
          }}>ส่วนของผู้รับ</span>
        </div>

        {/* ===== STEP: select ===== */}
        {step === 'select' && (
          <div>
            {/* Progress */}
            {hasNamedRecipients && (
              <p style={{fontSize:'.85rem', color:'#2E4368', marginBottom:'14px', fontWeight:'600'}}>
                รับแล้ว {ackCount}/{totalCount} คน
                {signedRecipients.length > 0 && (
                  <span style={{color:'#3C5E4A', marginLeft:'8px'}}>
                    ({signedRecipients.map(r => r.name).join(', ')})
                  </span>
                )}
              </p>
            )}

            <div className="field">
              <label>เลือกชื่อหรือแผนกของคุณเพื่อยืนยันการรับเอกสาร</label>
              <select value={selectedRecipientId} onChange={e => setSelectedRecipientId(e.target.value)}>
                <option value="">-- เลือกชื่อ --</option>
                {doc.recipients?.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.signed ? '(รับทราบแล้ว)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{display:'flex', justifyContent:'flex-end', marginTop:'16px'}}>
              <button className="btn-primary" onClick={confirmRecipient}
                disabled={!selectedRecipientId}>
                ยืนยันชื่อ →
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP: already ===== */}
        {step === 'already' && (
          <div>
            <div style={{
              background:'#d1e7dd', borderRadius:'8px', padding:'14px 16px',
              marginBottom:'16px', color:'#0f5132', fontWeight:'600', fontSize:'.9rem'
            }}>
              ✓ ท่านได้รับทราบเอกสารนี้แล้ว
            </div>
            {existingAck && (
              <div style={{fontSize:'.85rem', color:'#5C6470', lineHeight:'1.8', marginBottom:'14px'}}>
                ชื่อ: <strong style={{color:'#1B2A4A'}}>{existingAck.signer_name}</strong><br/>
                วันเวลา: {new Date(existingAck.signed_at).toLocaleString('th-TH', {dateStyle:'medium',timeStyle:'short'})}
              </div>
            )}
            {existingSigUrl && (
              <div style={{
                background:'#f4f1ea', borderRadius:'8px', padding:'16px',
                textAlign:'center', marginBottom:'16px'
              }}>
                <img src={existingSigUrl} alt="ลายเซ็น" style={{maxWidth:'100%', maxHeight:'100px'}} />
              </div>
            )}
            <button className="btn-secondary" onClick={() => {
              setStep('select'); setSelectedRecipientId(''); setExistingAck(null); setExistingSigUrl('')
            }}>
              ← กลับเลือกชื่ออื่น
            </button>
          </div>
        )}

        {/* ===== STEP: sign ===== */}
        {step === 'sign' && (
          <div>
            {/* แสดงชื่อที่ล็อกไว้ (โหมดกำหนดรายชื่อ) */}
            {lockedRecipient && (
              <div style={{
                background:'#f4f1ea', borderRadius:'7px', padding:'10px 14px',
                fontSize:'.88rem', color:'#2E4368', marginBottom:'16px',
                display:'flex', justifyContent:'space-between', alignItems:'center'
              }}>
                <span>ผู้เซ็นรับ: <strong>{lockedRecipient.name}</strong></span>
                <button className="btn-secondary" style={{fontSize:'.78rem', padding:'4px 10px'}}
                  onClick={() => { setStep('select'); setLockedRecipient(null); setSignerName('') }}>
                  เปลี่ยนชื่อ
                </button>
              </div>
            )}

            {/* Checkbox */}
            <label style={{
              display:'flex', gap:'10px', alignItems:'flex-start',
              cursor:'pointer', marginBottom:'20px', fontSize:'.92rem',
              color:'#1B2A4A', lineHeight:'1.6'
            }}>
              <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
                style={{width:'19px', height:'19px', marginTop:'2px', accentColor:'#B33A3A', flexShrink:0}} />
              ติ๊กถูก เพื่อยืนยันว่าได้ตรวจสอบเอกสารที่ส่งให้ทางระบบแล้ว
            </label>

            {/* ชื่อ-นามสกุล (โหมดเปิดเท่านั้น) */}
            {!lockedRecipient && (
              <div className="field">
                <label>ชื่อ-นามสกุลผู้รับทราบ</label>
                <input placeholder="พิมพ์ชื่อ-นามสกุล"
                  value={signerName} onChange={e => setSignerName(e.target.value)} />
              </div>
            )}

            {/* ลายเซ็น */}
            <div className="field">
              <label>ลงลายเซ็นผู้รับเอกสาร</label>
              <SignatureCanvas
                ref={sigCanvasRef}
                onDrawn={() => setHasDrawn(true)}
              />
              <div style={{display:'flex', justifyContent:'flex-end', marginTop:'6px'}}>
                <button style={{
                  background:'none', border:'none', color:'#5C6470',
                  fontSize:'.78rem', textDecoration:'underline', cursor:'pointer'
                }} onClick={() => { sigCanvasRef.current?.clear(); setHasDrawn(false) }}>
                  ล้างลายเซ็น
                </button>
              </div>
            </div>

            {submitError && <div className="error-box">{submitError}</div>}

            <div style={{display:'flex', justifyContent:'flex-end', marginTop:'20px'}}>
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันการรับ'}
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP: done ===== */}
        {step === 'done' && (
          <div>
            {/* ตราประทับ */}
            <div style={{textAlign:'center', margin:'10px 0 22px'}}>
              <div style={{
                display:'inline-block',
                border:'3px solid #4F7860', color:'#3C5E4A',
                fontWeight:'700', fontSize:'1.1rem',
                padding:'8px 20px', borderRadius:'6px',
                transform:'rotate(-8deg)', letterSpacing:'.05em'
              }}>รับทราบแล้ว</div>
            </div>

            <div style={{
              background:'#d1e7dd', borderRadius:'8px', padding:'16px 18px',
              color:'#0f5132', fontWeight:'600', marginBottom:'16px'
            }}>
              ✓ บันทึกการรับทราบเรียบร้อยแล้ว
            </div>

            <div style={{
              background:'#f4f1ea', borderRadius:'8px', padding:'16px 18px',
              fontSize:'.88rem', color:'#2E4368', lineHeight:'1.9'
            }}>
              <strong style={{color:'#1B2A4A'}}>ชื่อผู้รับทราบ:</strong> {signerName}<br/>
              <strong style={{color:'#1B2A4A'}}>วันเวลา:</strong>{' '}
              {new Date().toLocaleString('th-TH', {dateStyle:'medium', timeStyle:'short'})}
            </div>

            {/* ปุ่มให้คนถัดไปเซ็น (กรณีกำหนดรายชื่อ) */}
            {hasNamedRecipients && pendingRecipients.length > 1 && (
              <div style={{marginTop:'18px', textAlign:'center'}}>
                <button className="btn-secondary" onClick={() => {
                  setStep('select')
                  setLockedRecipient(null)
                  setSignerName('')
                  setChecked(false)
                  setHasDrawn(false)
                  setSelectedRecipientId('')
                  sigCanvasRef.current?.clear()
                  // รีโหลดข้อมูลเพื่ออัปเดตสถานะ
                  supabase.rpc('get_document_by_token', { p_token: token })
                    .then(({ data }) => { if (data && !data.error) setDoc(data) })
                }}>
                  ให้คนถัดไปรับทราบ →
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
