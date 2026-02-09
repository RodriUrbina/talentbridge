import { computeTitleSimilarity } from "./esco";

// ---------- Legacy interface (kept for backward compat) ----------

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

// ---------- Enhanced matching ----------

export interface SeekerSkillInput {
  uri: string;
  title: string;
  proficiency: number; // 1-5
  source: string;      // "explicit" | "inferred"
}

export interface JobSkillInput {
  uri: string;
  title: string;
  isEssential: boolean;
}

export interface FuzzyMatchDetail {
  seekerUri: string;
  seekerTitle: string;
  jobUri: string;
  jobTitle: string;
  similarity: number;
  type: "co-occurrence" | "title-similarity";
}

export interface ScoreBreakdown {
  essentialExact: number;
  essentialFuzzy: number;
  optionalExact: number;
  optionalFuzzy: number;
  proficiencyBonus: number;
  maxPossible: number;
}

export interface EnhancedMatchResult {
  matchScore: number;           // 0-100 composite
  seekerRelevance: number;      // 0-100 bidirectional
  matchedEssential: string[];   // Exact essential URIs
  missingEssential: string[];   // Missing essential URIs
  matchedOptional: string[];    // Exact optional URIs
  missingOptional: string[];    // Missing optional URIs
  fuzzyMatches: FuzzyMatchDetail[];
  scoreBreakdown: ScoreBreakdown;
  // Human-readable title versions
  matchedTitles: string[];
  missingTitles: string[];
  fuzzyTitles: { seekerTitle: string; jobTitle: string; similarity: number }[];
  optionalMatchedTitles: string[];
  optionalMissingTitles: string[];
}

const PROFICIENCY_MULTIPLIER = [0, 0.70, 0.85, 1.00, 1.10, 1.15]; // indexed 0-5 (0 unused)
const SOURCE_MULTIPLIER: Record<string, number> = {
  explicit: 1.0,
  inferred: 0.85,
};

const CO_OCCURRENCE_THRESHOLD = 0.15;
const TITLE_SIMILARITY_THRESHOLD = 0.4;

export function matchSkillsEnhanced(
  seekerSkills: SeekerSkillInput[],
  jobSkills: JobSkillInput[],
  coOccurrenceMap: Map<string, Map<string, number>>,
  titleMap: Record<string, string> // combined URI→title map
): EnhancedMatchResult {
  const seekerUriSet = new Set(seekerSkills.map((s) => s.uri));
  const seekerByUri = new Map(seekerSkills.map((s) => [s.uri, s]));

  const essentialSkills = jobSkills.filter((s) => s.isEssential);
  const optionalSkills = jobSkills.filter((s) => !s.isEssential);

  const fuzzyMatches: FuzzyMatchDetail[] = [];

  // Score a set of job skills against seeker skills
  function scoreSkillSet(skills: JobSkillInput[]): {
    exactUris: string[];
    missingUris: string[];
    totalScore: number;
    profMultiplierSum: number;
    matchedCount: number;
  } {
    const exactUris: string[] = [];
    const missingUris: string[] = [];
    let totalScore = 0;
    let profMultiplierSum = 0;
    let matchedCount = 0;

    for (const jobSkill of skills) {
      if (seekerUriSet.has(jobSkill.uri)) {
        // Exact match
        exactUris.push(jobSkill.uri);
        const seeker = seekerByUri.get(jobSkill.uri)!;
        const sourceMult = SOURCE_MULTIPLIER[seeker.source] ?? 1.0;
        const profMult = PROFICIENCY_MULTIPLIER[seeker.proficiency] ?? 1.0;
        totalScore += 1.0 * sourceMult * profMult;
        profMultiplierSum += profMult;
        matchedCount++;
      } else {
        // Try fuzzy matching
        const bestFuzzy = findBestFuzzyMatch(jobSkill, seekerSkills, coOccurrenceMap);
        if (bestFuzzy) {
          fuzzyMatches.push(bestFuzzy.detail);
          const seeker = seekerByUri.get(bestFuzzy.detail.seekerUri)!;
          const sourceMult = SOURCE_MULTIPLIER[seeker.source] ?? 1.0;
          const profMult = PROFICIENCY_MULTIPLIER[seeker.proficiency] ?? 1.0;
          totalScore += bestFuzzy.credit * sourceMult * profMult;
          profMultiplierSum += profMult;
          matchedCount++;
        } else {
          missingUris.push(jobSkill.uri);
        }
      }
    }

    return { exactUris, missingUris, totalScore, profMultiplierSum, matchedCount };
  }

  const essential = scoreSkillSet(essentialSkills);
  const optional = scoreSkillSet(optionalSkills);

  // Normalization
  const essentialNormalized =
    essentialSkills.length > 0 ? essential.totalScore / essentialSkills.length : 0;
  const optionalNormalized =
    optionalSkills.length > 0 ? optional.totalScore / optionalSkills.length : 0;

  // Proficiency bonus
  const totalSkills = essentialSkills.length + optionalSkills.length;
  const totalMatchedCount = essential.matchedCount + optional.matchedCount;
  const totalProfSum = essential.profMultiplierSum + optional.profMultiplierSum;
  const rawProfBonus =
    totalMatchedCount > 0
      ? (totalProfSum - totalMatchedCount) / Math.max(totalSkills, 1)
      : 0;
  const proficiencyBonus = Math.max(0, Math.min(0.05, rawProfBonus));

  const matchScore = Math.round(
    (essentialNormalized * 0.80 + optionalNormalized * 0.15 + proficiencyBonus * 0.05) * 100
  );

  // Bidirectional: seekerRelevance
  const allJobUris = new Set(jobSkills.map((s) => s.uri));
  const allJobTitles = new Map(jobSkills.map((s) => [s.uri, s.title]));
  let relevantSeekerCount = 0;
  for (const seeker of seekerSkills) {
    if (allJobUris.has(seeker.uri)) {
      relevantSeekerCount++;
      continue;
    }
    // Check fuzzy relevance
    const coOcc = coOccurrenceMap.get(seeker.uri);
    if (coOcc) {
      for (const [jobUri, jaccard] of coOcc) {
        if (allJobUris.has(jobUri) && jaccard >= CO_OCCURRENCE_THRESHOLD) {
          relevantSeekerCount++;
          break;
        }
      }
      if (relevantSeekerCount > seekerSkills.indexOf(seeker) + 1) continue;
    }
    // Title similarity
    for (const [jobUri, jobTitle] of allJobTitles) {
      const sim = computeTitleSimilarity(seeker.title, jobTitle);
      if (sim >= TITLE_SIMILARITY_THRESHOLD) {
        relevantSeekerCount++;
        break;
      }
    }
  }
  const seekerRelevance =
    seekerSkills.length > 0
      ? Math.round((relevantSeekerCount / seekerSkills.length) * 100)
      : 0;

  // Build score breakdown
  const essentialExactScore = essential.exactUris.length;
  const essentialFuzzyScore = fuzzyMatches.filter((f) =>
    essentialSkills.some((s) => s.uri === f.jobUri)
  ).length;
  const optionalExactScore = optional.exactUris.length;
  const optionalFuzzyScore = fuzzyMatches.filter((f) =>
    optionalSkills.some((s) => s.uri === f.jobUri)
  ).length;

  const resolveUri = (uri: string) => titleMap[uri] || uri;

  return {
    matchScore: Math.max(0, Math.min(100, matchScore)),
    seekerRelevance,
    matchedEssential: essential.exactUris,
    missingEssential: essential.missingUris,
    matchedOptional: optional.exactUris,
    missingOptional: optional.missingUris,
    fuzzyMatches,
    scoreBreakdown: {
      essentialExact: essentialExactScore,
      essentialFuzzy: essentialFuzzyScore,
      optionalExact: optionalExactScore,
      optionalFuzzy: optionalFuzzyScore,
      proficiencyBonus: Math.round(proficiencyBonus * 100) / 100,
      maxPossible: totalSkills,
    },
    matchedTitles: essential.exactUris.map(resolveUri),
    missingTitles: essential.missingUris.map(resolveUri),
    fuzzyTitles: fuzzyMatches.map((f) => ({
      seekerTitle: f.seekerTitle,
      jobTitle: f.jobTitle,
      similarity: f.similarity,
    })),
    optionalMatchedTitles: optional.exactUris.map(resolveUri),
    optionalMissingTitles: optional.missingUris.map(resolveUri),
  };
}

function findBestFuzzyMatch(
  jobSkill: JobSkillInput,
  seekerSkills: SeekerSkillInput[],
  coOccurrenceMap: Map<string, Map<string, number>>
): { credit: number; detail: FuzzyMatchDetail } | null {
  let bestCredit = 0;
  let bestDetail: FuzzyMatchDetail | null = null;

  for (const seeker of seekerSkills) {
    // Co-occurrence
    const coOcc = coOccurrenceMap.get(seeker.uri)?.get(jobSkill.uri) ?? 0;
    const coOccCredit = coOcc >= CO_OCCURRENCE_THRESHOLD ? coOcc * 0.5 : 0;

    // Title similarity
    const titleSim = computeTitleSimilarity(seeker.title, jobSkill.title);
    const titleCredit = titleSim >= TITLE_SIMILARITY_THRESHOLD ? titleSim * 0.3 : 0;

    const credit = Math.max(coOccCredit, titleCredit);
    if (credit > bestCredit) {
      bestCredit = credit;
      bestDetail = {
        seekerUri: seeker.uri,
        seekerTitle: seeker.title,
        jobUri: jobSkill.uri,
        jobTitle: jobSkill.title,
        similarity: credit === coOccCredit ? coOcc : titleSim,
        type: credit === coOccCredit ? "co-occurrence" : "title-similarity",
      };
    }
  }

  return bestDetail ? { credit: bestCredit, detail: bestDetail } : null;
}
