'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Client {
  id: string
  full_name: string
  lead_stage: string
  phone?: string
  budget?: number
  currency?: string
}

const STAGE_COLORS: Record<string, string> = {
  new: 'secondary', contacted: 'default', qualified: 'default',
  visit_scheduled: 'default', negotiating: 'default',
  closing: 'default', closed_won: 'default', closed_lost: 'destructive'
}

export default function CRMPage() {
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    api.get('/clients/').then(r => setClients(r.data)).catch(() => {})
  }, [])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold mb-6">CRM — Clientes</h1>
        <div className="grid gap-4">
          {clients.map(c => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{c.full_name}</CardTitle>
                  <Badge variant={STAGE_COLORS[c.lead_stage] as any}>{c.lead_stage}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {c.phone && <span>{c.phone}</span>}
                {c.budget && <span className="ml-4">{c.currency} {c.budget.toLocaleString()}</span>}
              </CardContent>
            </Card>
          ))}
          {clients.length === 0 && <p className="text-muted-foreground">No hay clientes registrados.</p>}
        </div>
      </main>
    </div>
  )
}
