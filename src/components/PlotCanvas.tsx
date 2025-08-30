import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { PlotSnapshot } from '../types/plot'
import { 
  calculateChartBounds, 
  getThemeColors, 
  calculateYAxisTicks,
  drawBackgroundAndGrid,
  drawYAxis,
  drawXAxis,
  drawSeries
} from '../utils/plotRendering'

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

    // Calculate layout and theme
    const chart = calculateChartBounds(width, height, showYAxis)
    const theme = getThemeColors()

    if (length === 0) {
      // Just draw background and grid for empty state
      drawBackgroundAndGrid(ctx, width, height, chart, theme, [], yMin, yMax)
      return
    }

    // Calculate Y-axis ticks
    const { ticks: yTicks, step } = calculateYAxisTicks(yMin, yMax)

    // Render all chart elements using focused utility functions
    drawBackgroundAndGrid(ctx, width, height, chart, theme, yTicks, yMin, yMax)
    
    if (showYAxis) {
      drawYAxis(ctx, chart, theme, yTicks, step, yMin, yMax)
    }
    
    drawXAxis(ctx, chart, theme, snap, timeMode)
    drawSeries(ctx, chart, snap, yMin, yMax)
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


