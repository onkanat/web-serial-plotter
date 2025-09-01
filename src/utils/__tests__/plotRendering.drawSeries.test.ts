import { describe, it, expect, vi } from 'vitest'
import { drawSeries } from '../plotRendering'

function makeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    rect: vi.fn(), clip: vi.fn(),
    canvas: document.createElement('canvas'),
  } as unknown as CanvasRenderingContext2D
}

describe('drawSeries', () => {
  it('skips NaN values and clips to chart', () => {
    const ctx = makeCtx()
    const chart = { x: 0, y: 0, width: 100, height: 50 }
    const snapshot = {
      series: [{ id: 0, name: 'S1', color: '#fff' }],
      getSeriesData: () => new Float32Array([0, NaN, 1, 2]),
      viewPortSize: 4,
    } as unknown as import('../../types/plot').PlotSnapshot
    drawSeries(ctx, chart, snapshot, -1, 3)
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 100, 50)
    expect(ctx.clip).toHaveBeenCalled()
    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })
})


