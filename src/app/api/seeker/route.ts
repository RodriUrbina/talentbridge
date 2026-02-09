import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCv } from "@/lib/claude";
import { searchSkills, searchOccupations, getOccupationDetails } from "@/lib/esco";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, cvText } = body;

    if (!cvText) {
      return NextResponse.json({ error: "cvText is required" }, { status: 400 });
    }

    // 1. Parse CV with Claude
    const parsed = await parseCv(cvText);

    // 2. Map raw skills to ESCO skills
    const escoSkills: { uri: string; title: string; skillType?: string }[] = [];

    for (const rawSkill of parsed.rawSkills) {
      const results = await searchSkills(rawSkill);
      if (results.length > 0) {
        escoSkills.push({
          uri: results[0].uri,
          title: results[0].title,
        });
      }
    }

    // Also map job titles to occupations and expand their skills
    for (const jobTitle of parsed.jobTitles) {
      const occupations = await searchOccupations(jobTitle);
      if (occupations.length > 0) {
        const occupation = await getOccupationDetails(occupations[0].uri);
        for (const s of [...occupation.essentialSkills, ...occupation.optionalSkills]) {
          escoSkills.push({
            uri: s.uri,
            title: s.title,
            skillType: s.skillType,
          });
        }
      }
    }

    // 3. Deduplicate skills by URI
    const uniqueSkills = Array.from(
      new Map(escoSkills.map((s) => [s.uri, s])).values()
    );

    // 4. Create user + seeker profile + skills in one transaction
    const user = await prisma.user.create({
      data: {
        name: name || "Anonymous Seeker",
        email: email || `seeker-${Date.now()}@talentbridge.local`,
        role: "SEEKER",
        seeker: {
          create: {
            cvText,
            jobTitles: parsed.jobTitles,
            education: parsed.education,
            skills: {
              create: uniqueSkills.map((s) => ({
                escoUri: s.uri,
                title: s.title,
                skillType: s.skillType,
              })),
            },
          },
        },
      },
      include: {
        seeker: {
          include: { skills: true },
        },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Seeker creation error:", error);
    return NextResponse.json(
      { error: "Failed to create seeker profile" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const seekers = await prisma.seekerProfile.findMany({
      include: { user: true, skills: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(seekers);
  } catch (error) {
    console.error("Seeker list error:", error);
    return NextResponse.json(
      { error: "Failed to list seekers" },
      { status: 500 }
    );
  }
}
