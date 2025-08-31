/**
 * Utility functions for coordinate transformations between UI and data space.
 * These help manage the complex relationship between scroll positions, freeze states,
 * and data indices in the ring buffer.
 */

export interface CoordinateParams {
  uiStart: number
  delta: number
  frozen: boolean
}

export interface ScrollBounds {
  min: number
  max: number
}

/**
 * Converts UI scroll position to data space position considering freeze state.
 */
export function calculateDataPosition(params: CoordinateParams): number {
  const { uiStart, delta, frozen } = params
  return Math.max(0, uiStart + (frozen ? delta : 0))
}

/**
 * Calculates valid scroll bounds considering data length and freeze state.
 */
export function calculateScrollBounds(
  dataLength: number,
  windowLength: number,
  delta: number,
  frozen: boolean
): ScrollBounds {
  const maxScroll = Math.max(0, dataLength - windowLength)
  const minScroll = frozen ? (-delta === 0 ? 0 : -delta) : 0
  return { min: minScroll, max: maxScroll }
}

/**
 * Clamps a scroll value to valid bounds.
 */
export function clampScroll(value: number, bounds: ScrollBounds): number {
  return Math.max(bounds.min, Math.min(bounds.max, value))
}

/**
 * Calculates the center position for zoom operations.
 */
export function calculateZoomCenter(
  uiStart: number,
  windowLength: number,
  delta: number,
  frozen: boolean
): number {
  const startFromNewest = calculateDataPosition({ uiStart, delta, frozen })
  return startFromNewest + Math.floor(windowLength / 2)
}

/**
 * Calculates new scroll position after zoom to maintain center point.
 */
export function calculateZoomScroll(
  centerFromNewest: number,
  newWindowLength: number,
  delta: number,
  dataLength: number,
  frozen: boolean
): number {
  const newStartFromNewest = Math.max(0, centerFromNewest - Math.floor(newWindowLength / 2))
  const newUiStart = newStartFromNewest - (frozen ? delta : 0)
  const bounds = calculateScrollBounds(dataLength, newWindowLength, delta, frozen)
  return clampScroll(newUiStart, bounds)
}