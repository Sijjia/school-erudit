-- CreateTable
CREATE TABLE "AgentEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT,
    "studentId" TEXT,
    "classId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentItem" (
    "id" TEXT NOT NULL,
    "ruleKey" TEXT,
    "eventId" TEXT,
    "forUserId" TEXT,
    "forRole" TEXT,
    "studentId" TEXT,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "AgentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActionLog" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "action" TEXT NOT NULL,
    "byUserId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentRule_key_key" ON "AgentRule"("key");

-- CreateIndex
CREATE INDEX "AgentEvent_type_processedAt_idx" ON "AgentEvent"("type", "processedAt");

-- CreateIndex
CREATE INDEX "AgentItem_forUserId_status_idx" ON "AgentItem"("forUserId", "status");

-- CreateIndex
CREATE INDEX "AgentItem_forRole_status_idx" ON "AgentItem"("forRole", "status");

-- CreateIndex
CREATE INDEX "AgentItem_studentId_idx" ON "AgentItem"("studentId");
