export interface MatchResult {
  matchScore: number;
  matchedSkills: string[];  // ESCO URIs
  missingSkills: string[];  // ESCO URIs
  matchedTitles: string[];
  missingTitles: string[];
}

export function matchSkills(
  seekerSkillUris: string[],
  jobSkillUris: string[],
  seekerTitleMap: Record<string, string>,
  jobTitleMap: Record<string, string>
): MatchResult {
  const seekerSet = new Set(seekerSkillUris);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const uri of jobSkillUris) {
    if (seekerSet.has(uri)) {
      matchedSkills.push(uri);
    } else {
      missingSkills.push(uri);
    }
  }

  const matchScore =
    jobSkillUris.length > 0
      ? Math.round((matchedSkills.length / jobSkillUris.length) * 100)
      : 0;

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    matchedTitles: matchedSkills.map((uri) => jobTitleMap[uri] || seekerTitleMap[uri] || uri),
    missingTitles: missingSkills.map((uri) => jobTitleMap[uri] || uri),
  };
}
