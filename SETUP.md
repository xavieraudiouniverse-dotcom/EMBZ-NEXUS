# Connect and deploy EMBZ NEXUS

This guide activates the code already included in the project. Do not paste secret values into chat, source files or browser-visible environment variables.

## 1. Create a private source repository

Extract this project, commit the files to a private repository and import it into Vercel. Choose the Next.js framework and a Node.js version of at least 22. Vercel runs `npm run build`.

This code is separate from your existing site. Review and merge it deliberately if you want to reuse an existing repository; do not overwrite an existing production database with this initial schema.

## 2. Set up Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` once in a **new** database using the SQL editor. This is an initial schema, not an upgrade migration for an existing app.
3. Enable email/password authentication and **Confirm email**. Configure a production mail sender so verification and password-reset mail is delivered.
4. Configure the Supabase Site URL and allowed redirect URLs for your production Vercel origin and any staging origin you intentionally use.
5. Add the Supabase project URL and anon key to Vercel as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Add the service-role key as `SUPABASE_SERVICE_ROLE_KEY` (server-only).

The server validates bearer tokens using Supabase `getUser`, verifies email confirmation and then performs access-controlled database operations. Browser roles have no direct table or privileged-function access. [Supabase getUser documentation](https://supabase.com/docs/reference/javascript/auth-getuser)

## 3. Activate your owner account

Sign up normally with **trooperhaps@gmail.com**, verify the email and sign in. The database assigns the owner role from the verified Auth record and binds it to that account UUID. There is no default administrator password and no client-side owner override.

Use a different verified email to test Basic membership. Do not use the complimentary owner account as your paid-subscription acceptance test.

## 4. Configure platform secrets

Copy the names from `.env.example` into Vercel's environment settings. Set `NEXT_PUBLIC_APP_URL` to your actual origin, such as `https://your-project.vercel.app`, with no trailing slash.

Generate independent random values for `INTEGRATION_ENCRYPTION_KEY` and `CRON_SECRET`. The integration key must be 64 hexadecimal characters (32 bytes). For example, run this locally for each value:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store them in Vercel's secret environment configuration. Replacing the integration encryption key without re-encrypting stored tokens makes existing Vercel connections unreadable; reconnect them after an intentional rotation.

## 5. Configure Claude and GPT

For OpenAI, provide `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INPUT_USD_PER_M` and `OPENAI_OUTPUT_USD_PER_M`.

For Anthropic, provide `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_INPUT_USD_PER_M` and `ANTHROPIC_OUTPUT_USD_PER_M`.

Choose text models available to your accounts that support function tools. Enter the current USD input/output prices per million tokens for those exact models. Set `USD_TO_AUD` to your current accounting conversion rate. Set `EXECUTION_AUD_PER_SECOND` to measured execution cost, or `0` to absorb execution overhead within membership pricing. Calls remain unavailable when required configuration is absent or invalid.

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create)

Run one small task with each provider using a test account and a modest credit cap. Confirm a file proposal, cost settlement and actual provider usage before opening public access. The Vercel operations assistant uses the same configured OpenAI model.

## 6. Configure Stripe in test mode first

Keep `BILLING_ENABLED=false` until the checks below pass.

Set a test-mode `STRIPE_SECRET_KEY` in your shell and run:

```sh
npm run billing:setup
```

This script **creates products and prices in the Stripe account associated with that key**. It prints environment-variable assignments containing price IDs, not your secret key. Copy the output into the matching Vercel variables. Use live-mode keys only when you deliberately repeat this setup for live products.

Configure the customer portal to allow invoice viewing, payment-method changes and cancellation. **Disable plan switching and quantity changes**, because proration and cross-plan credit reconciliation are not included. Enable Stripe's trial-ending and payment-failure notifications as appropriate for your billing flow.

Create a Stripe webhook endpoint at your origin plus `/api/webhooks/stripe`. Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Put its signing secret in `STRIPE_WEBHOOK_SECRET`. The handler validates Stripe's signature over the raw body, stores the verified event and grants entitlements through an idempotent database transaction. Access is never granted merely because the browser returns from Checkout.

The setup script uses fixed AUD, tax-inclusive price values. It does not configure tax registration, automatic tax calculation, legal terms, refunds or dispute policy. Complete your business's billing setup before accepting public payments. [Stripe subscription lifecycle](https://docs.stripe.com/billing/subscriptions/overview)

Check in test mode:

1. Start the seven-day Pro trial with a payment method; verify exactly 100 trial credits.
2. Cancel during the trial; verify no paid renewal is taken.
3. Use Stripe test clocks or a controlled test subscription to reach trial end; verify the A$43 monthly invoice and 550-credit grant once.
4. Purchase each supported term; verify its exact price, paid-through date and monthly credit refresh.
5. Buy a credit pack; replay the event and verify that the pack is granted only once.
6. Fail a renewal payment; verify access ends at the last paid-through date.
7. Test portal cancellation and the archived-app behaviour after expiry.
8. Verify refund/dispute handling in your owner operating procedure. This build does not automatically reverse those entitlements.

Once connected tests pass and the remaining production requirements are addressed, set `BILLING_ENABLED=true` and redeploy.

## 7. Connect Vercel deployments

In NEXUS Settings, enter a Vercel access token and, if needed, its team ID. The server verifies project-list access before storing the token encrypted. Each workspace has its own token. Workspace members cannot replace the owner's token or publish releases.

Create an HTML app, save a version and use **Deploy preview**. Check the actual deployment state, then explicitly publish production if desired. Vercel hosting costs are separate from NEXUS credits.

Optional platform webhook: configure `/api/webhooks/vercel`, save its secret in `VERCEL_WEBHOOK_SECRET` and subscribe to deployment success/error events. HMAC verification uses `x-vercel-signature`. [Vercel webhooks](https://vercel.com/docs/webhooks)

Official Vercel Agent is enabled separately through Vercel's supported interfaces. The custom operations assistant in NEXUS is not an embedded official Agent API.

## 8. Enable the worker schedule

`vercel.json` calls `/api/cron` every minute. Configure `CRON_SECRET` and ensure the Vercel project supports that cadence and the route's 300-second maximum duration. Cron claims at most one queued run per invocation after scheduling due tasks and recovering abandoned runs. Interactive requests also execute their own newly queued task.

If using a plan without minute-level cron, choose a supported external scheduler with the same bearer secret; review its capacity before launch. The existing API still queues work, but interrupted runs need the recovery worker to settle correctly.

## 9. Finish validation and deploy

```sh
npm test
npm run build
```

Redeploy after changing public environment variables because Next.js embeds them at build time. Perform mobile/desktop browser checks and all live-provider tests in staging. No production URL, database migration, provider credential or payment was created during preparation of this package.
