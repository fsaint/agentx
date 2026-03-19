-- DropIndex
DROP INDEX "Instance_userId_key";

-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "gatewayToken" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'My Agent',
ADD COLUMN     "soulMd" TEXT;

-- CreateIndex
CREATE INDEX "Instance_userId_idx" ON "Instance"("userId");
