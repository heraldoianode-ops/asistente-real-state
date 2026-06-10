'use client'
import { useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { createClient } from '@/lib/supabase'
import { Download, FileJson, FileSpreadsheet } from 'lucide-react'

interface Section { table: string; label: string; description: string }

const SECTIONS: Section[] = [
  { table: 'properties', label: 'Propiedades', description: 'Catálogo completo de propiedades' },
  { table: 'clients', label: 'Clientes', description: 'CRM — clientes y etapas de lead' },
  { table: 'users', label: 'Agentes', description: 'Usuarios y roles de la plataforma' },
  { table: 'events', label: 'Eventos', description: 'Visitas y llamadas agendadas' },
  { table: 'interactions', label: 'Interacciones', description: 'Historial de conversaciones' },
  { table: 'whatsapp_numbers', label: 'Números WhatsApp', description: 'Números registrados por agente' },
  { table: 'cross_agent_matches', label: 'Coincidencias', description: 'Matches entre agentes' },
  { table: 'property_owner_contacts', label: 'Contactos propietarios', description: 'Datos privados de propietarios' },
]

const BATCH_SIZE = 1000

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const supabase = createClient()
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + BATCH_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < BATCH_SIZE) return rows
  }
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n')
}

function downloadFile(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastExport, setLastExport] = useState<string | null>(null)

  async function handleExport(section: Section, format: 'csv' | 'json') {
    setBusy(`${section.table}-${format}`); setError(null)
    try {
      const rows = await fetchAllRows(section.table)
      const date = new Date().toISOString().slice(0, 10)
      if (format === 'csv') downloadFile(toCsv(rows), `${section.table}_${date}.csv`, 'text/csv;charset=utf-8')
      else downloadFile(JSON.stringify(rows, null, 2), `${section.table}_${date}.json`, 'application/json')
      setLastExport(`${section.label} — ${rows.length} fila${rows.length !== 1 ? 's' : ''} (${format.toUpperCase()})`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al exportar')
    } finally { setBusy(null) }
  }

  return (
    <AdminGuard>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Exportar datos</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Descarga por sección en CSV o JSON</p>
        </div>
        {error && <div className="mb-4 p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{error}</div>}
        {lastExport && <div className="mb-4 p-3 rounded-md bg-[hsl(var(--accent))] text-sm">Exportado: {lastExport}</div>}
        <div className="card-creatio overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
              {['Sección', 'Descripción', 'Exportar'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {SECTIONS.map(s => (
                <tr key={s.table} className="hover:bg-[hsl(var(--secondary))] transition-colors">
                  <td className="px-4 py-3 font-medium">{s.label}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{s.description}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button data-testid={`export-csv-${s.table}`} onClick={() => handleExport(s, 'csv')} disabled={busy !== null}
                        className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--primary))] hover:underline disabled:opacity-50">
                        <FileSpreadsheet className="w-3.5 h-3.5" />{busy === `${s.table}-csv` ? 'Exportando…' : 'CSV'}
                      </button>
                      <button data-testid={`export-json-${s.table}`} onClick={() => handleExport(s, 'json')} disabled={busy !== null}
                        className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--primary))] hover:underline disabled:opacity-50">
                        <FileJson className="w-3.5 h-3.5" />{busy === `${s.table}-json` ? 'Exportando…' : 'JSON'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Las exportaciones respetan RLS: como admin se incluyen todas las filas de cada sección.
        </p>
      </div>
    </AdminGuard>
  )
}
