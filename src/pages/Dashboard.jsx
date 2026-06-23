import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import DocTypeManager from '../components/DocTypeManager'

function showToast(msg, type = 'info') {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'error' ? '#7a1a1a' : '#1B2A4A'
  el.classList.add('show')
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2800)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}
function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

const STATUS_LABEL = {
  pending:   { label: 'รอเซันรับ',      bg: '#fef3cd', color: '#856404' },
  partial:   { label: 'รับแล้วบางส่วน',         bg: '#cfe2ff', color: '#084298' },
  completed: { label: 'ครบแล้ว',         bg: '#d1e7dd', color: '#0f5132' },
}

const COLS = [
  { key: 'revision_date', label: 'วันที่แก้ไข' },
  { key: 'doc_type',      label: 'ประเภทเอกสาร' },
  { key: 'doc_no',        label: 'หมายเลขเอกสาร' },
  { key: 'title',         label: 'ชื่อเรื่อง/ชิ้นส่วน' },
  { key: 'revision_no',   label: 'แก้ไขครั้งที่' },
  { key: 'eff_date',      label: 'Eff. Date' },
]

export default function Dashboard({ session }) {
  const navigate = useNavigate()
  const [docs,        setDocs]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [fetchError,  setFetchError]  = useState('')
  const [search,      setSearch]      = useState('')
  const [sortKey,     setSortKey]     = useState('revision_date')
  const [sortDir,     setSortDir]     = useState('desc')
  const [filterType,  setFilterType]  = useState('')
  const [filterStatus,setFilterStatus]= useState('')
  const [ackModal,    setAckModal]    = useState(null)
  const [sigUrls,     setSigUrls]     = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting,    setDeleting]    = useState(false)
  const [showDocTypes, setShowDocTypes] = useState(false)

  const fetchDocs = useCallback(async () => {
    setFetchError('')
    const { data, error } = await supabase
      .from('documents')
      .select('*, document_recipients(*), acknowledgments(*)')
      .order('created_at', { ascending: false })
    if (error) { setFetchError(error.message) }
    else { setDocs(data || []) }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDocs()
    const ch = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, fetchDocs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acknowledgments' }, fetchDocs)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchDocs])

  // รายการ doc_type สำหรับ filter dropdown
  const docTypes = useMemo(() =>
    [...new Set(docs.map(d => d.doc_type).filter(Boolean))].sort()
  , [docs])

  // กรอง + ค้นหา + เรียงลำดับ
  const filtered = useMemo(() => {
    let list = [...docs]
    if (filterType)   list = list.filter(d => d.doc_type === filterType)
    if (filterStatus) list = list.filter(d => d.status   === filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        (d.title        || '').toLowerCase().includes(q) ||
        (d.doc_no       || '').toLowerCase().includes(q) ||
        (d.doc_type     || '').toLowerCase().includes(q) ||
        (d.customer     || '').toLowerCase().includes(q) ||
        (d.part_no      || '').toLowerCase().includes(q) ||
        (d.description  || '').toLowerCase().includes(q) ||
        (d.document_recipients || []).some(r => r.name.toLowerCase().includes(q))
      )
    }
    list.sort((a, b) => {
      let av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
      if (sortKey === 'revision_no') { av = Number(av); bv = Number(bv) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
    return list
  }, [docs, search, filterType, filterStatus, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span style={{color:'#888', marginLeft:'4px'}}>⇅</span>
    return <span style={{marginLeft:'4px'}}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Copy Link เรียบร้อยแล้ว'))
      .catch(() => showToast('ไม่สามารถ Copy Link ได้', 'error'))
  }

  const handleViewAcks = async (doc) => {
    setAckModal(doc); setSigUrls({})
    const urls = {}
    for (const ack of (doc.acknowledgments || [])) {
      if (!ack.signature_url) continue
      const { data } = await supabase.storage
        .from('signatures').createSignedUrl(ack.signature_url, 3600)
      if (data?.signedUrl) urls[ack.id] = data.signedUrl
    }
    setSigUrls(urls)
  }

  const handleDelete = async (doc) => {
    setDeleting(true)
    // ลบไฟล์ลายเซ็นใน Storage ก่อน
    const paths = (doc.acknowledgments || [])
      .map(a => a.signature_url).filter(Boolean)
    if (paths.length > 0) {
      await supabase.storage.from('signatures').remove(paths)
    }
    // ลบเอกสาร (CASCADE จะลบ recipients + acknowledgments อัตโนมัติ)
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) showToast('ลบไม่สำเร็จ: ' + error.message, 'error')
    else { showToast('ลบเรียบร้อยแล้ว'); fetchDocs() }
    setDeleteConfirm(null); setDeleting(false)
  }

  // styles
  const th = {
    padding: '10px 12px', textAlign: 'left', fontSize: '.78rem',
    fontWeight: '700', color: '#2E4368', background: '#eae6d8',
    borderBottom: '2px solid #D8D0BC', whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none',
  }
  const td = {
    padding: '10px 12px', fontSize: '.83rem', color: '#1B2A4A',
    borderBottom: '1px solid #e8e2d4', verticalAlign: 'middle',
  }
  const tdAction = {
    ...td, whiteSpace: 'nowrap', textAlign: 'center',
  }
  const actionBtn = {
    background: 'none', border: '1px solid #D8D0BC', borderRadius: '5px',
    padding: '4px 9px', fontSize: '.75rem', fontWeight: '600',
    cursor: 'pointer', color: '#2E4368', marginRight: '4px',
  }

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">DD</div>
          <div className="brand-name">Document Distribution System</div>
        </div>
        <div className="topbar-right">
          <span className="topbar-user">{session.user.email}</span>
          <button className="btn-ghost" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="page" style={{maxWidth:'100%', padding:'24px 20px 60px'}}>

        {/* Header */}
        <div className="page-head" style={{marginBottom:'16px'}}>
          <div>
            <h2>รายการที่สร้างไว้</h2>
            <p>รายการเอกสารทั้งหมด {filtered.length}/{docs.length} รายการ</p>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button className="btn-info" onClick={() => setShowDocTypes(true)}
              style={{ fontSize:'.88rem' }}>
              ⚙ เพิ่มประเภทเอกสาร
            </button>
            <button className="btn-primary" onClick={() => navigate('/create')}>
              + สร้าง Link รับเอกสาร
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{
          display:'flex', gap:'10px', flexWrap:'wrap',
          marginBottom:'16px', alignItems:'center'
        }}>
          <input
            placeholder="🔍 ค้นหา ประเภทเอกสาร, ชื่อเอกสาร, หมายเลขเอกสาร, ลูกค้า, ผู้รับ..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex:'1', minWidth:'220px', padding:'9px 13px',
              border:'1.5px solid #D8D0BC', borderRadius:'7px',
              fontFamily:'inherit', fontSize:'.88rem', background:'#fff'
            }}
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{
              padding:'9px 13px', border:'1.5px solid #D8D0BC',
              borderRadius:'7px', fontFamily:'inherit', fontSize:'.85rem',
              background:'#fff', color:'#1B2A4A', minWidth:'180px'
            }}>
            <option value="">ทุกประเภทเอกสาร</option>
            {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding:'9px 13px', border:'1.5px solid #D8D0BC',
              borderRadius:'7px', fontFamily:'inherit', fontSize:'.85rem',
              background:'#fff', color:'#1B2A4A', minWidth:'150px'
            }}>
            <option value="">ทุกสถานะ</option>
            <option value="pending">รอเซ็นรับ</option>
            <option value="partial">รับแล้วบางส่วน</option>
            <option value="completed">ครบแล้ว</option>
          </select>
          {(search || filterType || filterStatus) && (
            <button onClick={() => { setSearch(''); setFilterType(''); setFilterStatus('') }}
              style={{...actionBtn, color:'#B33A3A', borderColor:'#B33A3A'}}>
              ล้างตัวกรอง ✕
            </button>
          )}
        </div>

        {fetchError && (
          <div className="error-box" style={{marginBottom:'14px'}}>
            ⚠️ {fetchError}
            <button onClick={fetchDocs} style={{
              marginLeft:'10px', background:'none', border:'none',
              color:'#7a1a1a', textDecoration:'underline', cursor:'pointer'
            }}>ลองใหม่</button>
          </div>
        )}

        {/* Table */}
        <div style={{
          background:'#FFFDF8', borderRadius:'10px', border:'1px solid #D8D0BC',
          overflow:'auto', boxShadow:'0 10px 30px -15px rgba(0,0,0,.35)'
        }}>
          {loading ? (
            <p style={{textAlign:'center', padding:'48px', color:'#5C6470'}}>กำลังโหลด...</p>
          ) : filtered.length === 0 ? (
            <p style={{textAlign:'center', padding:'48px', color:'#5C6470'}}>
              {docs.length === 0 ? 'ยังไม่มีเรื่องที่สร้างไว้' : 'ไม่พบรายการที่ค้นหา'}
            </p>
          ) : (
            <table style={{width:'100%', borderCollapse:'collapse', minWidth:'900px'}}>
              <thead>
                <tr>
                  <th style={{...th, width:'42px', textAlign:'center'}}>#</th>
                  {COLS.map(c => (
                    <th key={c.key} style={th} onClick={() => handleSort(c.key)}>
                      {c.label}<SortIcon col={c.key} />
                    </th>
                  ))}
                  <th style={{...th, cursor:'default'}}>รายละเอียด</th>
                  <th style={{...th, cursor:'default'}}>ผู้ต้องรับทราบ</th>
                  <th style={{...th, cursor:'default', textAlign:'center'}}>สถานะ</th>
                  <th style={{...th, cursor:'default', textAlign:'center'}}>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => {
                  const recpCount = doc.document_recipients?.length || 0
                  const ackCount  = doc.acknowledgments?.length    || 0
                  const status    = STATUS_LABEL[doc.status] || STATUS_LABEL.pending
                  const pubUrl    = `${window.location.origin}/ack/${doc.access_token}`
                  const recipientNames = (doc.document_recipients || []).map(r => r.name).join(', ')

                  return (
                    <tr key={doc.id}
                      style={{background: i % 2 === 0 ? '#FFFDF8' : '#faf7f0'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f0ece0'}
                      onMouseLeave={e => e.currentTarget.style.background= i % 2 === 0 ? '#FFFDF8' : '#faf7f0'}
                    >
                      <td style={{...td, textAlign:'center', color:'#888', fontSize:'.78rem'}}>{i + 1}</td>
                      <td style={td}>{fmtDate(doc.revision_date)}</td>
                      <td style={td}>
                        <span style={{
                          background:'#eae6d8', color:'#2E4368', fontSize:'.72rem',
                          fontWeight:'700', padding:'3px 8px', borderRadius:'4px',
                          whiteSpace:'nowrap'
                        }}>{doc.doc_type}</span>
                      </td>
                      <td style={{...td, fontWeight:'600', whiteSpace:'nowrap'}}>{doc.doc_no}</td>
                      <td style={{...td, maxWidth:'220px'}}>
                        <div style={{fontWeight:'600', lineHeight:'1.35'}}>{doc.title}</div>
                        {doc.part_no  && <div style={{fontSize:'.74rem', color:'#888'}}>PN: {doc.part_no}</div>}
                        {doc.customer && <div style={{fontSize:'.74rem', color:'#888'}}>{doc.customer}</div>}
                      </td>
                      <td style={{...td, textAlign:'center'}}>{doc.revision_no}</td>
                      <td style={{...td, whiteSpace:'nowrap'}}>{fmtDate(doc.eff_date)}</td>
                      <td style={{...td, maxWidth:'180px'}}>
                        {doc.description
                          ? <span title={doc.description} style={{
                              display:'-webkit-box', WebkitLineClamp:2,
                              WebkitBoxOrient:'vertical', overflow:'hidden', fontSize:'.8rem'
                            }}>{doc.description}</span>
                          : <span style={{color:'#bbb'}}>—</span>
                        }
                      </td>
                      <td style={{...td, maxWidth:'160px'}}>
                        {recpCount > 0 ? (
                          <div>
                            <div style={{fontSize:'.78rem', color:'#3C5E4A', fontWeight:'600', marginBottom:'2px'}}>
                              {ackCount}/{recpCount} คน
                            </div>
                            <div style={{fontSize:'.75rem', color:'#5C6470', lineHeight:'1.5'}}>
                              {recipientNames}
                            </div>
                          </div>
                        ) : (
                          <span style={{fontSize:'.78rem', color:'#888'}}>
                            โหมดเปิด ({ackCount} คน)
                          </span>
                        )}
                      </td>
                      <td style={{...td, textAlign:'center'}}>
                        <span style={{
                          background: status.bg, color: status.color,
                          fontSize: '.72rem', fontWeight: '700',
                          padding: '3px 9px', borderRadius: '4px', whiteSpace:'nowrap'
                        }}>{status.label}</span>
                      </td>
                      <td style={tdAction}>
                        <button style={actionBtn} title="คัดลอกลิงก์"
                          onClick={() => handleCopyLink(pubUrl)}>🔗 Copy Link</button>
                        <button style={actionBtn} title="เปิดหน้าผู้รับ"
                          onClick={() => window.open(pubUrl, '_blank')}>👁 เปิดหน้าผู้เซ็นรับ</button>
                        {ackCount > 0 && (
                          <button style={actionBtn} title="ดูลายเซ็น"
                            onClick={() => handleViewAcks(doc)}>✍️ เซ็น ({ackCount})</button>
                        )}
                        <button
                          style={{...actionBtn, color:'#B33A3A', borderColor:'#f5c6c6', marginRight:0}}
                          title="ลบรายการ"
                          onClick={() => setDeleteConfirm(doc)}>🗑 ลบ</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: ดูลายเซ็น */}
      {ackModal && (
        <div className="modal-overlay" onClick={() => setAckModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}
            style={{maxWidth:'520px', maxHeight:'85vh', overflowY:'auto'}}>
            <h3>รายละเอียดการรับทราบ</h3>
            <p style={{fontSize:'.85rem', color:'#5C6470', marginBottom:'16px'}}>
              เรื่อง: <strong>{ackModal.title}</strong>
            </p>

            {ackModal.document_recipients?.length > 0 && (
              <div style={{marginBottom:'16px'}}>
                <p style={{fontSize:'.8rem', fontWeight:'700', color:'#2E4368', marginBottom:'8px'}}>
                  รายชื่อที่กำหนดไว้
                </p>
                {ackModal.document_recipients.map(r => {
                  const signed = ackModal.acknowledgments?.find(a => a.recipient_id === r.id)
                  return (
                    <div key={r.id} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'8px 12px', background:'#f4f1ea', borderRadius:'6px',
                      marginBottom:'6px', fontSize:'.85rem'
                    }}>
                      <span>{r.name}</span>
                      {signed
                        ? <span style={{color:'#3C5E4A', fontWeight:'600', fontSize:'.78rem'}}>
                            ✓ {fmtDateTime(signed.signed_at)}
                          </span>
                        : <span style={{color:'#856404', fontSize:'.78rem'}}>⏳ รอเซ็นรับ</span>
                      }
                    </div>
                  )
                })}
              </div>
            )}

            {(ackModal.acknowledgments?.length || 0) === 0 ? (
              <p style={{color:'#5C6470', fontSize:'.88rem'}}>ยังไม่มีผู้รับทราบ</p>
            ) : ackModal.acknowledgments.map(ack => (
              <div key={ack.id} style={{
                border:'1px solid #D8D0BC', borderRadius:'8px',
                padding:'14px 16px', marginBottom:'12px'
              }}>
                <div style={{fontWeight:'600', color:'#1B2A4A', marginBottom:'3px'}}>{ack.signer_name}</div>
                <div style={{fontSize:'.78rem', color:'#5C6470', marginBottom:'10px'}}>
                  {fmtDateTime(ack.signed_at)}
                </div>
                {sigUrls[ack.id]
                  ? <img src={sigUrls[ack.id]} alt="ลายเซ็น"
                      style={{maxWidth:'100%', maxHeight:'100px', display:'block', margin:'0 auto'}} />
                  : <p style={{fontSize:'.8rem', color:'#5C6470', textAlign:'center'}}>
                      กำลังโหลดลายเซ็น...
                    </p>
                }
              </div>
            ))}
            <div className="modal-foot">
              <button className="btn-secondary" onClick={() => setAckModal(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ยืนยันลบ */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
            <h3 style={{color:'#B33A3A'}}>⚠️ ยืนยันการลบ</h3>
            <p style={{fontSize:'.9rem', color:'#1B2A4A', margin:'12px 0 6px', lineHeight:'1.6'}}>
              ต้องการลบเรื่อง <strong>"{deleteConfirm.title}"</strong> ใช่หรือไม่?
            </p>
            <p style={{fontSize:'.82rem', color:'#5C6470'}}>
              ข้อมูลทั้งหมดรวมถึงลายเซ็นจะถูกลบอย่างถาวร ไม่สามารถกู้คืนได้
            </p>
            <div className="modal-foot">
              <button className="btn-secondary"
                onClick={() => setDeleteConfirm(null)} disabled={deleting}>ยกเลิก</button>
              <button
                onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                style={{
                  background:'#B33A3A', color:'#fff', fontWeight:'600',
                  padding:'10px 20px', borderRadius:'6px', border:'none', cursor:'pointer'
                }}>
                {deleting ? 'กำลังลบ...' : 'ลบถาวร'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocTypes && <DocTypeManager onClose={() => setShowDocTypes(false)} />}

      <div id="toast" />
    </>
  )
}
