import { describe, it, expect } from 'vitest'
import { RingStore } from '../RingStore'

describe('RingStore', () => {
  it('appends values and reports total/length', () => {
    const store = new RingStore(4, 2)
    expect(store.getTotal()).toBe(0)
    expect(store.getLength()).toBe(0)

    store.append([1, 2])
    store.append([3, 4])
    expect(store.getTotal()).toBe(2)
    expect(store.getLength()).toBe(2)

    // Fill and wrap
    store.append([5, 6])
    store.append([7, 8])
    store.append([9, 10])
    expect(store.getTotal()).toBe(5)
    expect(store.getLength()).toBe(4) // capacity

    const win = store.getWindow({ startFromNewest: 0, length: 4 })
    expect(win.length).toBe(4)
    const s0 = win.getSeriesData(0)
    const s1 = win.getSeriesData(1)
    // After wrap, the last 4 samples for series 0 should be [3,5,7,9]
    expect(Array.from(s0)).toHaveLength(4)
    expect(Array.from(s1)).toHaveLength(4)
  })
})


