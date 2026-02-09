import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchSkillsEnhanced, SeekerSkillInput, JobSkillInput } from "@/lib/matching";
import { batchCoOccurrence } from "@/lib/esco";
import { explainGaps, summarizeCandidate, EnhancedGapContext } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seekerProfileId, jobPostingId } = body;

    if (!seekerProfileId || !jobPostingId) {
      return NextResponse.json(
        { error: "seekerProfileId and jobPostingId are required" },
        { status: 400 }
      );
    }

    // Fetch seeker skills and job posting skills
    const [seeker, jobPosting] = await Promise.all([
      prisma.seekerProfile.findUnique({
        where: { id: seekerProfileId },
        include: { user: true, skills: true },
      }),
      prisma.jobPosting.findUnique({
        where: { id: jobPostingId },
        include: { skills: true },
      }),
    ]);

    if (!seeker) {
      return NextResponse.json({ error: "Seeker not found" }, { status: 404 });
    }
    if (!jobPosting) {
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    // Build URI→title maps
    const titleMap: Record<string, string> = {};
    for (const s of seeker.skills) {
      titleMap[s.escoUri] = s.title;
    }
    for (const s of jobPosting.skills) {
      titleMap[s.escoUri] = s.title;
    }

    // Check if match already exists
    const existing = await prisma.match.findUnique({
      where: {
        seekerProfileId_jobPostingId: { seekerProfileId, jobPostingId },
      },
    });

    if (existing) {
      // Resolve titles for cached match
      const matchedTitles = existing.matchedSkills.map((uri: string) => titleMap[uri] || uri);
      const missingTitles = existing.missingSkills.map((uri: string) => titleMap[uri] || uri);
      const optionalMatchedTitles = (existing.optionalMatched || []).map((uri: string) => titleMap[uri] || uri);
      const optionalMissingTitles = (existing.optionalMissing || []).map((uri: string) => titleMap[uri] || uri);
      const fuzzyMatches = (existing.fuzzyMatches as FuzzyMatchJson[] | null) || [];
      const scoreBreakdown = existing.scoreBreakdown as ScoreBreakdownJson | null;

      const enhancedContext: EnhancedGapContext = {
        fuzzyMatches: fuzzyMatches.map((f) => ({
          seekerTitle: f.seekerTitle,
          jobTitle: f.jobTitle,
          similarity: f.similarity,
        })),
        optionalMatchedTitles,
        seekerRelevance: existing.seekerRelevance,
      };

      const [coaching, summary] = await Promise.all([
        explainGaps(matchedTitles, missingTitles, jobPosting.title, enhancedContext),
        summarizeCandidate(
          seeker.user.name || "Anonymous Seeker",
          seeker.jobTitles,
          existing.matchScore,
          matchedTitles,
          missingTitles,
          jobPosting.title,
          enhancedContext
        ),
      ]);

      return NextResponse.json({
        ...existing,
        matchedTitles,
        missingTitles,
        optionalMatchedTitles,
        optionalMissingTitles,
        fuzzyTitles: fuzzyMatches.map((f) => ({
          seekerTitle: f.seekerTitle,
          jobTitle: f.jobTitle,
          similarity: f.similarity,
        })),
        scoreBreakdown,
        coaching,
        summary,
        seekerName: seeker.user.name,
        jobTitle: jobPosting.title,
      });
    }

    // Build enhanced input arrays
    const seekerSkillInputs: SeekerSkillInput[] = seeker.skills.map((s: { escoUri: string; title: string; proficiency: number; source: string }) => ({
      uri: s.escoUri,
      title: s.title,
      proficiency: s.proficiency,
      source: s.source,
    }));

    const jobSkillInputs: JobSkillInput[] = jobPosting.skills.map((s: { escoUri: string; title: string; isEssential: boolean }) => ({
      uri: s.escoUri,
      title: s.title,
      isEssential: s.isEssential,
    }));

    // Compute co-occurrence map
    const seekerUris = seekerSkillInputs.map((s) => s.uri);
    const jobUris = jobSkillInputs.map((s) => s.uri);
    const coOccurrenceMap = await batchCoOccurrence(seekerUris, jobUris);

    // Run enhanced matching
    const result = matchSkillsEnhanced(seekerSkillInputs, jobSkillInputs, coOccurrenceMap, titleMap);

    // Store the match
    const match = await prisma.match.create({
      data: {
        seekerProfileId,
        jobPostingId,
        matchScore: result.matchScore,
        matchedSkills: result.matchedEssential,
        missingSkills: result.missingEssential,
        seekerRelevance: result.seekerRelevance,
        fuzzyMatches: result.fuzzyMatches,
        optionalMatched: result.matchedOptional,
        optionalMissing: result.missingOptional,
        scoreBreakdown: result.scoreBreakdown,
      },
    });

    // Build enhanced context for AI insights
    const enhancedContext: EnhancedGapContext = {
      fuzzyMatches: result.fuzzyTitles,
      optionalMatchedTitles: result.optionalMatchedTitles,
      seekerRelevance: result.seekerRelevance,
    };

    // Generate AI insights in parallel
    const [coaching, summary] = await Promise.all([
      explainGaps(result.matchedTitles, result.missingTitles, jobPosting.title, enhancedContext),
      summarizeCandidate(
        seeker.user.name || "Anonymous Seeker",
        seeker.jobTitles,
        result.matchScore,
        result.matchedTitles,
        result.missingTitles,
        jobPosting.title,
        enhancedContext
      ),
    ]);

    return NextResponse.json({
      ...match,
      matchedTitles: result.matchedTitles,
      missingTitles: result.missingTitles,
      fuzzyTitles: result.fuzzyTitles,
      optionalMatchedTitles: result.optionalMatchedTitles,
      optionalMissingTitles: result.optionalMissingTitles,
      scoreBreakdown: result.scoreBreakdown,
      seekerRelevance: result.seekerRelevance,
      coaching,
      summary,
      seekerName: seeker.user.name,
      jobTitle: jobPosting.title,
    }, { status: 201 });
  } catch (error) {
    console.error("Match creation error:", error);
    return NextResponse.json(
      { error: "Failed to create match" },
      { status: 500 }
    );
  }
}

// JSON types for reading stored fuzzy matches / breakdown
interface FuzzyMatchJson {
  seekerUri: string;
  seekerTitle: string;
  jobUri: string;
  jobTitle: string;
  similarity: number;
  type: string;
}

interface ScoreBreakdownJson {
  essentialExact: number;
  essentialFuzzy: number;
  optionalExact: number;
  optionalFuzzy: number;
  proficiencyBonus: number;
  maxPossible: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seekerProfileId = searchParams.get("seekerProfileId");
    const jobPostingId = searchParams.get("jobPostingId");

    const where: Record<string, string> = {};
    if (seekerProfileId) where.seekerProfileId = seekerProfileId;
    if (jobPostingId) where.jobPostingId = jobPostingId;

    const matches = await prisma.match.findMany({
      where,
      include: {
        seekerProfile: { include: { user: true, skills: true } },
        jobPosting: { include: { skills: true, recruiterProfile: { include: { user: true } } } },
      },
      orderBy: { matchScore: "desc" },
    });

    return NextResponse.json(matches);
  } catch (error) {
    console.error("Match list error:", error);
    return NextResponse.json(
      { error: "Failed to list matches" },
      { status: 500 }
    );
  }
}
