# Account roles and Premium

Authorization uses the fresh database state on each protected action. SiteOwner is a singleton (id=1, CHECK constraint) tied to the verified account's immutable User.id. No registration/profile input, custom role permission, JWT field, or normal API can create or transfer ownership.

Administrator UI: /admin. Public subscription page: /premium. Private Premium reports: /statistics. Role-specific editorial workspace: /curation; published selections: /picks. The grouped account menu exposes administration where authorized; /picks and /curation links are currently hidden from the menu, with routes preserved.

SiteRole names, icons, colors, and allowed permissions are configurable by the owner. Assignments may be permanent or expire. Permissions currently supported: moderate_comments, curate, beta. The beta role is an access flag for future experiments; no experimental feature is enabled merely by granting it. Moderator and curator have no permission to issue roles or create promotions. Pioneer grants the commemorative frame.

Premium purchases offer 7 days for 1290 popcorn with a 150-popcorn activation bonus, or exactly 30 days for 2000 popcorn with a 500-popcorn activation bonus. Confirmation contains a UUID request key, chosen days, server price and previous expiration. Retries are idempotent; reusing a key for a different plan is rejected. Early renewal extends from the existing expiration. Admin gifts remain 30-day periods with a 500 bonus by default. Each PremiumPeriod persists durationDays and activationBonus, so mixed renewals settle correctly.

Each started, non-revoked period receives its stored bonus exactly once through a unique ledger key. Future period bonuses are not paid early. Settlement runs on authenticated account/balance refresh, including on returning after an absence. Revocation does not claw back earned popcorn or started-period achievements, and does not refund purchases.

Positive game rewards are multiplied by exactly two while Premium is active, inside the original wallet transaction. Existing reward keys are checked first. Practice, zero rewards, tasks, daily bonuses, promotions and ordinary activity are not multiplied. The legacy premiumBonusTenths field is retained for compatibility but is no longer accumulated or used for rewards.

Exclusive cosmetics: theme-obsidian and frame-premium-orbit, available without an extra item charge while subscribed. They are never recorded as permanent purchases. The store API checks current entitlements. Public avatars validate current badges, and theme synchronization removes expired Premium themes. Existing paid cosmetics are unaffected. Achievement progress counts only periods that actually started before their revocation.

Reports are Premium-only; see viewing-statistics.md for canonical counts, local timezones and import/bulk protection. AI allowance remains a development notice.

Personal profile covers are Premium-only, checked server-side both before processing and before saving. The owner previews a center crop at 3:1; files up to 10 MB are resized/encoded in the browser before POST so they fit the hosting request limit. The server decodes and re-encodes JPEG/PNG/WebP with Sharp (40M pixel limit, metadata stripped), and uploads WEBP to the configured Cloudinary account under episyhub/banners with a server-generated public ID. No client-provided URL is accepted. Uploads are limited to five per 15-minute fixed bucket per user. Public profile/store responses hide custom covers without active Premium; stored URLs and selections are preserved and restore on renewal. Returning to standard explicitly clears the selected URL and style; no physical image deletion is performed.

Incoming friendship notifications derive from pending Friendship rows, scoped to the current addressee. notificationReadAt is independent of acceptance. Notification responses include friendRequests separately from paginated release items; the popover displays up to three combined rows, the full inbox up to 100 incoming requests with a link to Friends if truncated. Read-all sends separate release/friend snapshot watermarks and never reads newer arrivals. POST /api/notifications/friends/:id accepts/declines only a still-pending incoming request, with fresh authentication, origin checks and conditional mutation. Processed/cancelled requests disappear from actionable notifications. Release settings do not disable friendship notices.


Admin promotions use the existing PromoCode/PromoRedemption ledger and conditions. Codes are uppercase, 3–64 A–Z / 0–9 / _ / -, rewards 1–1,000,000; an optional global limit and activation window are supported. One redemption per account. Creation/toggling and role mutations are audited and idempotent by request key. Moderation does not preserve deleted comment text in the audit log.

New tables have RLS enabled and are server-only: no browser database access or user-editable metadata is trusted. Migration: 20261106000000_account_roles_premium. Ownership is bootstrapped separately after verifying the actual production account ID; migration never guesses an owner at login.

Migration 20261107010000_premium_plans_social adds durationDays/activationBonus to PremiumPeriod (legacy defaults 30/500) and notificationReadAt to Friendship. Existing subscriptions and friendships are preserved; RLS and server-only access remain unchanged.
