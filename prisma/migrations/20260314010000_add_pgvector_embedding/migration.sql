-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "photos" ADD COLUMN "embedding" vector(1024);

-- CreateIndex
CREATE INDEX "photos_embedding_idx" ON "photos" USING hnsw ("embedding" vector_cosine_ops);
