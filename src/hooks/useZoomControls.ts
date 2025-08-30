import { useCallback } from 'react'
import { calculateZoomCenter, calculateZoomScroll } from '../utils/coordinates'
import type { RingStore } from '../store/RingStore'

interface UseZoomControlsParams {
  store: RingStore
  frozen: boolean
  freezeBaseTotalRef: React.MutableRefObject<number>
  scrollOffsetInput: string
  setScrollOffsetInput: (value: string | ((prev: string) => string)) => void
  setWindowSizeInput: (value: string | ((prev: string) => string)) => void
  stopMomentum: () => void
}

export function useZoomControls({
  store,
  frozen,
  freezeBaseTotalRef,
  scrollOffsetInput,
  setScrollOffsetInput,
  setWindowSizeInput,
  stopMomentum,
}: UseZoomControlsParams) {
  
  const zoomByFactor = useCallback((factor: number) => {
    stopMomentum()
    
    setWindowSizeInput((prev) => {
      const currentLen = Math.max(1, Math.floor(Number(prev) || 0))
      const desired = Math.round(currentLen / Math.max(0.5, Math.min(2, factor)))
      const dataLength = store.getLength()
      const newWindowLength = Math.max(10, Math.min(dataLength, desired))
      
      // Calculate coordinates for maintaining center during zoom
      const uiStart = Math.floor(Number(scrollOffsetInput) || 0)
      const delta = frozen ? Math.max(0, store.getTotal() - freezeBaseTotalRef.current) : 0
      const centerFromNewest = calculateZoomCenter(uiStart, currentLen, delta, frozen)
      
      // Update scroll position to maintain center
      const newScroll = calculateZoomScroll(
        centerFromNewest,
        newWindowLength,
        delta,
        dataLength,
        frozen
      )
      setScrollOffsetInput(String(newScroll))
      
      return String(newWindowLength)
    })
  }, [
    store,
    frozen,
    freezeBaseTotalRef,
    scrollOffsetInput,
    setScrollOffsetInput,
    setWindowSizeInput,
    stopMomentum,
  ])

  const zoomIn = useCallback(() => {
    zoomByFactor(1.25)
  }, [zoomByFactor])

  const zoomOut = useCallback(() => {
    zoomByFactor(0.8)
  }, [zoomByFactor])

  return {
    zoomByFactor,
    zoomIn,
    zoomOut,
  }
}