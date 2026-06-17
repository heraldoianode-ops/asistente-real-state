// Owner activity report — builds a per-property activity summary and sends it to the
// property owner(s) via WhatsApp (through the existing gateway).
// ES: Reporte de actividad por inmueble enviado al/los propietario(s) por WhatsApp.
// EN: Per-property activity report delivered to the owner(s) via WhatsApp.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const EVENT_LABEL: Record<string, string> = { visit: 'Visita', call: 'Llamada', follow_up: 'Seguimiento', closing: 'Cierre' }
const STATUS_LABEL: Record<string, string> = { scheduled: 'agendada', completed: 'realizada', cancelled: 'cancelada', no_show: 'ausente' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'asistente_real_state' } })
    const { property_id } = await req.json()
    if (!property_id) return new Response(JSON.stringify({ error: 'property_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: prop } = await supabase.from('properties').select('id,title,address,status,operation_type,price,currency').eq('id', property_id).single()
    if (!prop) return new Response(JSON.stringify({ error: 'property not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: owners } = await supabase.from('property_owner_contacts').select('owner_name,phone').eq('property_id', property_id)
    const recipients = (owners ?? []).filter(o => o.phone)
    if (recipients.length === 0) return new Response(JSON.stringify({ ok: false, reason: 'No owner phone on file' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: events } = await supabase.from('events').select('event_type,status,scheduled_at').eq('property_id', property_id).order('scheduled_at', { ascending: false })
    const evs = events ?? []
    const visitsScheduled = evs.filter(e => e.event_type === 'visit' && e.status === 'scheduled').length
    const visitsDone = evs.filter(e => e.event_type === 'visit' && e.status === 'completed').length
    const contacts = evs.filter(e => e.event_type === 'call' || e.event_type === 'follow_up').length
    const recent = evs.slice(0, 5).map(e => {
      const d = e.scheduled_at ? new Date(e.scheduled_at).toLocaleDateString('es-AR') : '—'
      return `• ${d} — ${EVENT_LABEL[e.event_type] ?? e.event_type} (${STATUS_LABEL[e.status] ?? e.status})`
    })

    const title = prop.title || prop.address
    const lines = [
      `📋 *Reporte de actividad*`,
      `${title}`,
      ``,
      `Operación: ${prop.operation_type ?? '—'} · ${prop.currency ?? ''} ${prop.price ?? '—'}`,
      `Estado de la publicación: ${prop.status ?? '—'}`,
      ``,
      `Visitas agendadas: ${visitsScheduled}`,
      `Visitas realizadas: ${visitsDone}`,
      `Llamadas / seguimientos: ${contacts}`,
    ]
    if (recent.length) { lines.push('', 'Últimas acciones:', ...recent) }
    lines.push('', '_Reporte automático de tu inmobiliaria._')
    const message = lines.join('\n')

    const gatewayUrl = Deno.env.get('WHATSAPP_GATEWAY_URL')
    if (!gatewayUrl) return new Response(JSON.stringify({ ok: false, reason: 'WHATSAPP_GATEWAY_URL not set' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    let sent = 0
    for (const r of recipients) {
      const res = await fetch(`${gatewayUrl}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: r.phone, message }) }).catch(() => null)
      if (res && res.ok) sent++
    }
    return new Response(JSON.stringify({ ok: true, sent, recipients: recipients.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
