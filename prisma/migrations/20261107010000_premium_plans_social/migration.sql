ALTER TABLE "PremiumPeriod" ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "PremiumPeriod" ADD COLUMN "activationBonus" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "PremiumPeriod" ADD CONSTRAINT "PremiumPeriod_plan_check" CHECK ("durationDays" IN (7,30) AND "activationBonus" IN (150,500));
ALTER TABLE "Friendship" ADD COLUMN "notificationReadAt" TIMESTAMP(3);
