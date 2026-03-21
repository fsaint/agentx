-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "modelCredentials" TEXT,
ADD COLUMN     "modelName" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
ADD COLUMN     "modelProvider" TEXT NOT NULL DEFAULT 'anthropic';
