'use client'
import dynamic from 'next/dynamic'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

export function PlotlyChart({ data }: { data: string }) {
  try {
    const parsed = JSON.parse(data)
    return (
      <Plot
        data={parsed.data || []}
        layout={{ ...parsed.layout, autosize: true }}
        style={{ width: '100%', height: '400px' }}
        config={{ responsive: true }}
      />
    )
  } catch {
    return <p className="text-destructive">Error rendering chart</p>
  }
}
