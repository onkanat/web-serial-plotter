import type { PlotSeries } from '../types/plot'
import { calculateDataPosition, calculateScrollBounds, clampScroll } from '../utils/coordinates'

export interface WindowSpec { startFromNewest: number; length: number }

interface StoreSnapshot {
  series: PlotSeries[]
  buffers: Float32Array[]
  times: Float64Array
  capacity: number
  length: number
  writeIndex: number
  total: number
  lastAppendMs: number | null
  emaMsPerSample: number | null
  anchors: { total: number; time: number }[]
  // Viewport state
  windowSize: number
  scrollPosition: number
  frozen: boolean
  freezeBaseTotal: number
  // Incremental min/max tracking
  globalMin: number
  globalMax: number
}

/**
 * RingStore maintains fixed-capacity series buffers and timestamps in a ring.
 * - append(values) writes one sample across all series, records Date.now() to times
 * - getWindow(spec) returns a windowed, contiguous snapshot for rendering and stats
 * - Anchors: created at append-time every N samples (anchorEverySamples), where N can be adjusted
 *   via setAnchorEveryFromWindow(windowLength) to target ~5 anchors for the current window.
 */
export class RingStore {
  private snapshot: StoreSnapshot
  private listeners = new Set<() => void>()
  private anchorEverySamples: number

  constructor(capacity = 100000, seriesCount = 3) {
    this.snapshot = {
      series: new Array(seriesCount).fill(0).map((_, i) => ({ id: i, name: `S${i + 1}`, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] })),
      buffers: new Array(seriesCount).fill(0).map(() => new Float32Array(capacity)),
      times: new Float64Array(capacity),
      capacity,
      length: 0,
      writeIndex: 0,
      total: 0,
      lastAppendMs: null,
      emaMsPerSample: null,
      anchors: [],
      // Viewport state
      windowSize: 200,
      scrollPosition: 0,
      frozen: false,
      freezeBaseTotal: 0,
      // Incremental min/max tracking
      globalMin: Number.POSITIVE_INFINITY,
      globalMax: Number.NEGATIVE_INFINITY,
    }
    // Initialize anchor stride based on initial window size (target ~5 anchors)
    this.anchorEverySamples = Math.max(1, Math.round(this.snapshot.windowSize / 5))
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  setSeries(names: string[]) {
    const seriesCount = names.length
    const { capacity } = this.snapshot
    this.snapshot.series = names.map((n, i) => ({ id: i, name: n, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] }))
    this.snapshot.buffers = new Array(seriesCount).fill(0).map(() => new Float32Array(capacity))
    this.snapshot.times = new Float64Array(capacity)
    this.snapshot.length = 0
    this.snapshot.writeIndex = 0
    this.snapshot.total = 0
    this.snapshot.anchors = []
    // Reset viewport state when data is cleared
    this.snapshot.scrollPosition = 0
    this.snapshot.frozen = false
    this.snapshot.freezeBaseTotal = 0
    // Reset min/max tracking
    this.snapshot.globalMin = Number.POSITIVE_INFINITY
    this.snapshot.globalMax = Number.NEGATIVE_INFINITY
    this.emit()
  }

  setMaxHistory(capacity: number) {
    const s = this.snapshot
    if (capacity === s.capacity) return
    
    const newBuffers = s.buffers.map(() => new Float32Array(capacity))
    const newTimes = new Float64Array(capacity)
    const copyLen = Math.min(capacity, s.length)
    
    if (copyLen > 0 && capacity > 0) {
      // Extract the most recent copyLen values in chronological order
      const recent: number[][] = []
      const recentTimes: number[] = []
      
      if (s.length === s.capacity) {
        // Ring buffer case - data wraps around
        const oldestPos = s.writeIndex
        for (let i = 0; i < copyLen; i++) {
          const ringIdx = (oldestPos + s.length - copyLen + i) % s.capacity
          const values = s.buffers.map(buf => buf[ringIdx])
          recent.push(values)
          recentTimes.push(s.times[ringIdx])
        }
      } else {
        // Linear case - data is contiguous from index 0
        const startIdx = Math.max(0, s.length - copyLen)
        for (let i = 0; i < copyLen; i++) {
          const idx = startIdx + i
          const values = s.buffers.map(buf => buf[idx])
          recent.push(values)
          recentTimes.push(s.times[idx])
        }
      }
      
      // Place extracted data - for non-full buffers, data goes at the beginning
      // For full buffers, data goes at the end
      const targetOffset = copyLen < capacity ? 0 : capacity - copyLen
      for (let k = 0; k < s.buffers.length; k++) {
        for (let i = 0; i < copyLen; i++) {
          newBuffers[k][targetOffset + i] = recent[i][k]
        }
      }
      
      for (let i = 0; i < copyLen; i++) {
        newTimes[targetOffset + i] = recentTimes[i]
      }
    }
    
    // Trim anchors to last copyLen (same samples we kept)
    const newestTotal = s.total - 1
    const keepFromTotal = Math.max(0, newestTotal - copyLen + 1)
    const newAnchors = s.anchors.filter(a => a.total >= keepFromTotal)

    this.snapshot = {
      ...s,
      capacity,
      buffers: newBuffers,
      times: newTimes,
      length: copyLen,
      writeIndex: copyLen < capacity ? copyLen : 0,
      anchors: newAnchors,
    }
    
    // Recompute global min/max for remaining data
    this.recomputeGlobalMinMax()
    
    // Revalidate viewport constraints after capacity change
    this.setWindowSize(s.windowSize) // This will also revalidate scroll position
    this.emit()
  }

  append(values: number[]) {
    const s = this.snapshot
    if (values.length !== s.buffers.length) return
    const idx = s.writeIndex
    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      s.buffers[i][idx] = value
      // Update global min/max incrementally
      if (Number.isFinite(value)) {
        if (value < s.globalMin) s.globalMin = value
        if (value > s.globalMax) s.globalMax = value
      }
    }
    const now = Date.now()
    s.times[idx] = now
    s.writeIndex = (idx + 1) % s.capacity
    s.length = Math.min(s.length + 1, s.capacity)
    s.total += 1
    // EMA of ms/sample for diagnostics and optional UI use
    if (s.lastAppendMs != null) {
      const dt = Math.max(1, now - s.lastAppendMs)
      const alpha = 0.2
      s.emaMsPerSample = s.emaMsPerSample == null ? dt : alpha * dt + (1 - alpha) * s.emaMsPerSample
    }
    s.lastAppendMs = now

    // Append-time anchors using current stride
    const justWrittenTotal = s.total - 1
    if (justWrittenTotal % this.anchorEverySamples === 0) {
      s.anchors.push({ total: justWrittenTotal, time: now })
    }
    // Trim anchors to match history size
    const minKeepTotal = Math.max(0, s.total - s.capacity)
    if (s.anchors.length > 0 && s.anchors[0].total < minKeepTotal) {
      let drop = 0
      while (drop < s.anchors.length && s.anchors[drop].total < minKeepTotal) drop++
      if (drop > 0) s.anchors.splice(0, drop)
    }

    this.emit()
  }

  /** Recompute global min/max across all retained data. */
  private recomputeGlobalMinMax() {
    const s = this.snapshot
    s.globalMin = Number.POSITIVE_INFINITY
    s.globalMax = Number.NEGATIVE_INFINITY
    
    if (s.length === 0) return
    
    for (let k = 0; k < s.buffers.length; k++) {
      const buffer = s.buffers[k]
      if (s.length < s.capacity) {
        // Linear case
        for (let i = 0; i < s.length; i++) {
          const value = buffer[i]
          if (Number.isFinite(value)) {
            if (value < s.globalMin) s.globalMin = value
            if (value > s.globalMax) s.globalMax = value
          }
        }
      } else {
        // Ring case
        for (let i = 0; i < s.capacity; i++) {
          const value = buffer[i]
          if (Number.isFinite(value)) {
            if (value < s.globalMin) s.globalMin = value
            if (value > s.globalMax) s.globalMax = value
          }
        }
      }
    }
  }

  /** Rebuild anchors across current retained samples based on anchorEverySamples. */
  private recomputeAnchors() {
    const s = this.snapshot
    s.anchors = []
    const len = s.length
    if (len === 0) return
    const oldestTotal = s.total - len
    if (len < s.capacity) {
      for (let pos = 0; pos < len; pos++) {
        const total = oldestTotal + pos
        if (total % this.anchorEverySamples === 0) {
          const t = s.times[pos]
          s.anchors.push({ total, time: t })
        }
      }
    } else {
      // Full ring
      for (let pos = 0; pos < len; pos++) {
        const total = oldestTotal + pos
        if (total % this.anchorEverySamples === 0) {
          const ringIdx = (s.writeIndex + pos) % s.capacity
          const t = s.times[ringIdx]
          s.anchors.push({ total, time: t })
        }
      }
    }
  }

  /** Set anchor stride based on window length (target ~5 anchors) and rebuild anchors. */
  setAnchorEveryFromWindow(windowLength: number) {
    const step = Math.max(1, Math.round(windowLength / 5))
    this.anchorEverySamples = step
    this.recomputeAnchors()
    this.emit()
  }

  getWindow(spec: WindowSpec) {
    const s = this.snapshot
    const len = s.length
    const capacity = s.capacity
    const clampedStartFromNewest = Math.max(0, spec.startFromNewest)
    const maxWindowLength = Math.max(0, len - clampedStartFromNewest)
    const actualDataLength = Math.max(0, Math.min(spec.length, maxWindowLength))
    const requestedLength = Math.max(0, spec.length)
    const startFromNewest = clampedStartFromNewest
    
    // Validate requested length to prevent invalid array creation
    if (requestedLength > 1e7) { // Reasonable upper bound
      return this.getWindow({ startFromNewest: spec.startFromNewest, length: 1e7 })
    }

    const seriesViews: Float32Array[] = []
    let timesView: Float64Array

    if (requestedLength === 0) {
      // Handle zero-length window case
      for (let k = 0; k < s.buffers.length; k++) {
        seriesViews[k] = new Float32Array(0)
      }
      timesView = new Float64Array(0)
    } else if (actualDataLength === 0) {
      // Handle case where no data is available - return arrays filled with NaN
      for (let k = 0; k < s.buffers.length; k++) {
        const paddedView = new Float32Array(requestedLength)
        paddedView.fill(NaN)
        seriesViews[k] = paddedView
      }
      timesView = new Float64Array(requestedLength)
      timesView.fill(NaN)
    } else {
      const ringStartCandidate = (len === capacity) ? s.writeIndex : len
      const newestRingIndex = (ringStartCandidate - 1 + capacity) % capacity
      const ringEnd = newestRingIndex
      const ringStart = (ringEnd - (actualDataLength - 1) - startFromNewest + capacity * 2) % capacity

      // Extract actual data
      const actualSeriesData: Float32Array[] = []
      let actualTimes: Float64Array

      for (let k = 0; k < s.buffers.length; k++) {
        const src = s.buffers[k]
        if (ringStart <= ringEnd) {
          const view = src.subarray(ringStart, ringEnd + 1)
          actualSeriesData[k] = view
        } else {
          const head = src.subarray(ringStart)
          const tail = src.subarray(0, ringEnd + 1)
          const joined = new Float32Array(head.length + tail.length)
          joined.set(head, 0)
          joined.set(tail, head.length)
          actualSeriesData[k] = joined
        }
      }

      // Extract actual times
      if (ringStart <= ringEnd) {
        actualTimes = s.times.subarray(ringStart, ringEnd + 1)
      } else {
        const head = s.times.subarray(ringStart)
        const tail = s.times.subarray(0, ringEnd + 1)
        actualTimes = new Float64Array(head.length + tail.length)
        actualTimes.set(head, 0)
        actualTimes.set(tail, head.length)
      }

      // Now pad to requested length if needed
      for (let k = 0; k < s.buffers.length; k++) {
        if (actualDataLength < requestedLength) {
          const paddedView = new Float32Array(requestedLength)
          paddedView.fill(NaN)
          // Place actual data at the end (most recent position)
          const offset = requestedLength - actualDataLength
          paddedView.set(actualSeriesData[k], offset)
          seriesViews[k] = paddedView
        } else {
          seriesViews[k] = actualSeriesData[k]
        }
      }

      // Pad times similarly
      if (actualDataLength < requestedLength) {
        timesView = new Float64Array(requestedLength)
        timesView.fill(NaN)
        const offset = requestedLength - actualDataLength
        timesView.set(actualTimes, offset)
      } else {
        timesView = actualTimes
      }
    }

    // Use precomputed global min/max for better performance
    let yMin = s.globalMin
    let yMax = s.globalMax
    
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = -1; yMax = 1
    } else if (yMax === yMin) {
      const pad = Math.max(1, Math.abs(yMax) * 0.1)
      yMax += pad; yMin -= pad
    }

    const newestTotal = s.total - 1
    const windowStartTotal = newestTotal - (requestedLength - 1) - startFromNewest

    const anchors = s.anchors.filter(a => a.total >= windowStartTotal && a.total <= newestTotal)

    return {
      series: s.series,
      getSeriesData: (id: number) => seriesViews[id] ?? new Float32Array(0),
      length: requestedLength,
      capacity,
      yMin, yMax,
      getTimes: () => timesView,
      windowStartTotal,
      anchors,
      intendedWindowSize: s.windowSize,
    }
  }

  // Viewport state management
  setWindowSize(size: number): number {
    const s = this.snapshot
    const clampedSize = Math.max(1, Math.min(size, Math.max(1, s.length)))
    s.windowSize = clampedSize
    // Re-validate scroll position when window size changes
    const bounds = this.calculateScrollBounds()
    s.scrollPosition = clampScroll(s.scrollPosition, bounds)
    // Update anchor stride when window size changes (target ~5 anchors)
    const step = Math.max(1, Math.round(clampedSize / 5))
    this.anchorEverySamples = step
    this.recomputeAnchors()
    this.emit()
    return clampedSize
  }

  getWindowSize(): number {
    return this.snapshot.windowSize
  }

  setScrollPosition(position: number): number {
    const s = this.snapshot
    const bounds = this.calculateScrollBounds()
    s.scrollPosition = clampScroll(position, bounds)
    this.emit()
    return s.scrollPosition
  }

  getScrollPosition(): number {
    return this.snapshot.scrollPosition
  }

  adjustScrollPosition(delta: number): number {
    return this.setScrollPosition(this.snapshot.scrollPosition + delta)
  }

  setFrozen(frozen: boolean): void {
    const s = this.snapshot
    if (frozen && !s.frozen) {
      // Entering frozen state - capture current total
      s.freezeBaseTotal = s.total
    }
    s.frozen = frozen
    if (!frozen) {
      // Exiting frozen state - reset scroll to valid range
      this.setScrollPosition(s.scrollPosition)
    }
    this.emit()
  }

  getFrozen(): boolean {
    return this.snapshot.frozen
  }

  private calculateScrollBounds() {
    const s = this.snapshot
    const deltaSize = s.frozen ? Math.max(0, s.total - s.freezeBaseTotal) : 0
    return calculateScrollBounds(s.length, s.windowSize, deltaSize, s.frozen)
  }

  getCurrentWindow() {
    const s = this.snapshot
    const delta = s.frozen ? Math.max(0, s.total - s.freezeBaseTotal) : 0
    const startFromNewest = calculateDataPosition({
      uiStart: s.scrollPosition,
      delta,
      frozen: s.frozen
    })
    return this.getWindow({ startFromNewest, length: s.windowSize })
  }

  // Zoom controls
  zoomByFactor(factor: number): void {
    const s = this.snapshot
    const currentLen = s.windowSize
    const clampedFactor = Math.max(0.5, Math.min(2, factor))
    const desired = Math.round(currentLen / clampedFactor)
    const newWindowSize = Math.max(10, Math.min(s.length, desired))
    
    // Calculate center before zoom
    const delta = s.frozen ? Math.max(0, s.total - s.freezeBaseTotal) : 0
    const centerFromNewest = calculateDataPosition({
      uiStart: s.scrollPosition,
      delta,
      frozen: s.frozen
    }) + Math.floor(currentLen / 2)
    
    // Update window size and anchors
    s.windowSize = newWindowSize
    const step = Math.max(1, Math.round(newWindowSize / 5))
    this.anchorEverySamples = step
    this.recomputeAnchors()
    
    // Calculate new scroll position to maintain center
    const newStartFromNewest = Math.max(0, centerFromNewest - Math.floor(newWindowSize / 2))
    const newUiStart = newStartFromNewest - (s.frozen ? delta : 0)
    const bounds = this.calculateScrollBounds()
    s.scrollPosition = clampScroll(newUiStart, bounds)
    
    this.emit()
  }

  handleWheel(event: { deltaY: number, clientX: number }): void {
    const clampedDelta = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 1000)
    const factor = Math.exp(clampedDelta * 0.001)
    this.zoomByFactor(factor)
  }

  // Momentum scrolling support
  private momentumState: { animationId: number | null } = { animationId: null }

  startMomentum(velocity: number): void {
    this.stopMomentum()
    
    if (!Number.isFinite(velocity) || Math.abs(velocity) < 0.005) return
    
    let currentVelocity = velocity
    let lastTimestamp = performance.now()
    
    const step = (ts: number) => {
      const dt = Math.max(1, ts - lastTimestamp)
      lastTimestamp = ts
      
      // Exponential decay friction (~0.95 per 16.7ms) - same as old implementation
      currentVelocity *= Math.pow(0.95, dt / 16.7)
      
      if (Math.abs(currentVelocity) < 0.005) {
        this.stopMomentum()
        return
      }
      
      // Apply velocity scaled by time - same as old implementation
      const movement = currentVelocity * dt
      this.adjustScrollPosition(movement)
      this.momentumState.animationId = requestAnimationFrame(step)
    }
    
    this.momentumState.animationId = requestAnimationFrame(step)
  }

  stopMomentum(): void {
    if (this.momentumState.animationId !== null) {
      cancelAnimationFrame(this.momentumState.animationId)
      this.momentumState.animationId = null
    }
  }

  // Legacy getters
  getTotal() { return this.snapshot.total }
  getCapacity() { return this.snapshot.capacity }
  getSeries() { return this.snapshot.series }
  getMsPerSample() { return this.snapshot.emaMsPerSample ?? 0 }
  getLength() { return this.snapshot.length }

  renameSeries(id: number, name: string) {
    const s = this.snapshot
    const target = s.series.find((m) => m.id === id)
    if (!target) return
    target.name = name
    this.emit()
  }

  setSeriesColor(id: number, color: string) {
    const s = this.snapshot
    const target = s.series.find((m) => m.id === id)
    if (!target) return
    target.color = color
    this.emit()
  }
}

const DEFAULT_COLORS = ['#60a5fa','#f472b6','#34d399','#fbbf24','#a78bfa','#f87171','#22d3ee','#84cc16']


