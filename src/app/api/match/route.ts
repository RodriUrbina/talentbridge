import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchSkills } from "@/lib/matching";
import { explainGaps, summarizeCandidate } from "@/lib/claude";

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
    const seekerTitleMap: Record<string, string> = {};
    for (const s of seeker.skills) {
      seekerTitleMap[s.escoUri] = s.title;
    }
    const jobTitleMap: Record<string, string> = {};
    for (const s of jobPosting.skills) {
      jobTitleMap[s.escoUri] = s.title;
    }

    // Check if match already exists
    const existing = await prisma.match.findUnique({
      where: {
        seekerProfileId_jobPostingId: { seekerProfileId, jobPostingId },
      },
    });

    // Resolve URI arrays to human-readable titles
    function resolveUris(uris: string[]) {
      return uris.map((uri) => jobTitleMap[uri] || seekerTitleMap[uri] || uri);
    }

    if (existing) {
      const matchedTitles = resolveUris(existing.matchedSkills);
      const missingTitles = resolveUris(existing.missingSkills);

      const [coaching, summary] = await Promise.all([
        explainGaps(matchedTitles, missingTitles, jobPosting.title),
        summarizeCandidate(
          seeker.user.name || "Anonymous Seeker",
          seeker.jobTitles,
          existing.matchScore,
          matchedTitles,
          missingTitles,
          jobPosting.title
        ),
      ]);

      return NextResponse.json({
        ...existing,
        matchedTitles,
        missingTitles,
        coaching,
        summary,
        seekerName: seeker.user.name,
        jobTitle: jobPosting.title,
      });
    }

    // Only match against essential skills
    const essentialSkills = jobPosting.skills.filter((s) => s.isEssential);
    const essentialUris = essentialSkills.map((s) => s.escoUri);
    const seekerUris = seeker.skills.map((s) => s.escoUri);

    const result = matchSkills(seekerUris, essentialUris, seekerTitleMap, jobTitleMap);

    // Store the match
    const match = await prisma.match.create({
      data: {
        seekerProfileId,
        jobPostingId,
        matchScore: result.matchScore,
        matchedSkills: result.matchedSkills,
        missingSkills: result.missingSkills,
      },
    });

    // Generate AI insights in parallel
    const [coaching, summary] = await Promise.all([
      explainGaps(result.matchedTitles, result.missingTitles, jobPosting.title),
      summarizeCandidate(
        seeker.user.name || "Anonymous Seeker",
        seeker.jobTitles,
        result.matchScore,
        result.matchedTitles,
        result.missingTitles,
        jobPosting.title
      ),
    ]);

    return NextResponse.json({
      ...match,
      matchedTitles: result.matchedTitles,
      missingTitles: result.missingTitles,
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
