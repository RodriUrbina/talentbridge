import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOccupationDetails } from "@/lib/esco";
import { generateJobDescription } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, email, occupationUri } = body;

    if (!occupationUri) {
      return NextResponse.json({ error: "occupationUri is required" }, { status: 400 });
    }

    // Get full occupation details with skills
    const occupation = await getOccupationDetails(occupationUri);

    // 3. Find or create user, then add job posting
    const resolvedEmail = email || `recruiter-${Date.now()}@talentbridge.local`;

    let user = await prisma.user.findUnique({
      where: { email: resolvedEmail },
      include: { recruiter: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: company || "Anonymous Recruiter",
          email: resolvedEmail,
          role: "RECRUITER",
          recruiter: { create: { company: company || null } },
        },
        include: { recruiter: true },
      });
    } else if (!user.recruiter) {
      await prisma.recruiterProfile.create({
        data: { userId: user.id, company: company || null },
      });
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { recruiter: true },
      });
    }

    // Create the job posting under the recruiter profile
    const jobPosting = await prisma.jobPosting.create({
      data: {
        recruiterProfileId: user!.recruiter!.id,
        title: occupation.title,
        escoOccupationUri: occupation.uri,
        skills: {
          create: [
            ...occupation.essentialSkills.map((s) => ({
              escoUri: s.uri,
              title: s.title,
              skillType: s.skillType,
              isEssential: true,
            })),
            ...occupation.optionalSkills.map((s) => ({
              escoUri: s.uri,
              title: s.title,
              skillType: s.skillType,
              isEssential: false,
            })),
          ],
        },
      },
      include: { skills: true },
    });

    // Generate AI job description
    const essentialTitles = occupation.essentialSkills.map((s) => s.title);
    const optionalTitles = occupation.optionalSkills.map((s) => s.title);
    const description = await generateJobDescription(
      occupation.title,
      essentialTitles,
      optionalTitles
    );
    await prisma.jobPosting.update({
      where: { id: jobPosting.id },
      data: { description },
    });

    const result = await prisma.user.findUnique({
      where: { id: user!.id },
      include: {
        recruiter: {
          include: {
            jobPostings: { include: { skills: true } },
          },
        },
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Recruiter creation error:", error);
    return NextResponse.json(
      { error: "Failed to create job posting" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const postings = await prisma.jobPosting.findMany({
      include: {
        skills: true,
        recruiterProfile: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(postings);
  } catch (error) {
    console.error("Job posting list error:", error);
    return NextResponse.json(
      { error: "Failed to list job postings" },
      { status: 500 }
    );
  }
}
