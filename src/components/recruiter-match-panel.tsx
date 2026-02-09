"use client";

import { useState } from "react";
import { MatchResults } from "./match-results";

interface SeekerOption {
  id: string;
  name: string;
  skillCount: number;
}

interface MatchData {
  matchScore: number;
  matchedTitles: string[];
  missingTitles: string[];
  summary: string;
  seekerName: string;
  jobTitle: string;
}

export function RecruiterMatchPanel({
  jobPostingId,
  seekers,
}: {
  jobPostingId: string;
  seekers: SeekerOption[];
}) {
  const [selectedSeeker, setSelectedSeeker] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchData, setMatchData] = useState<MatchData | null>(null);

  async function handleMatch() {
    if (!selectedSeeker) return;
    setLoading(true);
    setError("");
    setMatchData(null);

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seekerProfileId: selectedSeeker,
          jobPostingId,
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

  if (seekers.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        No job seekers available yet. Candidates need to upload their CVs first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label htmlFor="seekerSelect" className="block text-sm font-medium mb-1">
            Select a Candidate
          </label>
          <select
            id="seekerSelect"
            value={selectedSeeker}
            onChange={(e) => {
              setSelectedSeeker(e.target.value);
              setMatchData(null);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a candidate...</option>
            {seekers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.skillCount} skills)
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleMatch}
          disabled={!selectedSeeker || loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Matching..." : "Match"}
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 text-center">
          Comparing candidate skills against job requirements and generating summary...
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
          matchedTitles={matchData.matchedTitles}
          missingTitles={matchData.missingTitles}
          summary={matchData.summary}
          seekerName={matchData.seekerName}
          jobTitle={matchData.jobTitle}
          viewMode="recruiter"
        />
      )}
    </div>
  );
}
