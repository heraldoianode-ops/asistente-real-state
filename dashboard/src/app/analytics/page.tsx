'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Sidebar } from '@/components/Sidebar'
import { PlotlyChart } from '@/components/PlotlyChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AnalyticsPage() {
  const [charts, setCharts] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchCharts = async () => {
      const endpoints = ['funnel', 'activity', 'agents', 'forecast']
      const results = await Promise.allSettled(endpoints.map(e => api.get(`/analytics/${e}`)))
      const data: Record<string, string> = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') data[endpoints[i]] = r.value.data.chart
      })
      setCharts(data)
    }
    fetchCharts()
  }, [])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <Tabs defaultValue="funnel">
          <TabsList>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="agents">Agentes</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
          </TabsList>
          {['funnel', 'activity', 'agents', 'forecast'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card><CardHeader><CardTitle className="capitalize">{tab}</CardTitle></CardHeader>
                <CardContent>{charts[tab] ? <PlotlyChart data={charts[tab]} /> : <p className="text-muted-foreground">Cargando...</p>}</CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  )
}
