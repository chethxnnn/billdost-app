# DEPRECATED: whatsapp-service (whatsapp-web.js)

This microservice is retired as of Stage 2 of the BillDost rebuild. It
automated a personal WhatsApp account through whatsapp-web.js, which
carries a permanent number ban risk, exposed unauthenticated endpoints,
and lost its sessions on every redeploy.

WhatsApp delivery now runs through the official Meta WhatsApp Cloud
API, server-side, in the main app:

- `billdost/src/server/whatsapp.ts`: the only module that talks to Meta
- `billdost/src/server/routers/whatsapp.ts`: status, connection,
  sendInvoice, test send, send history
- `billdost/src/app/api/webhooks/whatsapp/route.ts`: delivery status
  writeback into `whatsapp_sends`

No code path calls this service anymore (the
NEXT_PUBLIC_WHATSAPP_SERVICE_URL variable is gone from the app). Do not
deploy this folder. It is kept in the repo only as a reference for the
old behaviour until Chethan decides to delete it.
