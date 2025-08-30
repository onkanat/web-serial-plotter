import { useCallback, useRef } from 'react'
import { calculateScrollBounds, clampScroll } from '../utils/coordinates'
import type { RingStore } from '../store/RingStore'

interface UseMomentumScrollingParams {
  store: RingStore
  frozen: boolean
  freezeBaseTotalRef: React.MutableRefObject<number>
  windowSizeInput: string
  setScrollOffsetInput: (value: string | ((prev: string) => string)) => void
}

/**
 * Hook for handling momentum-based scrolling with physics simulation.
 * Provides smooth deceleration after pan gestures end.
 */
export function useMomentumScrolling({
  store,
  frozen,
  freezeBaseTotalRef,
  windowSizeInput,
  setScrollOffsetInput,
}: UseMomentumScrollingParams) {
  
  // Physics state
  const velocityRef = useRef(0) // samples per ms
  const lastPanTsRef = useRef(0)
  const momentumIdRef = useRef<number | null>(null)

  const stopMomentum = useCallback(() => {
    if (momentumIdRef.current != null) {
      cancelAnimationFrame(momentumIdRef.current)
      momentumIdRef.current = null
    }
    velocityRef.current = 0
    lastPanTsRef.current = 0
  }, [])

  const startMomentum = useCallback(() => {
    if (Math.abs(velocityRef.current) < 0.005) return

    const step = (ts: number) => {
      const last = lastPanTsRef.current || ts
      const dt = Math.max(1, ts - last)
      lastPanTsRef.current = ts
      
      // Exponential decay friction (~0.95 per 16.7ms)
      velocityRef.current *= Math.pow(0.95, dt / 16.7)
      const velocity = velocityRef.current
      
      if (Math.abs(velocity) < 0.005) {
        stopMomentum()
        return
      }

      // Apply momentum to scroll position
      setScrollOffsetInput((prev) => {
        const current = Math.floor(Number(prev) || 0)
        const nextRaw = current + velocity * dt
        const windowLength = Math.max(1, Math.floor(Number(windowSizeInput) || 0))
        const dataLength = store.getLength()
        const deltaSinceFreeze = frozen 
          ? Math.max(0, store.getTotal() - freezeBaseTotalRef.current) 
          : 0
        
        const bounds = calculateScrollBounds(dataLength, windowLength, deltaSinceFreeze, frozen)
        const next = clampScroll(Math.round(nextRaw), bounds)
        return String(next)
      })
      
      momentumIdRef.current = requestAnimationFrame(step)
    }
    
    lastPanTsRef.current = performance.now()
    momentumIdRef.current = requestAnimationFrame(step)
  }, [store, frozen, freezeBaseTotalRef, windowSizeInput, setScrollOffsetInput, stopMomentum])

  const updateVelocity = useCallback((deltaSamples: number, timestamp: number) => {
    const now = timestamp
    const dt = Math.max(1, now - (lastPanTsRef.current || now))
    lastPanTsRef.current = now
    const instantVelocity = deltaSamples / dt
    // Smooth velocity with exponential moving average
    velocityRef.current = 0.8 * velocityRef.current + 0.2 * instantVelocity
  }, [])

  const setVelocity = useCallback((velocity: number) => {
    const capped = Math.max(-1, Math.min(1, velocity))
    velocityRef.current = capped
    lastPanTsRef.current = performance.now()
  }, [])

  return {
    stopMomentum,
    startMomentum,
    updateVelocity,
    setVelocity,
  }
}