# Verification report

## Passed

- `npm run build`: Next.js production compilation, TypeScript validation and route generation passed.
- `npm test`: **19 tests passed, 0 failed**.
- Production HTTP smoke checks: workspace returned 200 with its expected content; unauthenticated state, admin, project-create, billing and agent-run requests returned 401; an unsigned Stripe webhook returned 400.

The 19 automated tests cover:

1. Exact AUD prices for selected subscription terms.
2. Fractional credit rounding and invalid cost rejection.
3. Unsafe paths and oversized source rejection.
4. Restrictive preview policy and local CSS/JS embedding.
5. Calendar month arithmetic across month ends and leap years.
6. Concrete static audit findings.
7. Verified owner identity versus untrusted profile metadata.
8. Basic app limits, cross-account isolation and version conflicts.
9. Weekly allowance expiry with non-expiring top-ups.
10. Idempotent reservations, concurrent-task limits and one-time settlement.
11. Prevention of expired-credit resurrection.
12. Payment replay protection and single-use trials.
13. Rejection of stale paid-period entitlement updates.
14. Explicit workspace acceptance and unauthorised credit adjustments.
15. Downgrade archiving, restoration limits and archived-file write rejection.
16. Checkout lease exclusivity and matching-token release.
17. Schedule entitlement and project-ownership enforcement.
18. Credit-ledger reconciliation across trial/payment replacements and stale events.
19. Browser database-role denial for private tables and privileged functions.

Database tests use embedded PostgreSQL (PGlite) with a minimal test-only Auth table and the actual schema/functions. No production accounts are created. This validates SQL and transaction behaviour but is not a distributed PostgreSQL concurrency/load test or a live Supabase Auth test.

## Not verified in this environment

- Actual Supabase signup, verification email, password reset and session recovery.
- Actual OpenAI/Anthropic tool calls, token prices, model availability and cost reconciliation.
- Stripe test-mode or live-mode payments, expiry timing, portal notifications and webhook deliveries.
- Actual Vercel project creation, preview/production deployment, cron delivery and team permissions.
- Browser rendering, responsive layout, keyboard flows and end-to-end customer journeys. The available browser rejected the local development address; no screenshot-based visual validation is claimed.
- Load, penetration, accessibility, legal/tax compliance or independent security certification.

## Launch status

**Source implementation and local checks complete; production launch remains unverified.** Billing defaults to disabled. No live site was published, credentials connected or payments taken.

Use SETUP.md to connect a staging environment and run the listed provider acceptance checks. Review README.md's implementation boundaries before presenting the product as a general-purpose autonomous application builder.
