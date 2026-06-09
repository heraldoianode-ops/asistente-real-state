'use client'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export default function AdminPage() {
  const { toast } = useToast()

  const triggerScraping = async (type: 'adinco' | 'drive') => {
    try {
      await api.post(`/scraping/${type}`)
      toast({ title: 'OK', description: `Scraping ${type} iniciado` })
    } catch {
      toast({ title: 'Error', description: 'No se pudo iniciar', variant: 'destructive' })
    }
  }

  const triggerRetrain = async () => {
    try {
      await api.post('/predictions/retrain')
      toast({ title: 'OK', description: 'Reentrenamiento iniciado' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo iniciar', variant: 'destructive' })
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Admin</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Scraping</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button onClick={() => triggerScraping('adinco')} className="w-full">Ejecutar Adinco</Button>
              <Button onClick={() => triggerScraping('drive')} variant="outline" className="w-full">Sync Google Drive</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>ML Model</CardTitle></CardHeader>
            <CardContent>
              <Button onClick={triggerRetrain} className="w-full">Reentrenar Modelo</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
