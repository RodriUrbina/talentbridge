import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCv } from "@/lib/claude";
import { searchSkills, searchOccupations, getOccupationDetails } from "@/lib/esco";
import { extractText } from "unpdf";

export async function POST(req: NextRequest) {
  try {
    let name: string | undefined;
    let email: string | undefined;
    let cvText: string | undefined;
    let cvFileName: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = formData.get("name") as string | undefined;
      email = formData.get("email") as string | undefined;
      const pdfFile = formData.get("pdf") as File | null;

      if (!pdfFile) {
        return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
      }

      cvFileName = pdfFile.name;
      const buffer = await pdfFile.arrayBuffer();
      const result = await extractText(buffer);
      cvText = String(result.text);
    } else {
      const body = await req.json();
      name = body.name;
      email = body.email;
      cvText = body.cvText;
    }

    if (!cvText || !String(cvText).trim()) {
      return NextResponse.json({ error: "CV text is required" }, { status: 400 });
    }

    // 1. Parse CV with Claude
    const parsed = await parseCv(cvText);

    // 2. Map raw skills to ESCO skills
    const escoSkills: { uri: string; title: string; skillType?: string }[] = [];

    for (const rawSkill of parsed.rawSkills) {
      try {
        const results = await searchSkills(rawSkill);
        if (results.length > 0) {
          escoSkills.push({
            uri: results[0].uri,
            title: results[0].title,
          });
        }
      } catch {
        console.warn(`Skipping skill "${rawSkill}" — ESCO API error`);
      }
    }

    // Also map job titles to occupations and expand their essential skills only
    for (const jobTitle of parsed.jobTitles) {
      try {
        const occupations = await searchOccupations(jobTitle);
        if (occupations.length > 0) {
          const occupation = await getOccupationDetails(occupations[0].uri);
          for (const s of occupation.essentialSkills) {
            escoSkills.push({
              uri: s.uri,
              title: s.title,
              skillType: s.skillType,
            });
          }
        }
      } catch {
        console.warn(`Skipping occupation "${jobTitle}" — ESCO API error`);
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
            cvFileName: cvFileName || null,
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
