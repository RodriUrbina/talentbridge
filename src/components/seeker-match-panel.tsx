"use client";

import { useState } from "react";
import { MatchResults } from "./match-results";

interface JobPostingOption {
  id: string;
  title: string;
  company: string | null;
  essentialCount: number;
  optionalCount: number;
}

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

interface MatchData {
  matchScore: number;
  seekerRelevance?: number;
  matchedTitles: string[];
  missingTitles: string[];
  fuzzyTitles?: FuzzyTitle[];
  optionalMatchedTitles?: string[];
  optionalMissingTitles?: string[];
  scoreBreakdown?: ScoreBreakdown;
  coaching: string;
  jobTitle: string;
}

export function SeekerMatchPanel({
  seekerProfileId,
  jobPostings,
}: {
  seekerProfileId: string;
  jobPostings: JobPostingOption[];
}) {
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchData, setMatchData] = useState<MatchData | null>(null);

  async function handleMatch() {
    if (!selectedJob) return;
    setLoading(true);
    setError("");
    setMatchData(null);

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seekerProfileId,
          jobPostingId: selectedJob,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to match");
      }

      const data = await res.json();
      setMatchData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (jobPostings.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        No job postings available yet. Ask a recruiter to create one first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label htmlFor="jobSelect" className="block text-sm font-medium mb-1">
            Select a Job Posting
          </label>
          <select
            id="jobSelect"
            value={selectedJob}
            onChange={(e) => {
              setSelectedJob(e.target.value);
              setMatchData(null);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a job posting...</option>
            {jobPostings.map((jp) => (
              <option key={jp.id} value={jp.id}>
                {jp.title} — {jp.company || "Unknown Company"} ({jp.essentialCount} essential skills)
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleMatch}
          disabled={!selectedJob || loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Matching..." : "Match"}
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 text-center">
          Comparing your skills against the job requirements and generating coaching advice...
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {matchData && (
        <MatchResults
          matchScore={matchData.matchScore}
          seekerRelevance={matchData.seekerRelevance}
          matchedTitles={matchData.matchedTitles}
          missingTitles={matchData.missingTitles}
          fuzzyTitles={matchData.fuzzyTitles}
          optionalMatchedTitles={matchData.optionalMatchedTitles}
          optionalMissingTitles={matchData.optionalMissingTitles}
          scoreBreakdown={matchData.scoreBreakdown}
          coaching={matchData.coaching}
          jobTitle={matchData.jobTitle}
          viewMode="seeker"
        />
      )}
    </div>
  );
}
