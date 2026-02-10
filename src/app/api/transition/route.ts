import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOccupationDetails, batchCoOccurrence } from "@/lib/esco";
import { matchSkillsEnhanced, SeekerSkillInput, JobSkillInput } from "@/lib/matching";
import { explainTransitionGaps, EnhancedGapContext } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seekerProfileId, occupationUri } = body;

    if (!seekerProfileId || !occupationUri) {
      return NextResponse.json(
        { error: "seekerProfileId and occupationUri are required" },
        { status: 400 }
      );
    }

    // Fetch seeker profile + skills
    const seeker = await prisma.seekerProfile.findUnique({
      where: { id: seekerProfileId },
      include: { user: true, skills: true },
    });

    if (!seeker) {
      return NextResponse.json({ error: "Seeker not found" }, { status: 404 });
    }

    // Fetch ESCO occupation details (essential + optional skills)
    const occupation = await getOccupationDetails(occupationUri);

    // Convert occupation skills to JobSkillInput[]
    const jobSkillInputs: JobSkillInput[] = [
      ...occupation.essentialSkills.map((s) => ({
        uri: s.uri,
        title: s.title,
        isEssential: true,
      })),
      ...occupation.optionalSkills.map((s) => ({
        uri: s.uri,
        title: s.title,
        isEssential: false,
      })),
    ];

    // Build URI→title map
    const titleMap: Record<string, string> = {};
    for (const s of seeker.skills) {
      titleMap[s.escoUri] = s.title;
    }
    for (const s of jobSkillInputs) {
      titleMap[s.uri] = s.title;
    }

    // Build seeker skill inputs
    const seekerSkillInputs: SeekerSkillInput[] = seeker.skills.map((s: { escoUri: string; title: string; proficiency: number; source: string }) => ({
      uri: s.escoUri,
      title: s.title,
      proficiency: s.proficiency,
      source: s.source,
    }));

    // Compute co-occurrence map
    const seekerUris = seekerSkillInputs.map((s) => s.uri);
    const jobUris = jobSkillInputs.map((s) => s.uri);
    const coOccurrenceMap = await batchCoOccurrence(seekerUris, jobUris);

    // Run enhanced matching (reuse existing engine unchanged)
    const result = matchSkillsEnhanced(seekerSkillInputs, jobSkillInputs, coOccurrenceMap, titleMap);

    // Build enhanced context for AI coaching
    const enhancedContext: EnhancedGapContext = {
      fuzzyMatches: result.fuzzyTitles,
      optionalMatchedTitles: result.optionalMatchedTitles,
      seekerRelevance: result.seekerRelevance,
    };

    // Generate transition coaching
    const coaching = await explainTransitionGaps(
      seeker.jobTitles,
      occupation.title,
      result.matchedTitles,
      result.missingTitles,
      enhancedContext
    );

    return NextResponse.json({
      matchScore: result.matchScore,
      seekerRelevance: result.seekerRelevance,
      matchedTitles: result.matchedTitles,
      missingTitles: result.missingTitles,
      fuzzyTitles: result.fuzzyTitles,
      optionalMatchedTitles: result.optionalMatchedTitles,
      optionalMissingTitles: result.optionalMissingTitles,
      scoreBreakdown: result.scoreBreakdown,
      coaching,
      occupationTitle: occupation.title,
      seekerName: seeker.user.name,
    });
  } catch (error) {
    console.error("Transition analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze transition" },
      { status: 500 }
    );
  }
}
