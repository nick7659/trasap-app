import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

// ใช้ forwardRef เพื่อให้ parent เรียก .getDataURL() และ .isEmpty() ได้
const SignatureCanvas = forwardRef(function SignatureCanvas(_, ref) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const hasDrawn  = useRef(false)

  useImperativeHandle(ref, () => ({
    getDataURL: () => canvasRef.current?.toDataURL('image/png') || '',
    isEmpty:    () => !hasDrawn.current,
    clear:      () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
      hasDrawn.current = false
    }
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const init = () => {
      const dpr  = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width  * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = '#1B2A4A'
      ctx.lineWidth   = 2.4
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
    }
    init()

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect()
      const src  = e.touches ? e.touches[0] : e
      return { x: src.clientX - rect.left, y: src.clientY - rect.top }
    }

    const onStart = (e) => {
      e.preventDefault()
      drawing.current = true
      const ctx = canvas.getContext('2d')
      const pos = getPos(e)
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    }
    const onMove = (e) => {
      e.preventDefault()
      if (!drawing.current) return
      const ctx = canvas.getContext('2d')
      const pos = getPos(e)
      ctx.lineTo(pos.x, pos.y); ctx.stroke()
      hasDrawn.current = true
      // แจ้ง parent ว่ามีการวาด (ผ่าน custom event)
      canvas.dispatchEvent(new Event('drawn', { bubbles: true }))
    }
    const onEnd = () => { drawing.current = false }

    canvas.addEventListener('mousedown',  onStart)
    canvas.addEventListener('mousemove',  onMove)
    canvas.addEventListener('mouseup',    onEnd)
    canvas.addEventListener('mouseleave', onEnd)
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove',  onMove,  { passive: false })
    canvas.addEventListener('touchend',   onEnd)

    const ro = new ResizeObserver(init)
    ro.observe(canvas)
    return () => {
      ro.disconnect()
      canvas.removeEventListener('mousedown',  onStart)
      canvas.removeEventListener('mousemove',  onMove)
      canvas.removeEventListener('mouseup',    onEnd)
      canvas.removeEventListener('mouseleave', onEnd)
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove',  onMove)
      canvas.removeEventListener('touchend',   onEnd)
    }
  }, [])

  return (
    <div style={{position:'relative', border:'1.5px dashed #D8D0BC', borderRadius:'8px', background:'#fdfcf7'}}>
      <canvas
        ref={canvasRef}
        style={{width:'100%', height:'160px', display:'block', touchAction:'none', borderRadius:'8px', cursor:'crosshair'}}
      />
      {/* เส้นฐานลายเซ็น */}
      <div style={{
        position:'absolute', left:'24px', right:'24px', bottom:'30px',
        borderTop:'1.5px solid #D8D0BC', pointerEvents:'none'
      }}/>
    </div>
  )
})

export default SignatureCanvas
