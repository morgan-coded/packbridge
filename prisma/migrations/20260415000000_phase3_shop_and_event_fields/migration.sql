-- Phase 3 schema changes:
--  * Shop: add webhookUrl, signingSecret, defaultEnforcementMode
--  * NormalizationEvent: add packSize, remainder, enforcementMode

ALTER TABLE "Shop"
  ADD COLUMN "webhookUrl" TEXT,
  ADD COLUMN "signingSecret" TEXT,
  ADD COLUMN "defaultEnforcementMode" TEXT NOT NULL DEFAULT 'warn';

ALTER TABLE "NormalizationEvent"
  ADD COLUMN "packSize" INTEGER,
  ADD COLUMN "remainder" INTEGER,
  ADD COLUMN "enforcementMode" TEXT;
