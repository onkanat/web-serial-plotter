import type { PlotSnapshot } from '../types/plot'

/**
 * Utility functions for plot canvas rendering.
 * Breaks down the complex draw() function into focused, testable pieces.
 */

export interface ChartBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Theme {
  plotBg: string
  plotGrid: string
  textColor: string
}

export interface AxisConfig {
  yMin: number
  yMax: number
  showYAxis: boolean
}

/**
 * Calculates chart layout bounds based on canvas dimensions and axis visibility.
 */
export function calculateChartBounds(
  canvasWidth: number, 
  canvasHeight: number, 
  showYAxis: boolean
): ChartBounds {
  const leftAxis = showYAxis ? 44 : 8
  const rightPadding = 8
  const topPadding = 8
  const bottomPadding = 26
  
  return {
    x: leftAxis,
    y: topPadding,
    width: Math.max(1, canvasWidth - leftAxis - rightPadding),
    height: Math.max(1, canvasHeight - topPadding - bottomPadding),
  }
}

/**
 * Extracts theme colors from CSS custom properties.
 */
export function getThemeColors(): Theme {
  const getVar = (name: string, fallback: string) => 
    getComputedStyle(document.documentElement).getPropertyValue(name) || fallback
  
  return {
    plotBg: getVar('--plot-bg', 'rgba(10,10,10,0.9)'),
    plotGrid: getVar('--plot-grid', 'rgba(255,255,255,0.06)'),
    textColor: getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e5e5e5',
  }
}

/**
 * Calculates nice tick values for Y-axis labeling.
 */
export function calculateYAxisTicks(yMin: number, yMax: number, approxTickCount = 6) {
  const range = yMax - yMin
  
  const niceNumber = (value: number, round: boolean) => {
    const exp = Math.floor(Math.log10(value))
    const fraction = value / Math.pow(10, exp)
    let niceFraction
    
    if (round) {
      if (fraction < 1.5) niceFraction = 1
      else if (fraction < 3) niceFraction = 2
      else if (fraction < 7) niceFraction = 5
      else niceFraction = 10
    } else {
      if (fraction <= 1) niceFraction = 1
      else if (fraction <= 2) niceFraction = 2
      else if (fraction <= 5) niceFraction = 5
      else niceFraction = 10
    }
    
    return niceFraction * Math.pow(10, exp)
  }
  
  const step = niceNumber(range / approxTickCount, true)
  const tickMin = Math.ceil(yMin / step) * step
  const tickMax = Math.floor(yMax / step) * step
  
  const ticks: number[] = []
  for (let value = tickMin; value <= tickMax + 1e-9; value += step) {
    ticks.push(value)
  }
  
  return { ticks, step }
}

/**
 * Draws the background and grid lines.
 */
export function drawBackgroundAndGrid(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  chart: ChartBounds,
  theme: Theme,
  yTicks: number[],
  yMin: number,
  yMax: number
) {
  // Clear and fill background
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()
  
  ctx.fillStyle = theme.plotBg
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  
  const yScale = (yMax - yMin) !== 0 ? chart.height / (yMax - yMin) : 1
  
  ctx.strokeStyle = theme.plotGrid
  ctx.lineWidth = 1
  
  // Vertical grid lines (fixed every 80px)
  for (let x = chart.x; x <= chart.x + chart.width; x += 80) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, chart.y)
    ctx.lineTo(x + 0.5, chart.y + chart.height)
    ctx.stroke()
  }
  
  // Horizontal grid lines at Y tick positions
  for (const tickValue of yTicks) {
    const y = chart.y + chart.height - (tickValue - yMin) * yScale
    ctx.beginPath()
    ctx.moveTo(chart.x, y + 0.5)
    ctx.lineTo(chart.x + chart.width, y + 0.5)
    ctx.stroke()
  }
}

/**
 * Draws the Y-axis line and labels.
 */
export function drawYAxis(
  ctx: CanvasRenderingContext2D,
  chart: ChartBounds,
  theme: Theme,
  ticks: number[],
  step: number,
  yMin: number,
  yMax: number
) {
  const yScale = (yMax - yMin) !== 0 ? chart.height / (yMax - yMin) : 1
  
  // Y-axis line
  ctx.strokeStyle = theme.plotGrid
  ctx.beginPath()
  ctx.moveTo(chart.x + 0.5, chart.y)
  ctx.lineTo(chart.x + 0.5, chart.y + chart.height)
  ctx.stroke()
  
  // Y-axis labels
  ctx.fillStyle = theme.textColor.trim() || '#e5e5e5'
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  
  for (const tickValue of ticks) {
    const y = chart.y + chart.height - (tickValue - yMin) * yScale
    const label = tickValue.toFixed(Math.max(0, -Math.floor(Math.log10(step))))
    ctx.fillText(label, chart.x - 6, y)
  }
}

/**
 * Formats timestamp for X-axis labels based on time mode and window duration.
 */
export function formatTimeLabel(
  timestamp: number,
  rightTime: number,
  windowMs: number,
  timeMode: 'absolute' | 'relative'
): string {
  if (timeMode === 'absolute') {
    const date = new Date(timestamp)
    const hh = date.getHours().toString().padStart(2, '0')
    const mm = date.getMinutes().toString().padStart(2, '0')
    const ss = date.getSeconds().toString().padStart(2, '0')
    const ms = date.getMilliseconds().toString().padStart(3, '0')
    
    if (windowMs >= 60_000) return `${hh}:${mm}:${ss}`
    return `${hh}:${mm}:${ss}.${ms}`
  } else {
    const deltaTime = rightTime - timestamp
    const seconds = deltaTime / 1000
    return seconds >= 1 
      ? `${seconds.toFixed((seconds >= 10 || windowMs >= 60_000) ? 0 : 1)}s`
      : `${Math.round(seconds * 1000)}ms`
  }
}

/**
 * Draws the X-axis using anchor points for time labels.
 */
export function drawXAxis(
  ctx: CanvasRenderingContext2D,
  chart: ChartBounds,
  theme: Theme,
  snapshot: PlotSnapshot,
  timeMode: 'absolute' | 'relative'
) {
  const times = snapshot.getTimes?.() ?? new Float64Array(0)
  if (times.length < 2) return
  
  const rightTime = times[times.length - 1]
  const leftTime = times[0]
  const windowMs = Math.max(1, rightTime - leftTime)
  const xScale = snapshot.length > 1 ? chart.width / (snapshot.length - 1) : 1
  
  ctx.strokeStyle = theme.plotGrid
  ctx.fillStyle = theme.textColor.trim() || '#e5e5e5'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial'
  
  const anchors = snapshot.anchors || []
  const startTotal = snapshot.windowStartTotal
  
  for (const anchor of anchors) {
    const relativeIndex = anchor.total - startTotal
    if (relativeIndex < 0 || relativeIndex >= snapshot.length) continue
    
    const x = Math.round(chart.x + relativeIndex * xScale) + 0.5
    
    // Draw tick mark
    ctx.beginPath()
    ctx.moveTo(x + 0.5, chart.y + chart.height)
    ctx.lineTo(x + 0.5, chart.y + chart.height + 4)
    ctx.stroke()
    
    // Draw label
    const label = formatTimeLabel(anchor.time, rightTime, windowMs, timeMode)
    ctx.fillText(label, x, chart.y + chart.height + 6)
  }
}

/**
 * Draws all data series as line plots.
 */
export function drawSeries(
  ctx: CanvasRenderingContext2D,
  chart: ChartBounds,
  snapshot: PlotSnapshot,
  yMin: number,
  yMax: number
) {
  if (snapshot.length === 0) return
  
  const xScale = snapshot.length > 1 ? chart.width / (snapshot.length - 1) : 1
  const yScale = (yMax - yMin) !== 0 ? chart.height / (yMax - yMin) : 1
  
  // Clip to chart area to prevent drawing outside bounds
  ctx.save()
  ctx.beginPath()
  ctx.rect(chart.x, chart.y, chart.width, chart.height)
  ctx.clip()
  
  // Draw each series
  for (const series of snapshot.series) {
    const data = snapshot.getSeriesData(series.id)
    if (!data || data.length === 0) continue
    
    ctx.beginPath()
    ctx.strokeStyle = series.color
    ctx.lineWidth = 1.5
    
    for (let i = 0; i < data.length; i++) {
      const x = chart.x + i * xScale
      const y = chart.y + chart.height - (data[i] - yMin) * yScale
      
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    
    ctx.stroke()
  }
  
  ctx.restore()
}