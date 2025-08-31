/* @vitest-environment jsdom */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { usePlotData } from '../usePlotData'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'

describe('usePlotData snapshot', () => {
  it('joins ring buffer when full and computes y-range with padding when flat', () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    let api: ReturnType<typeof usePlotData> | null = null
    function Test() {
      api = usePlotData(4)
      return null
    }
    act(() => {
      root.render(React.createElement(Test))
    })
    // Now drive the hook via api
    act(() => {
      api!.reset()
      api!.pushLine('1 1')
      api!.pushLine('2 2')
      api!.pushLine('3 3')
      api!.pushLine('4 4')
      api!.pushLine('5 5')
    })
    const snap = api!.snapshot()
    const d0 = snap.getSeriesData(0)
    const d1 = snap.getSeriesData(1)
    expect(Array.from(d0)).toEqual([2,3,4,5])
    expect(Array.from(d1)).toEqual([2,3,4,5])
    expect(snap.yMin).toBeLessThanOrEqual(2)
    expect(snap.yMax).toBeGreaterThanOrEqual(5)
    act(() => {
      root.unmount()
    })
  })
})


