# Account roles and Premium

Authorization uses the fresh database state on each protected action. SiteOwner is a singleton (id=1, CHECK constraint) tied to the verified account's immutable User.id. No registration/profile input, custom role permission, JWT field, or normal API can create or transfer ownership.

Administrator UI: /admin. Public subscription page: /premium. Private Premium reports: /statistics. Role-specific editorial workspace: /curation; published selections: /picks. Account menu links expose these destinations where relevant.

SiteRole names, icons, colors, and allowed permissions are configurable by the owner. Assignments may be permanent or expire. Permissions currently supported: moderate_comments, curate, beta. The beta role is an access flag for future experiments; no experimental feature is enabled merely by granting it. Moderator and curator have no permission to issue roles or create promotions. Pioneer grants the commemorative frame.

Premium purchases cost 2000 popcorn for exactly 30 days (not a calendar month). Confirmation contains a UUID request key, server price and previous expiration. Concurrent retries are idempotent. Early renewal extends from the existing expiration, never from now. Admin gifts create the same 30-day periods, up to 12 at once, without charging the recipient.

Each started, non-revoked period receives 500 popcorn exactly once with a unique ledger key. Future period bonuses are not paid early. Settlement happens automatically on authenticated account/balance refresh, including on returning to the site after an absence. No cron or external billing provider is required. Revoking Premium cancels active/future periods, does not claw back already earned popcorn or started-period achievements, and does not refund spent popcorn.

Game rewards of category game receive 10% extra while Premium is active. Integer tenths are retained on User.premiumBonusTenths; 10 base popcorn across either mini-game yield 1 additional popcorn. Existing reward keys are checked before advancing the remainder. Practice, tasks, daily rewards, promos and ordinary activity are not multiplied. Everything is in the original wallet transaction.

Exclusive cosmetics: theme-obsidian and frame-premium-orbit, available without an extra item charge while subscribed. They are never recorded as permanent purchases. The store API checks current entitlements. Public avatars validate current badges, and theme synchronization removes expired Premium themes. Existing paid cosmetics are unaffected. Achievement progress counts only periods that actually started before their revocation.

Reports use the current user's watched EpisodeProgress dates only. Foreign-show progress is excluded. Undated marks are reported separately. Missing runtimes use the site's existing 110/45-minute estimate, explicitly disclosed in the report. Dates are grouped by UTC. AI allowance is only a development notice: no working AI feature is advertised as available.

Admin promotions use the existing PromoCode/PromoRedemption ledger and conditions. Codes are uppercase, 3–64 A–Z / 0–9 / _ / -, rewards 1–1,000,000; an optional global limit and activation window are supported. One redemption per account. Creation/toggling and role mutations are audited and idempotent by request key. Moderation does not preserve deleted comment text in the audit log.

New tables have RLS enabled and are server-only: no browser database access or user-editable metadata is trusted. Migration: 20261106000000_account_roles_premium. Ownership is bootstrapped separately after verifying the actual production account ID; migration never guesses an owner at login.
