-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "plan" TEXT,
    "currency" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncedCompany" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncedCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncedCompanyLocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncedCompanyLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncedVariant" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "title" TEXT,
    "productTitle" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncedVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackRule" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "companyId" TEXT,
    "companyLocationId" TEXT,
    "variantId" TEXT,
    "productId" TEXT,
    "packSize" INTEGER NOT NULL,
    "downstreamUnitCode" TEXT NOT NULL,
    "enforcementMode" TEXT NOT NULL DEFAULT 'warn',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveStart" TIMESTAMP(3),
    "effectiveEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizationJob" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "companyId" TEXT,
    "companyLocationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "NormalizationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizationEvent" (
    "id" TEXT NOT NULL,
    "normalizationJobId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sku" TEXT,
    "inputQuantity" INTEGER NOT NULL,
    "resolvedRuleId" TEXT,
    "outputQuantity" DECIMAL(65,30),
    "outputUnit" TEXT,
    "resultStatus" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormalizationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundDelivery" (
    "id" TEXT NOT NULL,
    "normalizationJobId" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL DEFAULT 'webhook',
    "destinationRef" TEXT,
    "payloadHash" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "OutboundDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleImportJob" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RuleImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncedCompany_shopDomain_idx" ON "SyncedCompany"("shopDomain");

-- CreateIndex
CREATE INDEX "SyncedCompanyLocation_shopDomain_idx" ON "SyncedCompanyLocation"("shopDomain");

-- CreateIndex
CREATE INDEX "SyncedCompanyLocation_companyId_idx" ON "SyncedCompanyLocation"("companyId");

-- CreateIndex
CREATE INDEX "SyncedVariant_shopDomain_idx" ON "SyncedVariant"("shopDomain");

-- CreateIndex
CREATE INDEX "SyncedVariant_productId_idx" ON "SyncedVariant"("productId");

-- CreateIndex
CREATE INDEX "PackRule_shopDomain_companyId_variantId_idx" ON "PackRule"("shopDomain", "companyId", "variantId");

-- CreateIndex
CREATE INDEX "PackRule_shopDomain_productId_idx" ON "PackRule"("shopDomain", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizationJob_idempotencyKey_key" ON "NormalizationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NormalizationJob_shopDomain_orderId_idx" ON "NormalizationJob"("shopDomain", "orderId");

-- CreateIndex
CREATE INDEX "NormalizationJob_status_idx" ON "NormalizationJob"("status");

-- CreateIndex
CREATE INDEX "NormalizationEvent_normalizationJobId_idx" ON "NormalizationEvent"("normalizationJobId");

-- CreateIndex
CREATE INDEX "OutboundDelivery_normalizationJobId_idx" ON "OutboundDelivery"("normalizationJobId");

-- CreateIndex
CREATE INDEX "OutboundDelivery_deliveryStatus_idx" ON "OutboundDelivery"("deliveryStatus");

-- CreateIndex
CREATE INDEX "RuleImportJob_shopDomain_idx" ON "RuleImportJob"("shopDomain");

-- AddForeignKey
ALTER TABLE "SyncedCompanyLocation" ADD CONSTRAINT "SyncedCompanyLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "SyncedCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizationEvent" ADD CONSTRAINT "NormalizationEvent_normalizationJobId_fkey" FOREIGN KEY ("normalizationJobId") REFERENCES "NormalizationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundDelivery" ADD CONSTRAINT "OutboundDelivery_normalizationJobId_fkey" FOREIGN KEY ("normalizationJobId") REFERENCES "NormalizationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

