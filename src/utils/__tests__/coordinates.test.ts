import { describe, it, expect } from 'vitest'
import {
  calculateDataPosition,
  calculateScrollBounds,
  clampScroll,
  calculateZoomCenter,
  calculateZoomScroll,
  type CoordinateParams,
} from '../coordinates'

describe('Coordinate Transformation Utilities', () => {
  describe('calculateDataPosition', () => {
    it('should handle basic frozen state', () => {
      const params: CoordinateParams = { uiStart: 10, delta: 5, frozen: true }
      expect(calculateDataPosition(params)).toBe(15) // uiStart + delta
    })

    it('should ignore delta when not frozen', () => {
      const params: CoordinateParams = { uiStart: 10, delta: 5, frozen: false }
      expect(calculateDataPosition(params)).toBe(10) // uiStart only
    })

    it('should handle negative uiStart with delta', () => {
      const params: CoordinateParams = { uiStart: -10, delta: 15, frozen: true }
      expect(calculateDataPosition(params)).toBe(5) // Math.max(0, -10 + 15)
    })

    it('should handle negative result', () => {
      const params: CoordinateParams = { uiStart: -20, delta: 5, frozen: true }
      expect(calculateDataPosition(params)).toBe(0) // Should clamp to 0
    })

    it('should handle zero values', () => {
      const params: CoordinateParams = { uiStart: 0, delta: 0, frozen: true }
      expect(calculateDataPosition(params)).toBe(0)
    })

    it('should handle extreme values', () => {
      const params: CoordinateParams = { 
        uiStart: Number.MAX_SAFE_INTEGER, 
        delta: Number.MAX_SAFE_INTEGER, 
        frozen: true 
      }
      // Should not overflow or return NaN
      const result = calculateDataPosition(params)
      expect(Number.isFinite(result)).toBe(true)
      expect(result).toBeGreaterThanOrEqual(0)
    })
  })

  describe('calculateScrollBounds', () => {
    it('should handle normal case', () => {
      const bounds = calculateScrollBounds(100, 20, 5, false)
      expect(bounds.min).toBe(0) // Not frozen
      expect(bounds.max).toBe(80) // 100 - 20
    })

    it('should handle frozen state with negative min bound', () => {
      const bounds = calculateScrollBounds(100, 20, 30, true)
      expect(bounds.min).toBe(-30) // Frozen allows negative scroll
      expect(bounds.max).toBe(80)
    })

    it('should handle window larger than data', () => {
      const bounds = calculateScrollBounds(10, 50, 5, false)
      expect(bounds.min).toBe(0)
      expect(bounds.max).toBe(0) // Math.max(0, 10 - 50)
    })

    it('should handle zero data length', () => {
      const bounds = calculateScrollBounds(0, 10, 5, true)
      expect(bounds.min).toBe(-5)
      expect(bounds.max).toBe(0) // Math.max(0, 0 - 10)
    })

    it('should handle negative inputs', () => {
      const bounds = calculateScrollBounds(-10, 5, 3, false)
      expect(bounds.min).toBe(0)
      expect(bounds.max).toBe(0) // Math.max(0, -10 - 5)
    })

    it('should handle zero window length', () => {
      const bounds = calculateScrollBounds(100, 0, 10, true)
      expect(bounds.min).toBe(-10)
      expect(bounds.max).toBe(100) // 100 - 0
    })
  })

  describe('clampScroll', () => {
    it('should clamp value within bounds', () => {
      const bounds = { min: -10, max: 50 }
      expect(clampScroll(25, bounds)).toBe(25) // Within bounds
      expect(clampScroll(-20, bounds)).toBe(-10) // Below min
      expect(clampScroll(100, bounds)).toBe(50) // Above max
    })

    it('should handle inverted bounds', () => {
      const bounds = { min: 50, max: 10 } // Invalid bounds
      expect(clampScroll(25, bounds)).toBe(50) // Should clamp to min (higher value)
    })

    it('should handle equal min/max bounds', () => {
      const bounds = { min: 10, max: 10 }
      expect(clampScroll(5, bounds)).toBe(10)
      expect(clampScroll(15, bounds)).toBe(10)
      expect(clampScroll(10, bounds)).toBe(10)
    })

    it('should handle extreme values', () => {
      const bounds = { min: -1000, max: 1000 }
      expect(clampScroll(Number.NEGATIVE_INFINITY, bounds)).toBe(-1000)
      expect(clampScroll(Number.POSITIVE_INFINITY, bounds)).toBe(1000)
      expect(clampScroll(NaN, bounds)).toBeNaN() // NaN comparisons should preserve NaN
    })
  })

  describe('calculateZoomCenter', () => {
    it('should calculate center correctly for normal case', () => {
      const center = calculateZoomCenter(10, 20, 5, true)
      // startFromNewest = Math.max(0, 10 + 5) = 15
      // center = 15 + Math.floor(20/2) = 15 + 10 = 25
      expect(center).toBe(25)
    })

    it('should handle odd window length', () => {
      const center = calculateZoomCenter(0, 21, 0, false)
      // startFromNewest = Math.max(0, 0 + 0) = 0  
      // center = 0 + Math.floor(21/2) = 0 + 10 = 10
      expect(center).toBe(10)
    })

    it('should handle single-element window', () => {
      const center = calculateZoomCenter(5, 1, 2, true)
      // startFromNewest = Math.max(0, 5 + 2) = 7
      // center = 7 + Math.floor(1/2) = 7 + 0 = 7
      expect(center).toBe(7)
    })

    it('should handle zero window length', () => {
      const center = calculateZoomCenter(10, 0, 5, true)
      // center = startFromNewest + Math.floor(0/2) = 15 + 0 = 15
      expect(center).toBe(15)
    })

    it('should handle negative uiStart', () => {
      const center = calculateZoomCenter(-10, 20, 5, true)
      // startFromNewest = Math.max(0, -10 + 5) = Math.max(0, -5) = 0
      // center = 0 + 10 = 10
      expect(center).toBe(10)
    })
  })

  describe('calculateZoomScroll', () => {
    it('should maintain center during zoom', () => {
      const scroll = calculateZoomScroll(50, 20, 10, 100, true)
      // newStartFromNewest = Math.max(0, 50 - Math.floor(20/2)) = Math.max(0, 40) = 40
      // newUiStart = 40 - 10 = 30
      // bounds = { min: -10, max: 80 } (frozen allows negative)
      // result = clamp(30, bounds) = 30
      expect(scroll).toBe(30)
    })

    it('should handle zoom center at beginning', () => {
      const scroll = calculateZoomScroll(5, 10, 0, 50, false)
      // newStartFromNewest = Math.max(0, 5 - 5) = 0
      // newUiStart = 0 - 0 = 0
      // bounds = { min: 0, max: 40 }
      // result = 0
      expect(scroll).toBe(0)
    })

    it('should handle zoom that would go negative', () => {
      const scroll = calculateZoomScroll(3, 20, 0, 50, false)
      // newStartFromNewest = Math.max(0, 3 - 10) = 0 (clamped)
      // newUiStart = 0 - 0 = 0
      expect(scroll).toBe(0)
    })

    it('should handle zoom beyond data bounds', () => {
      const scroll = calculateZoomScroll(200, 50, 10, 100, true)
      // newStartFromNewest = Math.max(0, 200 - 25) = 175
      // newUiStart = 175 - 10 = 165
      // bounds = { min: -10, max: 50 } (100 - 50)
      // result = clamp(165, bounds) = 50 (max)
      expect(scroll).toBe(50)
    })

    it('should handle frozen state allowing negative scroll', () => {
      const scroll = calculateZoomScroll(5, 30, 20, 100, true)
      // newStartFromNewest = Math.max(0, 5 - 15) = 0
      // newUiStart = 0 - 20 = -20
      // bounds = { min: -20, max: 70 }
      // result = clamp(-20, bounds) = -20
      expect(scroll).toBe(-20)
    })

    it('should handle extreme zoom factors', () => {
      // Very large window (zoom out extreme)
      const scroll1 = calculateZoomScroll(50, 1000000, 0, 100, false)
      expect(Number.isFinite(scroll1)).toBe(true)
      
      // Very small window (zoom in extreme)  
      const scroll2 = calculateZoomScroll(50, 1, 0, 100, false)
      expect(Number.isFinite(scroll2)).toBe(true)
    })
  })

  describe('Edge Case Combinations', () => {
    it('should handle all-zero coordinate system', () => {
      const pos = calculateDataPosition({ uiStart: 0, delta: 0, frozen: true })
      const bounds = calculateScrollBounds(0, 0, 0, true)
      const center = calculateZoomCenter(0, 0, 0, false)
      const scroll = calculateZoomScroll(0, 0, 0, 0, false)
      
      expect(pos).toBe(0)
      expect(bounds.min).toBe(0)
      expect(bounds.max).toBe(0)
      expect(center).toBe(0)
      expect(scroll).toBe(0)
    })

    it('should handle frozen->unfrozen transition edge case', () => {
      // Scenario: User was frozen with negative scroll, then unfreezes
      const frozenBounds = calculateScrollBounds(100, 20, 30, true)
      const unfrozenBounds = calculateScrollBounds(100, 20, 30, false)
      
      expect(frozenBounds.min).toBe(-30)
      expect(unfrozenBounds.min).toBe(0)
      
      // A scroll position valid while frozen might be invalid when unfrozen
      const frozenScroll = -15
      const clampedUnfrozen = clampScroll(frozenScroll, unfrozenBounds)
      expect(clampedUnfrozen).toBe(0) // Should clamp to valid range
    })
  })
})