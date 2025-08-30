import type { PlotSeries } from '../types/plot'

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
  private anchorEverySamples = 50

  constructor(capacity = 8000, seriesCount = 3) {
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
    }
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
    this.emit()
  }

  setMaxHistory(capacity: number) {
    const s = this.snapshot
    if (capacity === s.capacity) return
    const newBuffers = s.buffers.map(() => new Float32Array(capacity))
    const newTimes = new Float64Array(capacity)
    const copyLen = Math.min(capacity, s.length)
    // Copy the most recent copyLen values into the tail of new buffers
    const ringStartIdx = (s.length === s.capacity) ? s.writeIndex : 0
    for (let k = 0; k < s.buffers.length; k++) {
      const src = s.buffers[k]
      const recent = new Float32Array(copyLen)
      if (s.length === s.capacity) {
        const tail = src.subarray(ringStartIdx)
        const head = src.subarray(0, ringStartIdx)
        recent.set(tail, 0)
        recent.set(head, tail.length)
      } else {
        recent.set(src.subarray(s.length - copyLen, s.length), 0)
      }
      newBuffers[k].set(recent, capacity - copyLen)
    }
    // Copy times
    {
      const src = s.times
      const recent = new Float64Array(copyLen)
      if (s.length === s.capacity) {
        const start = s.writeIndex
        const tail = src.subarray(start)
        const head = src.subarray(0, start)
        recent.set(tail, 0)
        recent.set(head, tail.length)
      } else {
        recent.set(src.subarray(s.length - copyLen, s.length), 0)
      }
      newTimes.set(recent, capacity - copyLen)
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
      writeIndex: (capacity === copyLen) ? 0 : copyLen,
      anchors: newAnchors,
    }
    this.emit()
  }

  append(values: number[]) {
    const s = this.snapshot
    if (values.length !== s.buffers.length) return
    const idx = s.writeIndex
    for (let i = 0; i < values.length; i++) {
      s.buffers[i][idx] = values[i]
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
    const windowLength = Math.max(0, Math.min(spec.length, len))
    const startFromNewest = Math.max(0, Math.min(spec.startFromNewest, Math.max(0, len - windowLength)))

    const ringStartCandidate = (len === capacity) ? s.writeIndex : len
    const newestRingIndex = (ringStartCandidate - 1 + capacity) % capacity
    const ringEnd = newestRingIndex
    const ringStart = (ringEnd - (windowLength - 1) - startFromNewest + capacity * 2) % capacity

    let yMin = Number.POSITIVE_INFINITY
    let yMax = Number.NEGATIVE_INFINITY
    const seriesViews: Float32Array[] = []

    for (let k = 0; k < s.buffers.length; k++) {
      const src = s.buffers[k]
      if (ringStart <= ringEnd) {
        const view = src.subarray(ringStart, ringEnd + 1)
        seriesViews[k] = view
        for (let i = 0; i < view.length; i++) {
          const v = view[i]
          if (v < yMin) yMin = v
          if (v > yMax) yMax = v
        }
      } else {
        const head = src.subarray(ringStart)
        const tail = src.subarray(0, ringEnd + 1)
        const joined = new Float32Array(head.length + tail.length)
        joined.set(head, 0)
        joined.set(tail, head.length)
        seriesViews[k] = joined
        for (let i = 0; i < joined.length; i++) {
          const v = joined[i]
          if (v < yMin) yMin = v
          if (v > yMax) yMax = v
        }
      }
    }

    // Contiguous times for window
    let timesView: Float64Array
    if (windowLength === 0) {
      timesView = new Float64Array(0)
    } else if (ringStart <= ringEnd) {
      timesView = s.times.subarray(ringStart, ringEnd + 1)
    } else {
      const head = s.times.subarray(ringStart)
      const tail = s.times.subarray(0, ringEnd + 1)
      timesView = new Float64Array(head.length + tail.length)
      timesView.set(head, 0)
      timesView.set(tail, head.length)
    }

    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = -1; yMax = 1
    } else if (yMax === yMin) {
      const pad = Math.max(1, Math.abs(yMax) * 0.1)
      yMax += pad; yMin -= pad
    }

    const newestTotal = s.total - 1
    const windowStartTotal = newestTotal - (windowLength - 1) - startFromNewest

    const anchors = s.anchors.filter(a => a.total >= windowStartTotal && a.total <= newestTotal)

    return {
      series: s.series,
      getSeriesData: (id: number) => seriesViews[id] ?? new Float32Array(0),
      length: windowLength,
      capacity,
      yMin, yMax,
      getTimes: () => timesView,
      windowStartTotal,
      anchors,
    }
  }

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


