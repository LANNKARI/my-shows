-- Server-authoritative game state. Existing balances and attempts are preserved.
ALTER TABLE "User" ADD COLUMN "higherLowerState" JSONB;
