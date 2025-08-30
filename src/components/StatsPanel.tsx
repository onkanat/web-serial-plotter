import type { PlotSnapshot } from '../types/plot'
import Button from './ui/Button'
import { CameraIcon } from '@heroicons/react/24/outline'
import * as htmlToImage from 'html-to-image'

interface Props {
  snapshot: PlotSnapshot
  onScreenshot?: () => void
}

type SeriesStats = {
  min: number
  max: number
  mean: number
  median: number
  stddev: number
  bins: number[]
}

function computeStats(values: Float32Array, numBins = 24): SeriesStats {
  const n = values.length
  if (n === 0) return { min: 0, max: 0, mean: 0, median: 0, stddev: 0, bins: new Array(numBins).fill(0) }
  let min = Infinity, max = -Infinity, sum = 0
  for (let i = 0; i < n; i++) {
    const v = values[i]
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const mean = sum / n
  let variance = 0
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean
    variance += d * d
  }
  variance /= n
  const stddev = Math.sqrt(variance)

  // median (copy + select)
  const copy = Array.from(values)
  copy.sort((a, b) => a - b)
  const median = n % 2 === 1 ? copy[(n - 1) / 2] : (copy[n / 2 - 1] + copy[n / 2]) / 2

  // histogram
  const bins = new Array(numBins).fill(0)
  const range = Math.max(1e-9, max - min)
  for (let i = 0; i < n; i++) {
    const idx = Math.min(numBins - 1, Math.max(0, Math.floor(((values[i] - min) / range) * numBins)))
    bins[idx]++
  }

  return { min, max, mean, median, stddev, bins }
}

export function StatsPanel({ snapshot }: Props) {
  return (
    <div className="mt-2 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {snapshot.series.map((s) => {
        const data = snapshot.getSeriesData(s.id)
        const st = computeStats(data)
        const maxBin = Math.max(1, ...st.bins)
        return (
          <div key={s.id} className="rounded-md p-2" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }} id={`stat-card-${s.id}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium" style={{ color: s.color }}>{s.name}</div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] opacity-60">n={data.length}</div>
                <Button size="sm" aria-label="Save PNG" title="Save PNG" onClick={async () => {
                  const node = document.getElementById(`stat-card-${s.id}`)
                  if (!node) return
                  const dataUrl = await htmlToImage.toPng(node as HTMLElement, { pixelRatio: 2, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#fff' })
                  const a = document.createElement('a')
                  a.href = dataUrl
                  a.download = `stats-${s.name}-${Date.now()}.png`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                }}>
                  <CameraIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
              <div>min: {st.min.toFixed(3)}</div>
              <div>max: {st.max.toFixed(3)}</div>
              <div>mean: {st.mean.toFixed(3)}</div>
              <div>median: {st.median.toFixed(3)}</div>
              <div>stddev: {st.stddev.toFixed(3)}</div>
            </div>
            <div className="mt-2 h-10 flex items-end gap-[2px]">
              {st.bins.map((b, i) => (
                <div key={i} className="flex-1" style={{ height: `${(b / maxBin) * 100}%`, background: 'var(--hist-bar)' }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default StatsPanel


