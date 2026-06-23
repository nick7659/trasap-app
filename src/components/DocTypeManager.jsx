import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function DocTypeManager({ onClose }) {
  const [types,    setTypes]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newName,  setNewName]  = useState('')
  const [adding,   setAdding]   = useState(false)
  const [editId,   setEditId]   = useState(null)   // id ที่กำลังแก้ไข
  const [editName, setEditName] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const fetchTypes = async () => {
    const { data, error } = await supabase
      .from('document_types')
      .select('*')
      .order('sort_order', { ascending: true })
    if (!error) setTypes(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchTypes() }, [])

  // เพิ่มประเภทใหม่
  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { setError('กรุณากรอกชื่อประเภทเอกสาร'); return }
    if (types.some(t => t.name === name)) { setError('ชื่อนี้มีอยู่แล้ว'); return }
    setAdding(true); setError('')
    const nextOrder = types.length > 0 ? Math.max(...types.map(t => t.sort_order)) + 1 : 1
    const { error } = await supabase.from('document_types').insert({ name, sort_order: nextOrder })
    if (error) setError('เพิ่มไม่สำเร็จ: ' + error.message)
    else { setNewName(''); fetchTypes() }
    setAdding(false)
  }

  // เริ่มแก้ไข
  const startEdit = (type) => {
    setEditId(type.id)
    setEditName(type.name)
    setError('')
  }

  // บันทึกการแก้ไข
  const handleSave = async (id) => {
    const name = editName.trim()
    if (!name) { setError('ชื่อต้องไม่ว่าง'); return }
    if (types.some(t => t.name === name && t.id !== id)) { setError('ชื่อนี้มีอยู่แล้ว'); return }
    setSaving(true); setError('')
    const { error } = await supabase.from('document_types').update({ name }).eq('id', id)
    if (error) setError('บันทึกไม่สำเร็จ: ' + error.message)
    else { setEditId(null); fetchTypes() }
    setSaving(false)
  }

  // ลบ
  const handleDelete = async (type) => {
    if (!window.confirm(`ลบ "${type.name}" ใช่หรือไม่?\n\nหมายเหตุ: เอกสารที่ใช้ประเภทนี้ไปแล้วจะไม่ถูกกระทบ`)) return
    const { error } = await supabase.from('document_types').delete().eq('id', type.id)
    if (error) setError('ลบไม่สำเร็จ: ' + error.message)
    else fetchTypes()
  }

  // เลื่อนลำดับ
  const handleMove = async (type, dir) => {
    const idx     = types.findIndex(t => t.id === type.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= types.length) return
    const swap    = types[swapIdx]
    await supabase.from('document_types').update({ sort_order: swap.sort_order }).eq('id', type.id)
    await supabase.from('document_types').update({ sort_order: type.sort_order }).eq('id', swap.id)
    fetchTypes()
  }

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 12px', borderBottom: '1px solid #e8e2d4',
    background: '#FFFDF8',
  }
  const btnSm = {
    background: 'none', border: '1px solid #D8D0BC', borderRadius: '5px',
    padding: '4px 10px', fontSize: '.78rem', fontWeight: '600',
    cursor: 'pointer', color: '#2E4368', flexShrink: 0,
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0 }}>⚙️ การจัดการประเภทเอกสาร</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#5C6470' }}>✕</button>
        </div>

        {/* เพิ่มใหม่ */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '.82rem', fontWeight: '600', color: '#2E4368', display: 'block', marginBottom: '6px' }}>
            เพิ่มประเภทเอกสารใหม่
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              placeholder="เช่น คู่มือสิ่งแวดล้อม (Environmental Manual)"
              value={newName}
              onChange={e => { setNewName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{
                flex: 1, padding: '9px 12px', border: '1.5px solid #D8D0BC',
                borderRadius: '7px', fontFamily: 'inherit', fontSize: '.9rem'
              }}
            />
            <button
              className="btn-primary"
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              style={{ padding: '9px 18px', flexShrink: 0 }}
            >
              {adding ? '...' : '+ เพิ่ม'}
            </button>
          </div>
          {error && (
            <p style={{ color: '#B33A3A', fontSize: '.8rem', marginTop: '6px' }}>⚠️ {error}</p>
          )}
        </div>

        {/* รายการ */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #D8D0BC', borderRadius: '8px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '30px', color: '#5C6470' }}>กำลังโหลด...</p>
          ) : types.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '30px', color: '#5C6470' }}>ยังไม่มีประเภทเอกสาร</p>
          ) : types.map((type, i) => (
            <div key={type.id} style={{
              ...rowStyle,
              background: i % 2 === 0 ? '#FFFDF8' : '#faf7f0',
            }}>
              {/* ปุ่มเลื่อนลำดับ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                <button onClick={() => handleMove(type, -1)} disabled={i === 0}
                  style={{ ...btnSm, padding: '1px 7px', fontSize: '.7rem', opacity: i === 0 ? .3 : 1 }}>▲</button>
                <button onClick={() => handleMove(type, 1)} disabled={i === types.length - 1}
                  style={{ ...btnSm, padding: '1px 7px', fontSize: '.7rem', opacity: i === types.length - 1 ? .3 : 1 }}>▼</button>
              </div>

              {/* ชื่อ หรือ input แก้ไข */}
              {editId === type.id ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSave(type.id)
                    if (e.key === 'Escape') setEditId(null)
                  }}
                  autoFocus
                  style={{
                    flex: 1, padding: '6px 10px', border: '1.5px solid #2E4368',
                    borderRadius: '5px', fontFamily: 'inherit', fontSize: '.88rem'
                  }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: '.88rem', color: '#1B2A4A' }}>{type.name}</span>
              )}

              {/* Action buttons */}
              {editId === type.id ? (
                <>
                  <button style={{ ...btnSm, background: '#1B2A4A', color: '#fff', border: 'none' }}
                    onClick={() => handleSave(type.id)} disabled={saving}>
                    {saving ? '...' : '💾 บันทึก'}
                  </button>
                  <button style={btnSm} onClick={() => setEditId(null)}>ยกเลิก</button>
                </>
              ) : (
                <>
                  <button style={btnSm} onClick={() => startEdit(type)}>✏️ แก้ไข</button>
                  <button
                    style={{ ...btnSm, color: '#B33A3A', borderColor: '#f5c6c6' }}
                    onClick={() => handleDelete(type)}>🗑 ลบ</button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '.78rem', color: '#888' }}>
            ทั้งหมด {types.length} ประเภทเอกสาร
          </span>
          <button className="btn-secondary" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  )
}
