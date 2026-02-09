-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "fuzzyMatches" JSONB,
ADD COLUMN     "optionalMatched" TEXT[],
ADD COLUMN     "optionalMissing" TEXT[],
ADD COLUMN     "scoreBreakdown" JSONB,
ADD COLUMN     "seekerRelevance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SeekerSkill" ADD COLUMN     "proficiency" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'inferred';
