# EMBZ NEXUS

A Vercel-targeted AI development workspace, built for **trooperhaps@gmail.com**.

The app includes a dark purple/cyan frontend, project storage and versioning, a code editor, isolated HTML preview, Claude and GPT tool loops, a custom Vercel operations assistant, memberships, credit accounting, scheduled tasks and an owner console.

**This is a new source project, not a modification of the existing EMBZ deployment.** No existing repository, production database or Vercel account was supplied. The source builds without credentials and shows honest setup states. Live authentication, provider calls, billing and deployment require the connections in [SETUP.md](SETUP.md).

## Start

Requires Node.js 22 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Fill the environment values using SETUP.md. For a production build:

```sh
npm run build
npm start
```

Deploy the repository to Vercel as a Next.js project. Keep `.env.local` out of Git. The minute-based cron and 300-second worker require a Vercel plan/configuration that supports them. [Vercel Cron documentation](https://vercel.com/docs/cron-jobs)

## Included implementation

| Area | Implemented behaviour |
|---|---|
| Identity | Supabase email/password signup, verification, login, logout and password recovery |
| Owner | The verified `trooperhaps@gmail.com` account is bound to an immutable owner UUID; role cannot be granted through profile metadata |
| Projects | Create/import, search, text-file editing, version saves, restore-to-editor, ZIP export, archive/restore and active-app limits |
| Preview | Opaque sandboxed iframe, restrictive content policy, local HTML/CSS/JS file injection |
| Claude | Anthropic Messages API with project file tools and staged changes |
| GPT | OpenAI Responses API with project file tools and staged changes |
| Vercel operations | Custom GPT-powered assistant with actual deployment lookup; separate preview/production deployment controls |
| Membership | Basic, Pro, Executive; monthly through three-year recurring terms, ten-year prepaid term, disabled Lifetime pricing |
| Trial | Seven-day Pro trial, 100 credits, then A$43/month unless cancelled; grants follow verified events |
| Credits | Atomic reservations, fractional charges, non-rollover allowances, non-expiring top-ups, expiry-safe refunds and a ledger |
| Billing | Stripe Checkout, billing portal, subscription/payment webhooks, replay protection, owner replay of failed Stripe events |
| Scheduled work | Daily/weekly bounded agent tasks, 10 Pro / 50 Executive workflows |
| Shared workspace | Executive owner plus four members; verified Basic accounts accept invitations in-app |
| Owner console | User/membership visibility, recorded credit adjustments, action audit trail |
| Analytics | Recorded agent task counts, credits, completions and CSV ledger export |

The owner receives complimentary Executive-level workspace access with a metered allowance. This does not remove provider costs. Owner credit adjustments are recorded in the ledger.

## Agent execution contract

Agents can list/read project files, propose replacement files, run a limited static source audit and query linked deployment status. Proposed changes require review and a successful version comparison before being saved. They do not execute arbitrary shell commands or claim that generated code has been tested.

The third assistant is **not the official Vercel Agent embedded in the app**. Official Vercel Agent is a separate Vercel product; no embeddable official Agent API was established. Its supported workflow can be used alongside this app. [Official Vercel Agent](https://vercel.com/docs/agent)

A task is persisted before execution. The request worker claims it once, with a maximum of six model turns. Cron recovers queued work and refunds abandoned running reservations after ten minutes. Incomplete provider work is not checkpointed/resumed; an interrupted task must be restarted. The platform absorbs provider costs on failed tasks and any amount above a user's cap.

## Membership policy

| Plan | Allowance | Apps | Seats | Simultaneous tasks | Workflow limit |
|---|---:|---:|---:|---:|---:|
| Basic | 10 credits / 7 days | 1 | 1 | 1 | 0 |
| Pro | 550 credits / month | 10 | 1 | 2 | 10 |
| Executive | 1,050 credits / month | 50 | 5 | 5 | 50 |

| Term | Pro AUD | Executive AUD |
|---|---:|---:|
| Seven-day trial | $0, then $43/month | Not offered |
| Month | $43 | $99.99 |
| Six months | $245.10 | $569.94 |
| Year | $464.40 | $1,079.89 |
| Three years | $1,315.80 | $3,059.69 |
| Ten years, prepaid | $4,128 | $9,599.04 |
| Lifetime, unavailable | Proposed $12,999 | Proposed $29,999 |

Long-term payments do not release all future credits upfront. Monthly through three-year terms renew for the same duration. Ten years is a one-time prepaid purchase with no automatic renewal. Lifetime cannot be purchased in this build.

Paid credits reset at monthly anniversaries; Basic resets at seven-day anniversaries. Purchased top-ups (100/$8, 300/$21, 1,000/$65) do not expire. Subscription credits are used before top-ups. One credit represents up to A$0.02 of configured direct cost; billing uses tenths of credits, with a minimum charge of 0.1 for a used provider task. Model token prices and the accounting FX rate must be supplied accurately. Execution overhead can be passed through using a measured per-second rate, or absorbed by setting it to zero.

When paid access expires, the most recently edited app stays active on Basic; other apps are archived, preserved and exportable. The user can archive the active app and restore a different app. A workspace whose Executive access expires stops sharing; members return to their personal accounts.

## Boundaries and outstanding production work

- No production deployment or live credentials were supplied. Provider-connected flows have not been exercised against your accounts.
- Browser visual/end-to-end inspection was not completed: the available browser rejected the local development address. Responsive CSS and type/build checks do not substitute for browser QA.
- Direct preview/deployment supports static HTML/CSS/JavaScript. Framework sources can be edited and exported. General build sandboxes, repository import/PR automation and native Android/iOS packaging are not included.
- Analytics measures workspace agent activity, not visitors to deployed apps. Performance traces, traffic instrumentation and distributed error monitoring need additional integrations.
- Built-in audits are limited static checks and model review. They are not a full security assessment, dependency audit or browser accessibility test.
- Owner controls cover the implemented account/credit/record workflows. A runtime pricing editor, staff role hierarchy and unrestricted cross-customer project editing are not provided.
- Paid plan switching/proration, automatic refund/dispute entitlement reversal and failed-payment recovery emails are not implemented. Keep Stripe's portal limited to invoices, payment methods and cancellation. Handle refunds/disputes through Stripe and owner credit/account reconciliation before enabling public billing.
- Scheduling is bounded database/cron execution, not a horizontally scalable durable workflow service. It has no exact-time or support-response SLA. Priority support, branded reports, custom branding and advanced multi-agent orchestration are not advertised as implemented perks.
- Trial abuse prevention is one trial per verified account. Production fraud controls across multiple accounts/payment instruments remain necessary if you offer public signup at scale.
- Webhook configuration supports one platform Vercel signing secret. Other connected Vercel teams can refresh deployment status through their own tokens.
- Model key presence is labelled "Configured", not proof of a successful provider call. Audit the cost rates whenever you change a model.

See [VERIFICATION.md](VERIFICATION.md) for test evidence and the remaining launch checks.
