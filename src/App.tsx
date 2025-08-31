import './App.css'
import Header from './components/Header'
import ThemeToggle from './components/ThemeToggle'
import PlotCanvas, { type PlotCanvasHandle } from './components/PlotCanvas'
import Button from './components/ui/Button'
import Input from './components/ui/Input'
import Checkbox from './components/ui/Checkbox'
import Select from './components/ui/Select'
import GeneratorPanel from './components/GeneratorPanel'
// Old SeriesPanel legend removed; overlay legend is used instead
import StatsPanel from './components/StatsPanel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSerial } from './hooks/useSerial'
import { useDataStore } from './store/dataStore'
// Note: useZoomControls and useMomentumScrolling removed - now handled by RingStore
import Legend from './components/Legend'
import { CameraIcon, PauseIcon, PlayIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon } from '@heroicons/react/24/outline'
import * as htmlToImage from 'html-to-image'

function App() {
  const { state, connect, disconnect, onLine } = useSerial()
  const store = useDataStore()
  const [lastLine, setLastLine] = useState<string>('')
  const [autoscale, setAutoscale] = useState(true)
  const [manualMinInput, setManualMinInput] = useState('-1')
  const [manualMaxInput, setManualMaxInput] = useState('1')
  // Note: windowSize, scrollPosition, frozen state now managed by store
  const [timeMode, setTimeMode] = useState<'absolute' | 'relative'>('absolute')

  // Viewport controls now handled directly by store

  const handleIncomingLine = useCallback((line: string) => {
    setLastLine(line)
    if (line.trim().startsWith('#')) {
      const names = line.replace(/^\s*#+\s*/, '').split(/[\s,\t]+/).filter(Boolean)
      if (names.length > 0) store.setSeries(names)
      return
    }
    const parts = line.trim().split(/[\s,\t]+/).filter(Boolean)
    if (parts.length === 0) return
    const values: number[] = []
    for (const p of parts) {
      const v = Number(p)
      if (Number.isFinite(v)) values.push(v)
    }
    if (values.length > 0) store.append(values)
  }, [store])

  useEffect(() => {
    onLine(handleIncomingLine)
  }, [onLine, handleIncomingLine])

  const statusText = useMemo(() => {
    if (!state.isSupported) return 'Web Serial unsupported'
    if (state.isConnecting) return 'Connecting…'
    if (state.isConnected) return 'Connected'
    return 'Disconnected'
  }, [state])

  const canvasRef = useRef<PlotCanvasHandle | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const plotContainerRef = useRef<HTMLDivElement | null>(null)
  const toolsRef = useRef<HTMLDivElement | null>(null)
  const [statsHeightPx, setStatsHeightPx] = useState(240)

  const startDragResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const onMove = (ev: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      let h = rect.bottom - ev.clientY
      const min = 120
      const max = Math.max(min, rect.height - 120)
      h = Math.max(min, Math.min(max, h))
      setStatsHeightPx(h)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [setStatsHeightPx])

  // Initialize anchor settings based on window size (run once)
  useEffect(() => {
    store.setAnchorEveryFromWindow(store.getWindowSize())
  }, [store])

  return (
    <div className="h-dvh flex flex-col bg-white text-gray-900 dark:bg-neutral-950 dark:text-neutral-100 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-neutral-800">
        <Header
          supported={state.isSupported}
          isConnected={state.isConnected}
          isConnecting={state.isConnecting}
          onConnect={(baud) => void connect(baud)}
          onDisconnect={() => void disconnect()}
          rightSlot={
            <div className="flex items-center gap-3">
              <GeneratorPanel onEmitLine={handleIncomingLine} disabled={state.isConnected || state.isConnecting} />
            </div>
          }
        />
        <div className="pr-4">
          <ThemeToggle />
        </div>
      </div>

      <main className="flex-1 w-full px-4 py-3 flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="text-xs opacity-70">Status: {statusText}{state.error ? ` · ${state.error}` : ''}</div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs opacity-70">Scale</span>
            {/* inline scale controls to keep UI compact */}
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={autoscale} onChange={(e) => setAutoscale(e.target.checked)} />
                <span className="opacity-80">Autoscale Y</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="opacity-70">Y min</span>
                <Input className="w-24" type="number" value={manualMinInput} onChange={(e) => setManualMinInput(e.target.value)} disabled={autoscale} />
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-70">Y max</span>
                <Input className="w-24" type="number" value={manualMaxInput} onChange={(e) => setManualMaxInput(e.target.value)} disabled={autoscale} />
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-70">History</span>
                <Input className="w-28" type="number" min={100} step={100} value={store.getCapacity()} onChange={(e) => {
                  const cap = Math.max(100, Math.floor(Number(e.target.value) || 0))
                  store.setMaxHistory(cap)
                }} />
                <span className="opacity-70">pts</span>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <span className="opacity-70">Time</span>
                <Select value={timeMode} onChange={(e) => setTimeMode(e.target.value as 'absolute' | 'relative')}>
                  <option value="absolute">Absolute</option>
                  <option value="relative">Relative</option>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Legend moved into overlay on plot */}

        <div
          className="flex-1 min-h-0 grid"
          ref={containerRef}
          style={{ gridTemplateRows: `minmax(0,1fr) 6px ${statsHeightPx}px` }}
        >
          {(() => {
            const snap = store.getCurrentWindow()
            return (
              <div className="relative w-full h-full" ref={plotContainerRef}>
                <PlotCanvas
                  ref={canvasRef}
                  snapshot={snap}
                  yOverride={(() => {
                    if (autoscale) return null
                    const min = parseFloat(manualMinInput)
                    const max = parseFloat(manualMaxInput)
                    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max }
                    return null
                  })()} timeMode={timeMode}
                  onPanStart={() => {
                    store.stopMomentum()
                    if (!store.getFrozen()) {
                      store.setFrozen(true)
                    }
                  }}
                  onPanDelta={(delta) => {
                    store.adjustScrollPosition(delta)
                  }}
                  onPanEnd={(endV) => {
                    store.startMomentum(endV)
                  }}
                  onZoomFactor={(factor) => store.zoomByFactor(factor)}
                  showHoverTooltip={true}
                />
                {/* Tools overlay top-right */}
                <div className="absolute top-2 right-2 flex items-center gap-2 pointer-events-auto" ref={toolsRef}>
                  <Button size="sm" variant="neutral" aria-label={store.getFrozen() ? 'Play' : 'Pause'} title={store.getFrozen() ? 'Play' : 'Pause'} onClick={() => {
                    store.stopMomentum()
                    if (!store.getFrozen()) {
                      store.setFrozen(true)
                    } else {
                      store.setScrollPosition(0)
                      store.setFrozen(false)
                    }
                  }}>
                    {store.getFrozen() ? (
                      <PlayIcon className="w-5 h-5" />
                    ) : (
                      <PauseIcon className="w-5 h-5" />
                    )}
                  </Button>
                  <Button size="sm" variant="neutral" aria-label="Zoom in" title="Zoom in" onClick={() => store.zoomByFactor(1.25)}>
                    <MagnifyingGlassPlusIcon className="w-5 h-5" />
                  </Button>
                  <Button size="sm" variant="neutral" aria-label="Zoom out" title="Zoom out" onClick={() => store.zoomByFactor(0.8)}>
                    <MagnifyingGlassMinusIcon className="w-5 h-5" />
                  </Button>
                  <Button size="sm" variant="neutral" aria-label="Save PNG" title="Save PNG" onClick={async () => {
                    const node = plotContainerRef.current
                    if (!node) return
                    const bg = getComputedStyle(document.documentElement).getPropertyValue('--plot-bg') || '#fff'
                    const prevPadding = node.style.padding
                    const prevToolsVisibility = toolsRef.current?.style.visibility || ''
                    try {
                      node.style.padding = '12px'
                      if (toolsRef.current) toolsRef.current.style.visibility = 'hidden'
                      const dataUrl = await htmlToImage.toPng(node, {
                        pixelRatio: 2,
                        backgroundColor: bg.trim() || '#fff',
                      })
                      const a = document.createElement('a')
                      a.href = dataUrl
                      a.download = `plot-${Date.now()}.png`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                    } finally {
                      node.style.padding = prevPadding
                      if (toolsRef.current) toolsRef.current.style.visibility = prevToolsVisibility
                    }
                  }}>
                    <CameraIcon className="w-5 h-5" />
                  </Button>
                </div>
                {/* Legend overlay left if data present */}
                {snap.length > 0 && (
                  <div className="absolute top-2 left-2 pointer-events-auto">
                    <Legend />
                  </div>
                )}
                {snap.length === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs opacity-50">
                    Connect a device or start test to begin plotting…
                  </div>
                )}
              </div>
            )
          })()}
          <div
            className="cursor-row-resize bg-neutral-800 hover:bg-neutral-700 select-none touch-none"
            onPointerDown={startDragResize}
          />
          <div className="overflow-auto">
            {(() => {
              const snap = store.getCurrentWindow()
              if (snap.length === 0) return null
              const savePng = () => {
                const url = canvasRef.current?.exportPNG({ scale: 2, background: getComputedStyle(document.documentElement).getPropertyValue('--plot-bg') || '#fff' })
                if (!url) return
                const a = document.createElement('a')
                a.href = url
                a.download = `plot-${Date.now()}.png`
                document.body.appendChild(a)
                a.click()
                a.remove()
              }
              return <StatsPanel snapshot={snap} onScreenshot={savePng} />
            })()}
          </div>
        </div>
        {/* Removed old bottom screenshot button; use overlay or per-card actions */}
        {lastLine && (
          <div className="text-xs text-neutral-400 truncate">Last line: {lastLine}</div>
        )}
      </main>
      </div>
  )
}

export default App
