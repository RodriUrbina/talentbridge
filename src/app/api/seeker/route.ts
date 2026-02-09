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

    // 1. Parse CV with Claude (now includes proficiency)
    const parsed = await parseCv(cvText);

    // Build proficiency lookup from Claude's analysis
    const proficiencyMap = new Map<string, number>();
    for (const sp of parsed.skillsWithProficiency) {
      const prof = Math.max(1, Math.min(5, Math.round(sp.proficiency || 3)));
      proficiencyMap.set(sp.name.toLowerCase(), prof);
    }

    // 2. Map raw skills to ESCO skills (source: "explicit")
    const escoSkills: { uri: string; title: string; skillType?: string; proficiency: number; source: string }[] = [];

    for (const rawSkill of parsed.rawSkills) {
      try {
        const results = await searchSkills(rawSkill);
        if (results.length > 0) {
          const prof = proficiencyMap.get(rawSkill.toLowerCase()) ?? 3;
          escoSkills.push({
            uri: results[0].uri,
            title: results[0].title,
            proficiency: prof,
            source: "explicit",
          });
        }
      } catch {
        console.warn(`Skipping skill "${rawSkill}" — ESCO API error`);
      }
    }

    // 3. Also map job titles to occupations and expand their essential skills (source: "inferred")
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
              proficiency: 3,
              source: "inferred",
            });
          }
        }
      } catch {
        console.warn(`Skipping occupation "${jobTitle}" — ESCO API error`);
      }
    }

    // 4. Deduplicate skills by URI (prefer explicit over inferred)
    const skillMap = new Map<string, typeof escoSkills[number]>();
    for (const s of escoSkills) {
      const existing = skillMap.get(s.uri);
      if (!existing || (s.source === "explicit" && existing.source === "inferred")) {
        skillMap.set(s.uri, s);
      }
    }
    const uniqueSkills = Array.from(skillMap.values());

    // 5. Create user + seeker profile + skills in one transaction
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
                proficiency: s.proficiency,
                source: s.source,
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
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : "";
    return NextResponse.json(
      { error: "Failed to create seeker profile", detail: message, stack },
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
