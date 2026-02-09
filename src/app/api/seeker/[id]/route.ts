import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const seeker = await prisma.seekerProfile.findUnique({
      where: { id },
      include: {
        user: true,
        skills: true,
        matches: true,
      },
    });

    if (!seeker) {
      return NextResponse.json({ error: "Seeker not found" }, { status: 404 });
    }

    return NextResponse.json(seeker);
  } catch (error) {
    console.error("Seeker fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch seeker" },
      { status: 500 }
    );
  }
}
