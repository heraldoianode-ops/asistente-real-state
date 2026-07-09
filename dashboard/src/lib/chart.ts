export function conicGradient(pct: number, color: string, track: string): string {
  const clamped = Math.max(0, Math.min(100, pct))
  return `conic-gradient(${color} 0% ${clamped}%, ${track} ${clamped}% 100%)`
}

export function multiConicGradient(segments: { pct: number; color: string }[]): string {
  let acc = 0
  const stops = segments.map(({ pct, color }) => {
    const from = acc
    const to = acc + pct
    acc = to
    return `${color} ${from}% ${to}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

export const CHART_PALETTE = ['#0070CC', '#22A050', '#E29612', '#DF2060', '#7D5FC7', '#B7BFCB']

export const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function lastNMonths(n: number, from = new Date()): { year: number; month: number; label: string }[] {
  const out: { year: number; month: number; label: string }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()] })
  }
  return out
}

/** Builds an SVG polyline `points` string for a 640x190 viewBox area chart, values scaled to a 0..max range. */
export function toChartPoints(values: number[], max: number): string {
  const W = 640, H = 190, PAD = 8
  const safeMax = max <= 0 ? 1 : max
  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = PAD + i * step
      const y = H - PAD - (v / safeMax) * (H - PAD * 2)
      return `${x},${y}`
    })
    .join(' ')
}

export function toAreaPoints(linePoints: string): string {
  const W = 640, H = 190, PAD = 8
  return `${linePoints} ${W - PAD},${H} ${PAD},${H}`
}
