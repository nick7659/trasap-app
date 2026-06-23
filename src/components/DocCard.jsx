import { supabase } from '../supabase'

// แปลง status เป็น badge
const STATUS = {
  pending:   { label: 'รอรับทราบ',       cls: 'badge-pending'   },
  partial:   { label: 'กำลังดำเนินการ',  cls: 'badge-partial'   },
  completed: { label: 'ครบแล้ว',          cls: 'badge-completed' },
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
    day:'numeric', month:'short', year:'numeric'
  })
}

export default function DocCard({ doc, onCopyLink, onViewAcks }) {
  const ackCount   = doc.acknowledgments?.length  || 0
  const recpCount  = doc.document_recipients?.length || 0
  const status     = STATUS[doc.status] || STATUS.pending
  const publicUrl  = `${window.location.origin}/ack/${doc.access_token}`

  return (
    <div style={{
      background:'#F7F3EA', border:'1px solid #D8D0BC', borderRadius:'10px',
      padding:'20px 22px', marginBottom:'16px',
      backgroundImage:'repeating-linear-gradient(0deg,rgba(0,0,0,.012) 0,rgba(0,0,0,.012) 1px,transparent 1px,transparent 3px)'
    }}>
      {/* หัว */}
      <div style={{display:'flex', justifyContent:'space-between', gap:'12px', alignItems:'flex-start'}}>
        <div style={{flex:1}}>
          {/* ป้ายประเภท + เลขที่ */}
          <div style={{display:'flex', gap:'8px', alignItems:'center', marginBottom:'5px', flexWrap:'wrap'}}>
            <span style={{
              background:'#eae6d8', color:'#2E4368', fontSize:'.72rem',
              fontWeight:'700', padding:'3px 9px', borderRadius:'4px'
            }}>{doc.doc_type}</span>
            <span style={{fontSize:'.78rem', color:'#5C6470', fontWeight:'600'}}>
              เลขที่ {doc.doc_no}
            </span>
          </div>
          <h3 style={{fontSize:'1.08rem', color:'#1B2A4A', lineHeight:'1.4'}}>{doc.title}</h3>
        </div>

        {/* Badge + Progress */}
        <div style={{textAlign:'right', flexShrink:0}}>
          <span className={`badge ${status.cls}`}>{status.label}</span>
          <div style={{fontSize:'.78rem', color:'#5C6470', marginTop:'4px'}}>
            {recpCount > 0
              ? `${ackCount}/${recpCount} คน`
              : `${ackCount} คนรับทราบแล้ว`
            }
          </div>
        </div>
      </div>

      {/* ข้อมูล Meta */}
      <div style={{fontSize:'.8rem', color:'#5C6470', margin:'10px 0', lineHeight:'1.8'}}>
        {doc.customer && <span>ลูกค้า: {doc.customer} · </span>}
        {doc.part_no  && <span>ชิ้นงาน: {doc.part_no} · </span>}
        <span>แก้ไขครั้งที่ {doc.revision_no} · </span>
        <span>วันที่แก้ไข {fmtDate(doc.revision_date)} · </span>
        <span>Eff. Date {fmtDate(doc.eff_date)}</span>
      </div>

      {doc.description && (
        <p style={{fontSize:'.9rem', color:'#3c3a33', lineHeight:'1.6', marginBottom:'14px'}}>
          {doc.description}
        </p>
      )}

      {/* Actions */}
      <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
        <button className="btn-secondary" style={{fontSize:'.82rem', padding:'7px 14px'}}
          onClick={() => onCopyLink(publicUrl)}>
          คัดลอกลิงก์
        </button>
        <button className="btn-secondary" style={{fontSize:'.82rem', padding:'7px 14px'}}
          onClick={() => window.open(publicUrl, '_blank')}>
          เปิดหน้าผู้รับ
        </button>
        {ackCount > 0 && (
          <button className="btn-secondary" style={{fontSize:'.82rem', padding:'7px 14px'}}
            onClick={() => onViewAcks(doc)}>
            ดูลายเซ็น ({ackCount})
          </button>
        )}
      </div>
    </div>
  )
}
