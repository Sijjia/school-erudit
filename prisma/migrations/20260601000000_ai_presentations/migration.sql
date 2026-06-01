-- CreateTable
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" VARCHAR(500) NOT NULL,
    "subject" VARCHAR(200),
    "gradeLevel" VARCHAR(100),
    "emphasis" VARCHAR(500),
    "slides" JSONB NOT NULL,
    "model" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Presentation_authorId_idx" ON "Presentation"("authorId");
