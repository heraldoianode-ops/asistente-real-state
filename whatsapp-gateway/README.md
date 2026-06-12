# whatsapp-gateway — DEPRECATED / OBSOLETO

**ES:** Este gateway Express (pensado para correr en un VPS con dominio propio) fue
reemplazado por la Edge Function `supabase/functions/wa-gateway`, que corre dentro
de Supabase sin servidor ni dominio propio. Se conserva temporalmente como
referencia (regla R5: deprecar → paralelo → migrar → borrar) y se eliminará en una
próxima versión.

**EN:** This Express gateway (meant to run on a VPS with its own domain) has been
replaced by the `supabase/functions/wa-gateway` Edge Function, which runs inside
Supabase with no server or domain required. It is kept temporarily as a reference
(rule R5: deprecate → parallel → migrate → delete) and will be removed in an
upcoming version.

Webhook URL for Meta / URL del webhook para Meta:

```
https://<project-ref>.supabase.co/functions/v1/wa-gateway
```

Required secrets (Supabase → Edge Functions → Secrets) / Secretos requeridos:

| Secret | ES | EN |
|---|---|---|
| `WA_VERIFY_TOKEN` | Token de verificación del webhook | Webhook verify token |
| `WA_TOKEN` | Token de acceso de la Cloud API | Cloud API access token |
| `WA_PHONE_NUMBER_ID` | ID del número emisor | Sender phone number ID |
| `WA_APP_SECRET` (opcional) | Valida la firma X-Hub-Signature-256 | Validates X-Hub-Signature-256 |
| `WA_API_VERSION` (opcional) | Default `v21.0` | Default `v21.0` |
