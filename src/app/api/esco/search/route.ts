import { NextRequest, NextResponse } from "next/server";
import { searchOccupations, searchSkills } from "@/lib/esco";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("text") || req.nextUrl.searchParams.get("q");
  const type = req.nextUrl.searchParams.get("type") || "occupation";

  if (!query) {
    return NextResponse.json({ error: "q parameter is required" }, { status: 400 });
  }

  try {
    const results =
      type === "skill" ? await searchSkills(query) : await searchOccupations(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error("ESCO search error:", error);
    return NextResponse.json(
      { error: "ESCO search failed" },
      { status: 500 }
    );
  }
}
