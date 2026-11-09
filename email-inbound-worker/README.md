# Socially inbound email worker

Receives customer email at `support@socially.lol` and `legal@socially.lol` via
Cloudflare Email Routing, parses it, and POSTs it to the staff email-support
webhook. Outbound replies still go through Resend; this only handles inbound.

Flow:

```
customer -> MX (Cloudflare Email Routing) -> this Worker -> POST /api/staff/email/webhook/resend
```

The server routes the conversation to a mailbox by the recipient address:
`support@` -> Support (admin+), `legal@` -> Legal (developer+).

## One-time setup

1. Pick a shared secret and set it in BOTH places (they must match):
   - Server: set `EMAIL_INBOUND_TOKEN` in Infisical (prod env).
   - Worker: `wrangler secret put EMAIL_INBOUND_TOKEN`

2. Enable Email Routing for `socially.lol` in the Cloudflare dashboard
   (Email -> Email Routing). This adds the required MX + TXT records.

3. Deploy the Worker:
   ```
   cd email-inbound-worker
   npm install
   npx wrangler deploy
   ```

4. Add the routing rules (Cloudflare dashboard -> Email -> Email Routing -> Routes),
   OR use a catch-all. Each custom address routes to this Worker:

   | Custom address        | Action                | Destination                |
   | --------------------- | --------------------- | -------------------------- |
   | support@socially.lol  | Send to a Worker      | socially-email-inbound     |
   | legal@socially.lol    | Send to a Worker      | socially-email-inbound     |

   (Or set the catch-all address to "Send to a Worker" -> `socially-email-inbound`.)

## Notes

- `WEBHOOK_URL` is set in `wrangler.toml`. Change it if the API host differs.
- The Worker throws on a non-2xx webhook response so failures are visible in
  `wrangler tail` and Cloudflare retries.
- The server accepts this Worker via the `Authorization: Bearer <EMAIL_INBOUND_TOKEN>`
  header. Resend's Svix signatures are not used for the Cloudflare inbound path.

## Test

```
npx wrangler tail            # in one terminal, watch Worker logs
# send an email to legal@socially.lol, then check the staff panel Legal tab
```
