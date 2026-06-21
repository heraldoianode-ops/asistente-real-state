// PropTech AI Platform — shared WhatsApp delivery via the slim gateway /send.
export async function sendViaGateway(to: string | null, message: string): Promise<boolean> {
  const gw = Deno.env.get('WHATSAPP_GATEWAY_URL')
  if (!gw || !to) return false
  try {
    const r = await fetch(`${gw}/send`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, message }),
    })
    return r.ok
  } catch {
    return false
  }
}
