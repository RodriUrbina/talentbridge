import { NextRequest, NextResponse } from "next/server";
import { searchTrainingPrograms } from "@/lib/training-search";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { missingSkills, targetOccupation } = body;

    if (!missingSkills || !targetOccupation) {
      return NextResponse.json(
        { error: "missingSkills and targetOccupation are required" },
        { status: 400 }
      );
    }

    const programs = await searchTrainingPrograms(missingSkills, targetOccupation);

    return NextResponse.json({ programs });
  } catch (error) {
    console.error("Training program search error:", error);
    return NextResponse.json(
      { error: "Failed to search training programs" },
      { status: 500 }
    );
  }
}
