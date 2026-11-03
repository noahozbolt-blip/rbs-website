# RBS Portal

Installable web application at /portal/. The public demonstration at
/portal/?demo=1 uses fictional records in browser memory and never bypasses
the protected production API.

## Access

Netlify Identity must be enabled with **Invite only** registration and email
verification required. Invite the pilot operator in the Netlify dashboard and
assign the application role rbs-pilot. Role changes take effect at the next
login or token refresh.

The API requires a verified Identity session and the application role.
The first confirmed operator gets a separate stable internal UUID. The pilot
currently allows only one initial member; additional members require an
intentional extension. Email is contact metadata, never an ownership key.
The operator can request a verified email change under **Konto**.

## Data and actions

Committed SQL migrations provision Netlify Database. Platform-signed
formSubmitted events capture the existing website forms. No public ingest
endpoint is exposed. Source records are preserved; repeated deliveries are
idempotent. Claims and edits use transactions and versions. Modified drafts
are protected against automatic replacement.

Incoming records get a summary, missing-information checklist and reply
template derived from the supplied fields. The external AI feature is
disabled until separate approval of the inquiry-text payload and OpenAI
destination (AI_RELEASE_APPROVED in the server module). Dedicated name,
email and phone fields are excluded from the prepared AI payload.

An actual mailbox integration and automatic outgoing email are not enabled.
Reviewed drafts can be opened in the operator's mail program. Marking a
draft reviewed is deliberately different from sending it.

## Build and verification

- npm ci
- npm test
- npm run build

The static output excludes server modules, tests and migrations. API responses
are private and not cached. The service worker caches the public app shell only.
Authentication and email callbacks must also be tested on the hosted site.
