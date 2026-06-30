import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function CreateDoc({ session }) {
  const navigate = useNavigate()

  // ดึงประเภทเอกสารจากฐานข้อมูล
  const [docTypes, setDocTypes] = useState([])
  useEffect(() => {
    supabase.from('document_types')
      .select('name').order('sort_order', { ascending: true })
      .then(({ data }) => setDocTypes((data || []).map(d => d.name)))
  }, [])

  // ฟิลด์แบบฟอร์ม
  const [docType,      setDocType]      = useState('')
  const [docNo,        setDocNo]        = useState('')
  const [darNo,        setDarNo]        = useState('')
  const [title,        setTitle]        = useState('')
  const [partNo,       setPartNo]       = useState('')
  const [customer,     setCustomer]     = useState('')
  const [revisionNo,   setRevisionNo]   = useState('0')
  const [effDate,      setEffDate]      = useState('')
  const [description,  setDescription]  = useState('')

  // รายชื่อผู้รับ
  const [recipientInput, setRecipientInput] = useState('')
  const [recipients,     setRecipients]     = useState([])

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // เพิ่มชื่อผู้รับ
  const addRecipient = () => {
    const name = recipientInput.trim()
    if (!name) return
    if (recipients.includes(name)) { setError('ชื่อนี้มีอยู่แล้ว'); return }
    setRecipients(prev => [...prev, name])
    setRecipientInput('')
    setError('')
  }
  const removeRecipient = (name) => setRecipients(prev => prev.filter(r => r !== name))

  const handleSubmit = async () => {
    // Validate ฟิลด์บังคับ
    if (!docType || !docNo || !title || revisionNo === '' || !effDate) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบ: ประเภทเอกสาร, หมายเลขเอกสาร, ชื่อเรื่อง, แก้ไขครั้งที่, Eff. Date')
      return
    }
    setLoading(true); setError('')

    // 1. สร้าง document
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .insert({
        sender_id:    session.user.id,
        doc_type:     docType,
        doc_no:       docNo,
        dar_no:       darNo || null,
        title,
        part_no:      partNo  || null,
        customer:     customer || null,
        revision_no:  Number(revisionNo),
        revision_date: todayISO(),
        eff_date:     effDate,
        description:  description || null,
      })
      .select()
      .single()

    if (docErr) { setError('เกิดข้อผิดพลาด: ' + docErr.message); setLoading(false); return }

    // 2. เพิ่มรายชื่อผู้รับ (ถ้ามี)
    if (recipients.length > 0) {
      const rows = recipients.map((name, i) => ({
        document_id: doc.id,
        name,
        sort_order: i,
      }))
      const { error: rErr } = await supabase.from('document_recipients').insert(rows)
      if (rErr) { setError('สร้างเอกสารแล้วแต่บันทึกรายชื่อไม่สำเร็จ: ' + rErr.message); setLoading(false); return }
    }

    // สำเร็จ → กลับ Dashboard
    navigate('/dashboard')
  }

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">DD</div>
          <div className="brand-name">Document Distribution System</div>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/dashboard')}>← Back</button>
      </div>

      <div className="page">
        <div className="card" style={{maxWidth:'560px', margin:'0 auto'}}>
          <h2 style={{fontSize:'1.2rem', color:'#1B2A4A', marginBottom:'22px'}}>
            สร้าง Link รับเอกสาร
          </h2>

          {error && <div className="error-box">{error}</div>}

          {/* ประเภทเอกสาร */}
          <div className="field">
            <label>Document Type <span style={{color:'#B33A3A'}}>*</span></label>
            <select value={docType} onChange={e => setDocType(e.target.value)}>
              <option value="">-- เลือกประเภทเอกสาร --</option>
              {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* หมายเลขเอกสาร */}
          <div className="field">
            <label>Document No. <span style={{color:'#B33A3A'}}>*</span></label>
            <input placeholder="เช่น WI-xx-xxx"
              value={docNo} onChange={e => setDocNo(e.target.value)} />
          </div>

          {/* DAR No. */}
          <div className="field">
            <label>DAR No.</label>
            <input placeholder="เช่น DAR yy/xxx"
              value={darNo} onChange={e => setDarNo(e.target.value)} />
          </div>

          {/* ชื่อเรื่อง/ชิ้นส่วน */}
          <div className="field">
            <label>Document Title <span style={{color:'#B33A3A'}}>*</span></label>
            <input placeholder="เช่น ขั้นตอนการตรวจสอบ"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* หมายเลขชิ้นงาน + ลูกค้า */}
          <div className="field-row">
            <div className="field">
              <label>Part No.</label>
              <input placeholder="เช่น Part 001"
                value={partNo} onChange={e => setPartNo(e.target.value)} />
            </div>
            <div className="field">
              <label>Customer</label>
              <input placeholder="เช่น OTC , AHP"
                value={customer} onChange={e => setCustomer(e.target.value)} />
            </div>
          </div>

          {/* แก้ไขครั้งที่ + Eff. Date */}
          <div className="field-row">
            <div className="field">
              <label>Rev. No.<span style={{color:'#B33A3A'}}>*</span></label>
              <input type="number" min="0" placeholder="0"
                value={revisionNo} onChange={e => setRevisionNo(e.target.value)} />
            </div>
            <div className="field">
              <label>Eff. Date <span style={{color:'#B33A3A'}}>*</span></label>
              <input type="date"
                value={effDate} onChange={e => setEffDate(e.target.value)} />
            </div>
          </div>
          <p className="field-hint" style={{marginTop:'-8px', marginBottom:'16px'}}>
            
          </p>

          {/* รายละเอียด */}
          <div className="field">
            <label>More Detail</label>
            <textarea placeholder="หมายเหตุหรือรายละเอียดเพิ่มเติม"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* รายชื่อผู้รับ */}
          <div className="field">
            <label>ชื่อหรือแผนกที่ต้องเซ็นรับเอกสาร</label>
            <div style={{display:'flex', gap:'8px'}}>
              <input
                placeholder="พิมพ์ชื่อและแผนกแล้วกด + เพิ่ม เช่น อดิศร PD"
                value={recipientInput}
                onChange={e => setRecipientInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRecipient()}
                style={{flex:1}}
              />
              <button className="btn-secondary" onClick={addRecipient}
                style={{padding:'0 16px', flexShrink:0}}>+ เพิ่ม</button>
            </div>
            <p className="field-hint">
            </p>

            {/* แสดง chip ชื่อที่เพิ่มแล้ว */}
            {recipients.length > 0 && (
              <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'10px'}}>
                {recipients.map((name, i) => (
                  <span key={i} style={{
                    background:'#eae6d8', color:'#1B2A4A',
                    padding:'5px 10px', borderRadius:'20px',
                    fontSize:'.82rem', display:'flex', alignItems:'center', gap:'6px'
                  }}>
                    {name}
                    <button onClick={() => removeRecipient(name)}
                      style={{background:'none', border:'none', color:'#B33A3A',
                        cursor:'pointer', padding:'0', fontSize:'1rem', lineHeight:1}}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'22px'}}>
            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>ยกเลิก</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'กำลังสร้าง...' : 'สร้าง Link รายการ'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
