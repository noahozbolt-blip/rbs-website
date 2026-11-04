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
Each confirmed operator gets a separate stable internal UUID. The pilot
currently allows two invited members; additional members require an
intentional extension. Email is contact metadata, never an ownership key.
The operator can request a verified email change under **Konto**.

The verified JWT context may contain only claims, without confirmedAt. In that
case the function reads the authenticated user's own Identity profile through
the server-only admin SDK before binding a member. A missing confirmation,
revoked role, mismatched identity or failed lookup never grants access.
Invitation and password recovery finish with an explicit SDK login so the
browser session and protected API cookie agree. Workspace failures are shown
separately from password setup; consumed invitation tokens are not retried.
On resumption the browser awaits session renewal before opening the API. A 401
may be retried once after successful renewal, before any portal mutation;
authorization denials, conflicts and service errors are never retried.

## Data and actions

Committed SQL migrations provision Netlify Database. Platform-signed
formSubmitted events capture the existing website forms. No public ingest
endpoint is exposed. Source records are preserved; repeated deliveries are
idempotent. Claims and edits use transactions and versions. Modified drafts
are protected against automatic replacement.

Incoming records get a summary, missing-information checklist and reply
template derived from the supplied fields and text. The shared Jarvis module
also recognizes project references, existing area/planning/appointment details,
and requests for availability or documents. It proposes project assignments;
operators adopt and save them explicitly. All project sizes and regions remain
open for human review. Today's and overdue follow-ups can be filtered in one
click. The public demo runs the same preparation logic with fictional inquiries.

Public project profiles for Nentershausen, Niedererbach and Flacht include
source links and limits of the 3D visualizations. Website facts never establish
live availability, prices or binding completion dates. These public profiles
are bundled into the app. Future private customer documents must use protected
storage, not this public source repository or browser bundle.

## Optional decision guide

The guide starts with three choices appropriate to the inquiry type, then
reveals only the chosen step, its possible consequences and the next choices.
Documents, conversation, internal assessment, follow-up, waiting and closure
have distinct preparation. Closure and refusal are separate explicit branches.

Route choices are saved as versioned audit events by the owner of a case.
They do not modify the draft, next step or status, and do not assert that an
email was sent or a meeting happened. On reload the latest route is restored
independently of the displayed audit history. Choices require the current case
version and a valid transition in the server-side graph.

Operators can hide the guide and continue freely. A preview offers copying
only the next step or explicitly replacing the draft as well. Suggestions enter
the existing editor and still require normal saving. Unsaved edits survive
route navigation. A separate explicit action can mark an internally completed
case done. The guide uses the same graph and preparation in the public demo.

The preparation currently follows explicit rules; it is not a general-purpose
language model. The external AI feature is
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
Reading a case never overwrites an operator's draft or next step. Static
packaging excludes source modules and temporary files.
