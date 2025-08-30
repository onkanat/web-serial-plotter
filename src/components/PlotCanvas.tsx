import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { PlotSnapshot } from '../types/plot'

/**
 * DPR-aware canvas renderer for the plot area.
 * - Expects a windowed PlotSnapshot (data + times) from the store
 * - Draws background, grid, Y-axis (nice ticks), sample series, and X-axis using stored anchors
 * - Supports mouse/touch grab-to-pan via onPan* callbacks and pinch-to-zoom via onZoomFactor
 */
interface Props {
  snapshot: PlotSnapshot
  yOverride?: { min: number; max: number } | null
  showYAxis?: boolean
  timeMode?: 'absolute' | 'relative'
  onPanStart?: () => void
  onPanDelta?: (deltaSamples: number) => void
  onPanEnd?: (endVelocitySamplesPerMs: number) => void
  onZoomFactor?: (factor: number) => void
}

export type PlotCanvasHandle = {
  exportPNG: (opts?: { scale?: number; background?: string }) => string
}

export const PlotCanvas = forwardRef<PlotCanvasHandle, Props>(function PlotCanvas({ snapshot, yOverride, showYAxis = true, timeMode = 'absolute', onPanStart, onPanDelta, onPanEnd, onZoomFactor }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const snapshotRef = useRef<PlotSnapshot>(snapshot)
  const yOverrideRef = useRef<Props['yOverride']>(yOverride)
  const panStartRef = useRef<Props['onPanStart'] | undefined>(undefined)
  const panDeltaRef = useRef<Props['onPanDelta'] | undefined>(undefined)
  const panEndRef = useRef<Props['onPanEnd'] | undefined>(undefined)
  const zoomFactorRef = useRef<Props['onZoomFactor'] | undefined>(undefined)
  panStartRef.current = onPanStart
  panDeltaRef.current = onPanDelta
  panEndRef.current = onPanEnd
  zoomFactorRef.current = onZoomFactor

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const snap = snapshotRef.current
    const yOv = yOverrideRef.current

    const { length } = snap
    const yMin = yOv ? yOv.min : snap.yMin
    const yMax = yOv ? yOv.max : snap.yMax
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Robust clear: reset transform and clear full backing store to avoid 1px artifacts
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    // Background and theme colors
    const getVar = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name) || fallback
    const plotBg = getVar('--plot-bg', 'rgba(10,10,10,0.9)')
    const plotGrid = getVar('--plot-grid', 'rgba(255,255,255,0.06)')
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e5e5e5'

    // Fill background with current transform so coordinates are CSS pixels
    ctx.fillStyle = plotBg
    ctx.fillRect(0, 0, width, height)

    // Chart layout
    const leftAxis = showYAxis ? 44 : 8
    const rightPadding = 8
    const topPadding = 8
    const bottomPadding = 26
    const chartX = leftAxis
    const chartY = topPadding
    const chartW = Math.max(1, width - leftAxis - rightPadding)
    const chartH = Math.max(1, height - topPadding - bottomPadding)

    // Vertical grid (fixed every 80px for readability)
    ctx.strokeStyle = plotGrid
    ctx.lineWidth = 1
    for (let x = chartX; x <= chartX + chartW; x += 80) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, chartY)
      ctx.lineTo(x + 0.5, chartY + chartH)
      ctx.stroke()
    }

    if (length === 0) return

    const xScale = length > 1 ? chartW / (length - 1) : 1
    const yScale = (yMax - yMin) !== 0 ? chartH / (yMax - yMin) : 1

    // Y-axis nice ticks
    const approxTicks = 6
    const range = yMax - yMin
    const niceNum = (rng: number, round: boolean) => {
      const exp = Math.floor(Math.log10(rng))
      const f = rng / Math.pow(10, exp)
      let nf
      if (round) {
        if (f < 1.5) nf = 1
        else if (f < 3) nf = 2
        else if (f < 7) nf = 5
        else nf = 10
      } else {
        if (f <= 1) nf = 1
        else if (f <= 2) nf = 2
        else if (f <= 5) nf = 5
        else nf = 10
      }
      return nf * Math.pow(10, exp)
    }
    const step = niceNum(range / approxTicks, true)
    const tickMin = Math.ceil(yMin / step) * step
    const tickMax = Math.floor(yMax / step) * step

    // Horizontal grid
    for (let v = tickMin; v <= tickMax + 1e-9; v += step) {
      const y = chartY + chartH - (v - yMin) * yScale
      ctx.beginPath()
      ctx.moveTo(chartX, y + 0.5)
      ctx.lineTo(chartX + chartW, y + 0.5)
      ctx.stroke()
    }

    // Y-axis line & labels
    if (showYAxis) {
      ctx.strokeStyle = plotGrid
      ctx.beginPath()
      ctx.moveTo(chartX + 0.5, chartY)
      ctx.lineTo(chartX + 0.5, chartY + chartH)
      ctx.stroke()

      ctx.fillStyle = textColor.trim() || '#e5e5e5'
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let v = tickMin; v <= tickMax + 1e-9; v += step) {
        const y = chartY + chartH - (v - yMin) * yScale
        ctx.fillText(v.toFixed(Math.max(0, -Math.floor(Math.log10(step)))) as unknown as string, chartX - 6, y)
      }
    }

    // X-axis using stored anchors (one tick+label per anchor)
    {
      const times = snap.getTimes?.() ?? new Float64Array(0)
      if (times.length >= 2) {
        const rightTime = times[times.length - 1]
        const leftTime = times[0]
        const windowMs = Math.max(1, rightTime - leftTime)

        ctx.strokeStyle = plotGrid
        ctx.fillStyle = textColor.trim() || '#e5e5e5'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial'

        const formatAbs = (ts: number) => {
          const d = new Date(ts)
          const hh = d.getHours().toString().padStart(2, '0')
          const mm = d.getMinutes().toString().padStart(2, '0')
          const ss = d.getSeconds().toString().padStart(2, '0')
          const ms = d.getMilliseconds().toString().padStart(3, '0')
          if (windowMs >= 60_000) return `${hh}:${mm}:${ss}`
          return `${hh}:${mm}:${ss}.${ms}`
        }

        const anchors = snap.anchors || []
        const startTotal = snap.windowStartTotal
        for (let i = 0; i < anchors.length; i++) {
          const a = anchors[i]
          const relIdx = a.total - startTotal
          if (relIdx < 0 || relIdx >= length) continue
          const x = Math.round(chartX + relIdx * xScale) + 0.5
          ctx.beginPath()
          ctx.moveTo(x + 0.5, chartY + chartH)
          ctx.lineTo(x + 0.5, chartY + chartH + 4)
          ctx.stroke()
          const label = timeMode === 'absolute'
            ? formatAbs(a.time)
            : (() => { const dt = rightTime - a.time; const secs = dt / 1000; return secs >= 1 ? `${secs.toFixed((secs >= 10 || windowMs >= 60_000) ? 0 : 1)}s` : `${Math.round(secs * 1000)}ms` })()
          ctx.fillText(label, x, chartY + chartH + 6)
        }
      }
    }

    // Series (clip to chart rect to avoid edge bleed)
    ctx.save()
    ctx.beginPath()
    ctx.rect(chartX, chartY, chartW, chartH)
    ctx.clip()
    snap.series.forEach((s) => {
      const view = snap.getSeriesData(s.id)
      if (!view || view.length === 0) return
      ctx.beginPath()
      ctx.strokeStyle = s.color
      ctx.lineWidth = 1.5
      for (let i = 0; i < view.length; i++) {
        const x = chartX + i * xScale
        const y = chartY + chartH - (view[i] - yMin) * yScale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    })
    ctx.restore()
  }, [showYAxis, timeMode])

  // Resize to DPR changes and container size
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      const newW = Math.floor(rect.width * dpr)
      const newH = Math.floor(rect.height * dpr)
      if (canvas.width !== newW || canvas.height !== newH) {
        canvas.width = newW
        canvas.height = newH
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      draw()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    return () => ro.disconnect()
  }, [draw])

  // Grab-to-pan & pinch-to-zoom handlers (stable across renders)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let isDragging = false
    let lastX = 0
    let accumSamples = 0
    let activePointerId: number | null = null
    let vEst = 0
    let lastTs = 0

    // Pinch state
    const pointers = new Map<number, { x: number; y: number }>()
    let isPinching = false
    let pinchStartDist = 0

    const updateCursor = () => {
      canvas.style.cursor = isDragging ? 'grabbing' : 'grab'
    }

    canvas.style.touchAction = 'none'

    const getSamplesPerPixel = () => {
      const snap = snapshotRef.current
      const length = snap.length
      if (length <= 1) return 0
      const width = canvas.clientWidth
      const leftAxis = 44
      const rightPadding = 8
      const chartW = Math.max(1, width - leftAxis - rightPadding)
      return (length - 1) / chartW
    }

    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = a.x - b.x
      const dy = a.y - b.y
      return Math.hypot(dx, dy)
    }

    const updateVelocity = (dx: number, ts: number) => {
      const spp = getSamplesPerPixel()
      const dt = Math.max(1, ts - (lastTs || ts))
      lastTs = ts
      const rawSamples = dx * spp
      const vInst = rawSamples / dt
      vEst = 0.8 * vEst + 0.2 * vInst
    }

    const onPointerMove = (e: PointerEvent) => {
      const pt = pointers.get(e.pointerId)
      if (pt) { pt.x = e.clientX; pt.y = e.clientY }
      if (isPinching && pointers.size >= 2 && zoomFactorRef.current) {
        const [p1, p2] = Array.from(pointers.values())
        const d = dist(p1, p2)
        if (pinchStartDist > 0 && d > 0) {
          const factor = d / pinchStartDist
          pinchStartDist = d
          zoomFactorRef.current(factor)
        }
        e.preventDefault()
        return
      }

      if (!isDragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      updateVelocity(dx, e.timeStamp || performance.now())
      const spp = getSamplesPerPixel()
      if (spp > 0 && panDeltaRef.current) {
        accumSamples += dx * spp
        const step = (accumSamples >= 0) ? Math.floor(accumSamples) : Math.ceil(accumSamples)
        if (step !== 0) {
          accumSamples -= step
          panDeltaRef.current(step)
        }
      }
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      updateVelocity(dx, e.timeStamp || performance.now())
      const spp = getSamplesPerPixel()
      if (spp > 0 && panDeltaRef.current) {
        accumSamples += dx * spp
        const step = (accumSamples >= 0) ? Math.floor(accumSamples) : Math.ceil(accumSamples)
        if (step !== 0) {
          accumSamples -= step
          panDeltaRef.current(step)
        }
      }
      e.preventDefault()
    }

    const cleanupDrag = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag as unknown as EventListener)
      window.removeEventListener('pointercancel', endDrag as unknown as EventListener)
      window.removeEventListener('blur', onWindowBlur as unknown as EventListener)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', endDrag as unknown as EventListener)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endDrag as unknown as EventListener)
      canvas.removeEventListener('lostpointercapture', onLostCapture as unknown as EventListener)
      canvas.removeEventListener('pointerleave', onCanvasLeave as unknown as EventListener)
      canvas.removeEventListener('wheel', onWheel as unknown as EventListener)
      if (activePointerId != null) {
        try { canvas.releasePointerCapture(activePointerId) } catch { /* ignore */ }
        activePointerId = null
      }
      pointers.clear()
      isPinching = false
      pinchStartDist = 0
    }

    const endDrag = (e?: Event) => {
      if (isPinching) {
        isPinching = false
        pinchStartDist = 0
      }
      if (!isDragging) {
        cleanupDrag()
        return
      }
      isDragging = false
      updateCursor()
      cleanupDrag()
      if (panEndRef.current) panEndRef.current(vEst)
      vEst = 0
      lastTs = 0
      if (e) e.preventDefault?.()
    }

    const onWindowBlur = () => endDrag()
    const onLostCapture = () => endDrag()
    const onCanvasLeave = () => { /* capture keeps us dragging; no-op */ }

    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [p1, p2] = Array.from(pointers.values())
        pinchStartDist = dist(p1, p2)
        isPinching = true
        if (panStartRef.current) panStartRef.current()
      } else if (pointers.size === 1) {
        if (e.button !== 0) return
        isDragging = true
        lastX = e.clientX
        accumSamples = 0
        activePointerId = e.pointerId
        vEst = 0
        lastTs = e.timeStamp || performance.now()
        updateCursor()
        try { canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        window.addEventListener('pointermove', onPointerMove, { passive: false })
        window.addEventListener('pointerup', endDrag as unknown as EventListener, { passive: false })
        window.addEventListener('pointercancel', endDrag as unknown as EventListener, { passive: false })
        window.addEventListener('blur', onWindowBlur as unknown as EventListener)
        canvas.addEventListener('pointermove', onPointerMove, { passive: false })
        canvas.addEventListener('pointerup', endDrag as unknown as EventListener, { passive: false })
        canvas.addEventListener('lostpointercapture', onLostCapture as unknown as EventListener)
        canvas.addEventListener('pointerleave', onCanvasLeave as unknown as EventListener)
        window.addEventListener('mousemove', onMouseMove, { passive: false })
        window.addEventListener('mouseup', endDrag as unknown as EventListener, { passive: false })
        if (panStartRef.current) panStartRef.current()
      }
      e.preventDefault()
    }

    const onWheel = (e: WheelEvent) => {
      if (!zoomFactorRef.current) return
      if (e.ctrlKey) {
        const factor = Math.pow(1.0015, -e.deltaY)
        zoomFactorRef.current(factor)
        e.preventDefault()
      }
    }

    const onWheelGlobal = (e: WheelEvent) => {
      if (!zoomFactorRef.current) return
      if (!e.ctrlKey) return
      if (!canvas.contains(e.target as Node)) return
      const factor = Math.pow(1.0015, -e.deltaY)
      zoomFactorRef.current(factor)
      e.preventDefault()
    }

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
    canvas.addEventListener('pointermove', onPointerMove, { passive: false })
    canvas.addEventListener('wheel', onWheel as unknown as EventListener, { passive: false })
    window.addEventListener('wheel', onWheelGlobal as unknown as EventListener, { passive: false, capture: true })
    updateCursor()
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown as unknown as EventListener)
      cleanupDrag()
      canvas.removeEventListener('wheel', onWheel as unknown as EventListener)
      window.removeEventListener('wheel', onWheelGlobal as unknown as EventListener, true as unknown as AddEventListenerOptions)
      canvas.style.cursor = ''
      canvas.style.touchAction = ''
    }
  }, [draw])

  // Redraw on snapshot or scale changes
  useEffect(() => {
    snapshotRef.current = snapshot
    yOverrideRef.current = yOverride
    draw()
  }, [snapshot, yOverride, draw])

  // Redraw when theme class toggles
  useEffect(() => {
    const observer = new MutationObserver(() => draw())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [draw])

  useImperativeHandle(ref, () => ({
    exportPNG: (opts) => {
      const canvas = canvasRef.current
      if (!canvas) return ''
      const scale = Math.max(1, Math.floor(opts?.scale ?? 1))
      if (scale === 1 && !opts?.background) {
        return canvas.toDataURL('image/png')
      }
      const off = document.createElement('canvas')
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      const w = Math.floor(canvas.clientWidth * scale)
      const h = Math.floor(canvas.clientHeight * scale)
      off.width = w
      off.height = h
      const octx = off.getContext('2d')!
      if (opts?.background) {
        octx.fillStyle = opts.background
        octx.fillRect(0, 0, off.width, off.height)
      }
      octx.scale(scale, scale)
      const bitmap = document.createElement('canvas')
      bitmap.width = Math.floor(canvas.clientWidth * dpr)
      bitmap.height = Math.floor(canvas.clientHeight * dpr)
      const bctx = bitmap.getContext('2d')!
      bctx.drawImage(canvas, 0, 0)
      octx.drawImage(bitmap, 0, 0, bitmap.width / dpr, bitmap.height / dpr)
      return off.toDataURL('image/png')
    },
  }))

  return (
    <canvas ref={canvasRef} className="w-full h-full rounded-lg border border-neutral-800 block" />
  )
})

export default PlotCanvas


