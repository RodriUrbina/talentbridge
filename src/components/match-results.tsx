"use client";

import { SkillBadge } from "./skill-badge";

interface MatchResultsProps {
  matchScore: number;
  matchedTitles: string[];
  missingTitles: string[];
  coaching?: string;
  summary?: string;
  seekerName?: string;
  jobTitle?: string;
  viewMode: "seeker" | "recruiter";
}

export function MatchResults({
  matchScore,
  matchedTitles,
  missingTitles,
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
      {/* Score */}
      <div className={`p-6 rounded-xl border ${scoreBg} text-center`}>
        <p className="text-sm text-gray-500 mb-1">
          {viewMode === "seeker"
            ? `Your match for "${jobTitle}"`
            : `${seekerName}'s match`}
        </p>
        <p className={`text-5xl font-bold ${scoreColor}`}>{matchScore}%</p>
        <p className="text-sm text-gray-500 mt-1">
          {matchedTitles.length} of {matchedTitles.length + missingTitles.length} essential skills
        </p>
      </div>

      {/* Matched Skills */}
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

      {/* Missing Skills */}
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
