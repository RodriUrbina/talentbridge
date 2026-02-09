import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const posting = await prisma.jobPosting.findUnique({
      where: { id },
      include: {
        skills: true,
        recruiterProfile: { include: { user: true } },
        matches: {
          include: {
            seekerProfile: { include: { user: true, skills: true } },
          },
        },
      },
    });

    if (!posting) {
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    return NextResponse.json(posting);
  } catch (error) {
    console.error("Job posting fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch job posting" },
      { status: 500 }
    );
  }
}
