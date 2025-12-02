-- CreateTable
CREATE TABLE "RebalancingStrategy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "driftThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RebalancingStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetClassTarget" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "targetPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetClassTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSubClassTarget" (
    "id" TEXT NOT NULL,
    "assetClassTargetId" TEXT NOT NULL,
    "assetSubClass" "AssetSubClass" NOT NULL,
    "targetPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetSubClassTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebalancingExclusion" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbolProfileId" TEXT NOT NULL,
    "excludeFromCalculation" BOOLEAN NOT NULL DEFAULT true,
    "neverSell" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RebalancingExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebalancingEvent" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioValue" DOUBLE PRECISION NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "suggestionsData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REVIEWED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RebalancingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RebalancingStrategy_userId_idx" ON "RebalancingStrategy"("userId");

-- CreateIndex
CREATE INDEX "AssetClassTarget_strategyId_idx" ON "AssetClassTarget"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetClassTarget_strategyId_assetClass_key" ON "AssetClassTarget"("strategyId", "assetClass");

-- CreateIndex
CREATE INDEX "AssetSubClassTarget_assetClassTargetId_idx" ON "AssetSubClassTarget"("assetClassTargetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSubClassTarget_assetClassTargetId_assetSubClass_key" ON "AssetSubClassTarget"("assetClassTargetId", "assetSubClass");

-- CreateIndex
CREATE INDEX "RebalancingExclusion_strategyId_idx" ON "RebalancingExclusion"("strategyId");

-- CreateIndex
CREATE INDEX "RebalancingExclusion_userId_idx" ON "RebalancingExclusion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RebalancingExclusion_strategyId_symbolProfileId_key" ON "RebalancingExclusion"("strategyId", "symbolProfileId");

-- CreateIndex
CREATE INDEX "RebalancingEvent_strategyId_idx" ON "RebalancingEvent"("strategyId");

-- CreateIndex
CREATE INDEX "RebalancingEvent_userId_idx" ON "RebalancingEvent"("userId");

-- AddForeignKey
ALTER TABLE "RebalancingStrategy" ADD CONSTRAINT "RebalancingStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetClassTarget" ADD CONSTRAINT "AssetClassTarget_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "RebalancingStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubClassTarget" ADD CONSTRAINT "AssetSubClassTarget_assetClassTargetId_fkey" FOREIGN KEY ("assetClassTargetId") REFERENCES "AssetClassTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalancingExclusion" ADD CONSTRAINT "RebalancingExclusion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "RebalancingStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalancingExclusion" ADD CONSTRAINT "RebalancingExclusion_symbolProfileId_fkey" FOREIGN KEY ("symbolProfileId") REFERENCES "SymbolProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalancingEvent" ADD CONSTRAINT "RebalancingEvent_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "RebalancingStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

