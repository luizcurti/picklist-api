# 0006. API key authentication on every /api/v1/\* request

- **Status**: Accepted

## Context

Every write endpoint under `/api/v1` (create/update/delete a product,
trigger a pick) needs an access-control mechanism — something that decides
_who_ is allowed to call it. `CORS_ORIGIN=*` (the project's default)
governs which browser origins may read a response; it is not that
mechanism (see Alternatives Considered).

## Decision

Every `/api/v1/*` request must carry a valid `X-API-Key` header, matching
one of the comma-separated values in `API_KEYS`. Enforced by `apiKeyAuth`
middleware mounted _inside_ the `/api/v1` router (not as a sibling
middleware in `app.ts`) — a throw from a middleware mounted before a
sub-router isn't caught by that sub-router's own `handlingErrors`; Express
only routes an error to handlers within the scope actually entered.

If `API_KEYS` is left unset outside `NODE_ENV=production`, the app falls
back to a well-known `dev-local-key` so local development, the test suite,
Swagger UI, and the Postman collection all work with zero setup — but
`config/env.ts` refuses to start at all with `NODE_ENV=production` and no
`API_KEYS` configured, a fail-fast guard rather than a silently-open
production deployment. `/health`, `/metrics`, and `/docs` stay
unauthenticated — needed by orchestrators and tooling that has no
credentials to present.

## Alternatives Considered

- **JWT / session-based auth**: rejected — there's no user identity concept
  in this domain (no login, no per-user data); a bearer API key models
  "which caller/service is this" correctly without the added complexity of
  token issuance, expiry, and refresh for an identity that doesn't exist
  here.
- **mTLS / network-level access control only**: rejected — would work for
  a real deployment behind a specific network topology, but this project
  doesn't have one (see memory: dev-only scope) and an application-level
  check is what's actually exercisable and testable here.
- **Rely on CORS alone**: rejected outright — CORS is a browser-enforced
  read restriction, not a request-origination control; a non-browser
  client (`curl`, another service) ignores it entirely.

## Trade-offs

- A single shared key per configured value, not a per-caller identity —
  there's no way to tell _which_ caller made a request, only that _a_
  valid caller did. Acceptable because the domain has no per-caller
  authorization rules to enforce (every valid key can do everything).
- The `dev-local-key` fallback means a misconfigured non-production
  deployment (`NODE_ENV` left as `development` by mistake) would still
  start up unauthenticated-by-default rather than refusing — mitigated by
  the fail-fast guard being keyed specifically on `NODE_ENV=production`,
  the signal that's actually meant to gate it.

## Consequences

- Every `AppError` thrown by `apiKeyAuth` (missing/invalid key → `401`)
  flows through the same `handlingErrors` middleware as every other error
  in the request lifecycle, because of where it's mounted — no separate
  error-response shape to maintain for auth failures specifically.
- `CORS_ORIGIN=*` is safe to default to open: it's a convenience for API
  consumers layered on top of this real access-control gate, not a
  substitute for one, and is implemented as a literal `'*'` string (never a
  reflected `Origin` header), so it cannot combine with credentialed
  requests into an unsafe configuration.
- Swagger UI's "Authorize" button and the Postman collection's collection-
  level `apikey` auth both reference the same `X-API-Key` header, so
  interactive exploration and automated collection runs exercise the exact
  mechanism production traffic would use.
