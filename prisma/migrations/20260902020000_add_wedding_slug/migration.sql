-- AlterTable
ALTER TABLE "Wedding" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Wedding_slug_key" ON "Wedding"("slug");
