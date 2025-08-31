import { describe, it, expect, beforeEach } from 'vitest'
import { RingStore } from '../RingStore'

describe('RingStore - Comprehensive Edge Case Testing', () => {
  let store: RingStore

  describe('Construction and Initialization', () => {
    it('should handle zero capacity', () => {
      const store = new RingStore(0, 2)
      expect(store.getCapacity()).toBe(0)
      expect(store.getLength()).toBe(0)
      store.append([1, 2])
      expect(store.getLength()).toBe(0) // Should not crash or grow
    })

    it('should handle single capacity', () => {
      const store = new RingStore(1, 2)
      store.append([1, 2])
      store.append([3, 4])
      expect(store.getLength()).toBe(1)
      expect(store.getTotal()).toBe(2)
      
      const window = store.getWindow({ startFromNewest: 0, length: 1 })
      expect(window.getSeriesData(0)[0]).toBe(3) // Should have newest value
    })

    it('should handle zero series count', () => {
      const store = new RingStore(10, 0)
      store.append([]) // Empty array
      expect(store.getLength()).toBe(1)
      expect(store.getSeries()).toHaveLength(0)
    })
  })

  describe('Append Edge Cases', () => {
    beforeEach(() => {
      store = new RingStore(4, 3)
    })

    it('should handle mismatched value count', () => {
      store.append([1, 2, 3])
      expect(store.getLength()).toBe(1)
      
      // Too few values - should be ignored
      store.append([4, 5])
      expect(store.getLength()).toBe(1) // Should not append
      
      // Too many values - should be ignored  
      store.append([6, 7, 8, 9])
      expect(store.getLength()).toBe(1) // Should not append
    })

    it('should handle extreme numeric values', () => {
      store.append([Number.MAX_VALUE, Number.MIN_VALUE, Infinity])
      store.append([-Infinity, NaN, 0])
      
      const window = store.getWindow({ startFromNewest: 0, length: 2 })
      expect(window.yMin).not.toBeNaN()
      expect(window.yMax).not.toBeNaN()
      expect(Number.isFinite(window.yMin)).toBe(true)
      expect(Number.isFinite(window.yMax)).toBe(true)
    })

    it('should handle identical values edge case in yMin/yMax', () => {
      store.append([5, 5, 5])
      store.append([5, 5, 5])
      
      const window = store.getWindow({ startFromNewest: 0, length: 2 })
      expect(window.yMin).toBeLessThan(window.yMax) // Should add padding
      expect(window.yMax - window.yMin).toBeGreaterThan(0)
    })
  })

  describe('Ring Buffer Wraparound Edge Cases', () => {
    beforeEach(() => {
      store = new RingStore(3, 2) // Small buffer to test wraparound quickly
    })

    it('should handle window at exact wraparound boundary', () => {
      // Fill buffer to capacity
      store.append([1, 10])
      store.append([2, 20]) 
      store.append([3, 30])
      expect(store.getLength()).toBe(3)
      
      // Cause wraparound
      store.append([4, 40])
      expect(store.getLength()).toBe(3) // Still at capacity
      expect(store.getTotal()).toBe(4)
      
      // Request window that spans wraparound
      const window = store.getWindow({ startFromNewest: 0, length: 3 })
      const s0 = Array.from(window.getSeriesData(0))
      const s1 = Array.from(window.getSeriesData(1))
      
      // Should get [2,3,4] and [20,30,40] (oldest value [1,10] should be overwritten)
      expect(s0).toEqual([2, 3, 4])
      expect(s1).toEqual([20, 30, 40])
    })

    it('should handle single-element window after wraparound', () => {
      store.append([1, 10])
      store.append([2, 20])
      store.append([3, 30])
      store.append([4, 40]) // Wraparound
      
      const window = store.getWindow({ startFromNewest: 2, length: 1 })
      expect(window.length).toBe(1)
      const s0 = Array.from(window.getSeriesData(0))
      expect(s0.length).toBeGreaterThan(0) // Should not crash and return valid data
      expect(Number.isFinite(s0[0])).toBe(true) // Should contain valid numbers
    })

    it('should handle window larger than available data', () => {
      store.append([1, 10])
      store.append([2, 20])
      
      const window = store.getWindow({ startFromNewest: 0, length: 10 })
      expect(window.length).toBe(10) // Returns requested length with padding
    })

    it('should handle startFromNewest beyond available data', () => {
      store.append([1, 10])
      store.append([2, 20])
      
      const window = store.getWindow({ startFromNewest: 5, length: 1 })
      expect(window.length).toBe(1) // Returns requested length with padding
    })
  })

  describe('SetMaxHistory Edge Cases', () => {
    it('should handle capacity increase correctly', () => {
      store = new RingStore(2, 2)
      store.append([1, 10])
      store.append([2, 20])
      
      // Increase capacity
      store.setMaxHistory(5)
      expect(store.getCapacity()).toBe(5)
      expect(store.getLength()).toBe(2)
      
      const window = store.getWindow({ startFromNewest: 0, length: 2 })
      const s0 = Array.from(window.getSeriesData(0))
      expect(s0).toEqual([1, 2]) // Data should be preserved
    })

    it('should handle capacity decrease after wraparound', () => {
      store = new RingStore(5, 2)
      // Fill beyond new capacity
      store.append([1, 10])
      store.append([2, 20])
      store.append([3, 30])
      store.append([4, 40])
      store.append([5, 50])
      
      // Decrease capacity to 3 - should keep most recent 3 values
      store.setMaxHistory(3)
      expect(store.getCapacity()).toBe(3)
      expect(store.getLength()).toBe(3)
      
      const window = store.getWindow({ startFromNewest: 0, length: 3 })
      const s0 = Array.from(window.getSeriesData(0))
      expect(s0).toEqual([3, 4, 5]) // Should keep newest values
    })

    it('should handle capacity decrease to 1', () => {
      store = new RingStore(5, 2)
      store.append([1, 10])
      store.append([2, 20])
      store.append([3, 30])
      
      store.setMaxHistory(1)
      expect(store.getLength()).toBe(1)
      
      const window = store.getWindow({ startFromNewest: 0, length: 1 })
      const s0 = Array.from(window.getSeriesData(0))
      expect(s0).toEqual([3]) // Should keep only newest
    })

    it('should handle capacity decrease to 0', () => {
      store = new RingStore(5, 2)
      store.append([1, 10])
      store.append([2, 20])
      
      store.setMaxHistory(0)
      expect(store.getCapacity()).toBe(0)
      expect(store.getLength()).toBe(0)
      
      const window = store.getWindow({ startFromNewest: 0, length: 1 })
      expect(window.length).toBe(1) // Returns requested length even with no data
    })
  })

  describe('Anchor System Edge Cases', () => {
    beforeEach(() => {
      store = new RingStore(10, 1)
    })

    it('should handle anchor creation with stride 1', () => {
      store.setAnchorEveryFromWindow(5) // Should create anchor every 1 sample
      
      store.append([1])
      store.append([2])
      store.append([3])
      
      const window = store.getWindow({ startFromNewest: 0, length: 3 })
      expect(window.anchors.length).toBeGreaterThan(0)
    })

    it('should handle anchor trimming after capacity reduction', () => {
      // Create many samples with anchors
      store.setAnchorEveryFromWindow(2) // Anchor every sample for small window
      for (let i = 0; i < 10; i++) {
        store.append([i])
      }
      
      // Reduce capacity significantly
      store.setMaxHistory(3)
      
      const window = store.getWindow({ startFromNewest: 0, length: 3 })
      // All anchors should be valid for the remaining data
      for (const anchor of window.anchors) {
        expect(anchor.total).toBeGreaterThanOrEqual(window.windowStartTotal)
        expect(anchor.total).toBeLessThanOrEqual(store.getTotal() - 1)
      }
    })

    it('should handle recompute anchors with empty store', () => {
      store.setAnchorEveryFromWindow(5)
      const window = store.getWindow({ startFromNewest: 0, length: 1 })
      expect(window.anchors).toEqual([])
    })
  })

  describe('Window Calculation Edge Cases', () => {
    beforeEach(() => {
      store = new RingStore(4, 2)
      // Add some test data
      store.append([1, 10])
      store.append([2, 20])
      store.append([3, 30])
      store.append([4, 40])
    })

    it('should handle zero-length window request', () => {
      const window = store.getWindow({ startFromNewest: 0, length: 0 })
      expect(window.length).toBe(0)
      expect(window.getSeriesData(0)).toHaveLength(0)
      expect(window.getTimes()).toHaveLength(0)
    })

    it('should handle negative startFromNewest', () => {
      const window = store.getWindow({ startFromNewest: -5, length: 2 })
      expect(window.length).toBe(2) // Should clamp to valid range
    })

    it('should handle negative window length', () => {
      const window = store.getWindow({ startFromNewest: 0, length: -5 })
      expect(window.length).toBe(0) // Negative length clamped to 0
    })

    it('should handle extremely large window request', () => {
      const window = store.getWindow({ startFromNewest: 0, length: Number.MAX_SAFE_INTEGER })
      expect(window.length).toBe(1e7) // Clamped to reasonable upper bound
    })

    it('should handle window request from empty store', () => {
      const emptyStore = new RingStore(5, 2)
      const window = emptyStore.getWindow({ startFromNewest: 0, length: 3 })
      expect(window.length).toBe(3) // Returns requested length with padding
      expect(window.yMin).toBe(-1) // Should use fallback values
      expect(window.yMax).toBe(1)
    })
  })

  describe('Series Management Edge Cases', () => {
    beforeEach(() => {
      store = new RingStore(5, 3)
    })

    it('should handle setSeries with empty names array', () => {
      store.append([1, 2, 3])
      store.setSeries([])
      expect(store.getSeries()).toHaveLength(0)
      expect(store.getLength()).toBe(0) // Should reset data
    })

    it('should handle setSeries with more series than before', () => {
      store.append([1, 2, 3])
      store.setSeries(['a', 'b', 'c', 'd', 'e']) // More than original 3
      expect(store.getSeries()).toHaveLength(5)
      expect(store.getLength()).toBe(0) // Should reset data
    })

    it('should handle setSeries with fewer series than before', () => {
      store.append([1, 2, 3])
      store.setSeries(['a']) // Fewer than original 3
      expect(store.getSeries()).toHaveLength(1)
      expect(store.getLength()).toBe(0) // Should reset data
    })

    it('should handle renameSeries with invalid id', () => {
      store.setSeries(['a', 'b'])
      store.renameSeries(999, 'invalid') // Non-existent ID
      expect(store.getSeries()[0].name).toBe('a') // Should not change
    })

    it('should handle setSeriesColor with invalid id', () => {
      store.setSeries(['a', 'b'])
      const originalColor = store.getSeries()[0].color
      store.setSeriesColor(999, '#ff0000') // Non-existent ID
      expect(store.getSeries()[0].color).toBe(originalColor) // Should not change
    })
  })

  describe('Ring Buffer Math Validation', () => {
    it('should maintain correct order after multiple wraparounds', () => {
      store = new RingStore(3, 1)
      
      // Add enough data to wrap around multiple times
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      values.forEach(v => store.append([v]))
      
      expect(store.getTotal()).toBe(10)
      expect(store.getLength()).toBe(3) // Capacity limit
      
      // Get full window - should have newest 3 values in correct order
      const window = store.getWindow({ startFromNewest: 0, length: 3 })
      const data = Array.from(window.getSeriesData(0))
      expect(data).toEqual([8, 9, 10]) // Newest 3 in chronological order
    })

    it('should handle ring index calculation at boundaries', () => {
      store = new RingStore(4, 1)
      
      // Fill to exactly capacity
      store.append([1])
      store.append([2])
      store.append([3])
      store.append([4])
      expect(store.getLength()).toBe(4)
      
      // Add one more to trigger wraparound
      store.append([5])
      expect(store.getLength()).toBe(4)
      
      // Test various window positions around the wraparound
      const fullWindow = store.getWindow({ startFromNewest: 0, length: 4 })
      expect(Array.from(fullWindow.getSeriesData(0))).toEqual([2, 3, 4, 5])
      
      const partialWindow = store.getWindow({ startFromNewest: 1, length: 2 })
      const partialData = Array.from(partialWindow.getSeriesData(0))
      expect(partialData.length).toBeGreaterThan(0) // Should return valid data
      expect(partialData.every(v => Number.isFinite(v))).toBe(true) // All values should be finite
    })

    it('should validate windowStartTotal calculation', () => {
      store = new RingStore(3, 1)
      store.append([1])
      store.append([2])
      store.append([3])
      store.append([4]) // total=4, length=3, newest values=[2,3,4]
      
      const window = store.getWindow({ startFromNewest: 1, length: 2 })
      // newestTotal = 4-1 = 3
      // windowStartTotal = 3 - (2-1) - 1 = 1
      expect(window.windowStartTotal).toBe(1)
      const windowData = Array.from(window.getSeriesData(0))
      expect(windowData.length).toBeGreaterThan(0) // Should return valid data
      expect(windowData.every(v => Number.isFinite(v))).toBe(true) // All values should be finite
    })
  })

  describe('Times Array Handling', () => {
    beforeEach(() => {
      store = new RingStore(3, 1)
    })

    it('should handle time extraction across wraparound', () => {
      store.append([1])
      store.append([2])
      store.append([3])
      const time3 = Date.now()
      store.append([4]) // Wraparound
      
      const window = store.getWindow({ startFromNewest: 0, length: 3 })
      const times = window.getTimes()
      
      expect(times).toHaveLength(3)
      // Times should be in chronological order (oldest to newest in window)
      expect(times[0]).toBeLessThanOrEqual(times[1])
      expect(times[1]).toBeLessThanOrEqual(times[2])
      expect(times[2]).toBeGreaterThanOrEqual(time3 - 100) // Recent time
    })

    it('should handle times for zero-length window', () => {
      store.append([1])
      const window = store.getWindow({ startFromNewest: 0, length: 0 })
      const times = window.getTimes()
      expect(times).toHaveLength(0)
    })
  })

  describe('Y-Axis Bounds Edge Cases', () => {
    beforeEach(() => {
      store = new RingStore(5, 2)
    })

    it('should handle all-zero values', () => {
      store.append([0, 0])
      store.append([0, 0])
      
      const window = store.getWindow({ startFromNewest: 0, length: 2 })
      expect(window.yMin).toBeLessThan(0) // Should add negative padding
      expect(window.yMax).toBeGreaterThan(0) // Should add positive padding
    })

    it('should handle very small values near zero', () => {
      const tiny = 1e-10
      store.append([tiny, -tiny])
      store.append([tiny * 2, -tiny * 2])
      
      const window = store.getWindow({ startFromNewest: 0, length: 2 })
      expect(window.yMax - window.yMin).toBeGreaterThan(0)
      expect(Number.isFinite(window.yMin)).toBe(true)
      expect(Number.isFinite(window.yMax)).toBe(true)
    })

    it('should handle mixed finite and infinite values', () => {
      store.append([1, Infinity])
      store.append([2, -Infinity])
      store.append([3, NaN])
      
      const window = store.getWindow({ startFromNewest: 0, length: 3 })
      // Should fall back to safe bounds when non-finite values present
      expect(Number.isFinite(window.yMin)).toBe(true)
      expect(Number.isFinite(window.yMax)).toBe(true)
    })
  })

  describe('Anchor System Stress Tests', () => {
    it('should handle rapid anchor stride changes', () => {
      store = new RingStore(100, 1)
      
      // Add data with one stride
      store.setAnchorEveryFromWindow(10)
      for (let i = 0; i < 50; i++) {
        store.append([i])
      }
      
      // Change stride dramatically
      store.setAnchorEveryFromWindow(2)
      
      // Add more data
      for (let i = 50; i < 100; i++) {
        store.append([i])
      }
      
      const window = store.getWindow({ startFromNewest: 0, length: 50 })
      // Should have valid anchors despite stride changes
      expect(window.anchors.length).toBeGreaterThan(0)
      
      // All anchors should be in valid range
      for (const anchor of window.anchors) {
        expect(anchor.total).toBeGreaterThanOrEqual(window.windowStartTotal)
        expect(anchor.total).toBeLessThanOrEqual(store.getTotal() - 1)
      }
    })

    it('should handle anchor creation with zero-capacity store', () => {
      store = new RingStore(0, 1)
      store.setAnchorEveryFromWindow(5)
      store.append([1]) // Should be ignored due to zero capacity
      
      const window = store.getWindow({ startFromNewest: 0, length: 1 })
      expect(window.anchors).toEqual([])
    })
  })

  describe('Concurrent Access Patterns', () => {
    it('should handle rapid append during window requests', () => {
      store = new RingStore(10, 2)
      
      // Simulate rapid data append
      for (let i = 0; i < 5; i++) {
        store.append([i, i * 10])
      }
      
      const window1 = store.getWindow({ startFromNewest: 0, length: 3 })
      
      // Add more data
      store.append([5, 50])
      store.append([6, 60])
      
      const window2 = store.getWindow({ startFromNewest: 0, length: 3 })
      
      // Windows should be consistent with their respective snapshots
      expect(window1.length).toBe(3)
      expect(window2.length).toBe(3)
      const window2Data = Array.from(window2.getSeriesData(0))
      expect(window2Data.length).toBe(3) // Should maintain window length
      expect(window2Data.every(v => Number.isFinite(v))).toBe(true) // All values should be finite
      expect(window2Data.includes(6)).toBe(true) // Should include recent data
    })
  })

  describe('Series Data Access Edge Cases', () => {
    beforeEach(() => {
      store = new RingStore(5, 3)
      store.append([1, 2, 3])
      store.append([4, 5, 6])
    })

    it('should handle getSeriesData with invalid series id', () => {
      const window = store.getWindow({ startFromNewest: 0, length: 2 })
      const invalidSeries = window.getSeriesData(999)
      expect(invalidSeries).toHaveLength(0)
      expect(invalidSeries).toBeInstanceOf(Float32Array)
    })

    it('should handle getSeriesData with negative series id', () => {
      const window = store.getWindow({ startFromNewest: 0, length: 2 })
      const invalidSeries = window.getSeriesData(-1)
      expect(invalidSeries).toHaveLength(0)
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large capacity without throwing', () => {
      // Test with large but reasonable capacity
      const largeStore = new RingStore(100000, 1)
      expect(largeStore.getCapacity()).toBe(100000)
      
      // Should handle append without issues
      largeStore.append([42])
      expect(largeStore.getLength()).toBe(1)
    })

    it('should handle rapid series count changes', () => {
      store = new RingStore(10, 1)
      store.append([1])
      
      // Rapidly change series count
      store.setSeries(['a', 'b', 'c', 'd', 'e'])
      store.setSeries(['x'])
      store.setSeries(['p', 'q', 'r'])
      
      // Should not crash and should be in consistent state
      expect(store.getSeries()).toHaveLength(3)
      expect(store.getLength()).toBe(0) // Data reset by setSeries
    })
  })
})