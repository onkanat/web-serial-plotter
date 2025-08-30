import { useCallback, useEffect, useRef, useState } from 'react'

export type GeneratorMode = 'sine3' | 'noise' | 'ramp'

export interface GeneratorConfig {
  mode: GeneratorMode
  channels: number
  sampleRateHz: number
  frequencyHz: number
  amplitude: number
  includeHeader: boolean
  channelNames: string[]
}

export interface UseSignalGenerator {
  isRunning: boolean
  config: GeneratorConfig
  setConfig: (next: Partial<GeneratorConfig>) => void
  start: () => void
  stop: () => void
}

export function useSignalGenerator(onEmitLine: (line: string) => void): UseSignalGenerator {
  const [isRunning, setIsRunning] = useState(false)
  const [config, setConfigState] = useState<GeneratorConfig>({
    mode: 'sine3',
    channels: 3,
    sampleRateHz: 100,
    frequencyHz: 1,
    amplitude: 1,
    includeHeader: true,
    channelNames: ['ch1', 'ch2', 'ch3', 'ch4'],
  })

  const tRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const headerSentRef = useRef(false)

  const setConfig = useCallback((next: Partial<GeneratorConfig>) => {
    setConfigState((prev) => ({ ...prev, ...next }))
  }, [])

  const stop = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRunning(false)
  }, [])

  const start = useCallback(() => {
    stop()
    headerSentRef.current = false
    setIsRunning(true)
    const dt = 1 / config.sampleRateHz
    timerRef.current = window.setInterval(() => {
      if (!headerSentRef.current && config.includeHeader) {
        const header = '# ' + config.channelNames.slice(0, config.channels).join(' ')
        onEmitLine(header)
        headerSentRef.current = true
      }

      const values: number[] = []
      const t = tRef.current
      for (let c = 0; c < config.channels; c++) {
        let v = 0
        if (config.mode === 'sine3') {
          const phase = (c / Math.max(1, config.channels)) * Math.PI * 2
          v = Math.sin(2 * Math.PI * config.frequencyHz * t + phase) * config.amplitude
        } else if (config.mode === 'noise') {
          v = (Math.random() * 2 - 1) * config.amplitude
        } else if (config.mode === 'ramp') {
          const period = 1 / Math.max(0.0001, config.frequencyHz)
          const frac = ((t % period) / period)
          v = (2 * frac - 1) * config.amplitude
        }
        values.push(v)
      }
      tRef.current = t + dt

      onEmitLine(values.join(','))
    }, Math.max(1, Math.round(1000 / config.sampleRateHz)))
  }, [config, onEmitLine, stop])

  useEffect(() => () => stop(), [stop])

  return { isRunning, config, setConfig, start, stop }
}


