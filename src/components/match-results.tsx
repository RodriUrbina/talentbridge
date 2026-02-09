"use client";

import { SkillBadge } from "./skill-badge";

interface FuzzyTitle {
  seekerTitle: string;
  jobTitle: string;
  similarity: number;
}

interface ScoreBreakdown {
  essentialExact: number;
  essentialFuzzy: number;
  optionalExact: number;
  optionalFuzzy: number;
  proficiencyBonus: number;
  maxPossible: number;
}

interface MatchResultsProps {
  matchScore: number;
  seekerRelevance?: number;
  matchedTitles: string[];
  missingTitles: string[];
  fuzzyTitles?: FuzzyTitle[];
  optionalMatchedTitles?: string[];
  optionalMissingTitles?: string[];
  scoreBreakdown?: ScoreBreakdown;
  coaching?: string;
  summary?: string;
  seekerName?: string;
  jobTitle?: string;
  viewMode: "seeker" | "recruiter";
}

export function MatchResults({
  matchScore,
  seekerRelevance,
  matchedTitles,
  missingTitles,
  fuzzyTitles,
  optionalMatchedTitles,
  optionalMissingTitles,
  scoreBreakdown,
  coaching,
  summary,
  seekerName,
  jobTitle,
  viewMode,
}: MatchResultsProps) {
  const scoreColor =
    matchScore >= 70
      ? "text-green-600"
      : matchScore >= 40
        ? "text-yellow-600"
        : "text-red-600";

  const scoreBg =
    matchScore >= 70
      ? "bg-green-50 border-green-200"
      : matchScore >= 40
        ? "bg-yellow-50 border-yellow-200"
        : "bg-red-50 border-red-200";

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className={`p-6 rounded-xl border ${scoreBg}`}>
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">
              {viewMode === "seeker" ? "Job Fit" : `${seekerName}'s Job Fit`}
            </p>
            <p className={`text-5xl font-bold ${scoreColor}`}>{matchScore}%</p>
            <p className="text-sm text-gray-500 mt-1">
              {matchedTitles.length} of {matchedTitles.length + missingTitles.length} essential skills
            </p>
          </div>
          {seekerRelevance !== undefined && (
            <div className="text-center border-l border-gray-200 pl-8">
              <p className="text-sm text-gray-500 mb-1">Skill Relevance</p>
              <p className="text-4xl font-bold text-blue-600">{seekerRelevance}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {viewMode === "seeker" ? "of your skills apply" : "of their skills apply"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Score Breakdown Bar */}
      {scoreBreakdown && scoreBreakdown.maxPossible > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Score Breakdown</h3>
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
            {scoreBreakdown.essentialExact > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${(scoreBreakdown.essentialExact / scoreBreakdown.maxPossible) * 100}%` }}
                title={`Essential exact: ${scoreBreakdown.essentialExact}`}
              />
            )}
            {scoreBreakdown.essentialFuzzy > 0 && (
              <div
                className="bg-yellow-400"
                style={{ width: `${(scoreBreakdown.essentialFuzzy / scoreBreakdown.maxPossible) * 100}%` }}
                title={`Essential fuzzy: ${scoreBreakdown.essentialFuzzy}`}
              />
            )}
            {scoreBreakdown.optionalExact > 0 && (
              <div
                className="bg-blue-400"
                style={{ width: `${(scoreBreakdown.optionalExact / scoreBreakdown.maxPossible) * 100}%` }}
                title={`Optional exact: ${scoreBreakdown.optionalExact}`}
              />
            )}
            {scoreBreakdown.optionalFuzzy > 0 && (
              <div
                className="bg-blue-300"
                style={{ width: `${(scoreBreakdown.optionalFuzzy / scoreBreakdown.maxPossible) * 100}%` }}
                title={`Optional fuzzy: ${scoreBreakdown.optionalFuzzy}`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Essential exact ({scoreBreakdown.essentialExact})
            </span>
            {scoreBreakdown.essentialFuzzy > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Essential near-match ({scoreBreakdown.essentialFuzzy})
              </span>
            )}
            {scoreBreakdown.optionalExact > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> Optional exact ({scoreBreakdown.optionalExact})
              </span>
            )}
            {scoreBreakdown.optionalFuzzy > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-300 inline-block" /> Optional near-match ({scoreBreakdown.optionalFuzzy})
              </span>
            )}
            {scoreBreakdown.proficiencyBonus > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-purple-400 inline-block" /> Proficiency bonus (+{Math.round(scoreBreakdown.proficiencyBonus * 100)}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Exact Matched Essential Skills */}
      {matchedTitles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            {viewMode === "seeker" ? "Skills You Have" : "Matching Skills"} ({matchedTitles.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {matchedTitles.map((title, i) => (
              <SkillBadge key={i} title={title} type="matched" />
            ))}
          </div>
        </div>
      )}

      {/* Near-Matches (Fuzzy) */}
      {fuzzyTitles && fuzzyTitles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Near-Matches ({fuzzyTitles.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {fuzzyTitles.map((f, i) => (
              <SkillBadge
                key={i}
                title={`${f.seekerTitle} → ${f.jobTitle}`}
                type="fuzzy"
                subtitle={`~${Math.round(f.similarity * 100)}%`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Missing Essential Skills */}
      {missingTitles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            {viewMode === "seeker" ? "Skills to Develop" : "Missing Skills"} ({missingTitles.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {missingTitles.map((title, i) => (
              <SkillBadge key={i} title={title} type="missing" />
            ))}
          </div>
        </div>
      )}

      {/* Optional Skills Matched */}
      {optionalMatchedTitles && optionalMatchedTitles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Optional Skills Matched ({optionalMatchedTitles.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {optionalMatchedTitles.map((title, i) => (
              <SkillBadge key={i} title={title} type="optional-matched" />
            ))}
          </div>
        </div>
      )}

      {/* AI Insight */}
      {viewMode === "seeker" && coaching && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-2">Career Coaching</h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{coaching}</div>
        </div>
      )}

      {viewMode === "recruiter" && summary && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-2">Candidate Summary</h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{summary}</div>
        </div>
      )}
    </div>
  );
}
