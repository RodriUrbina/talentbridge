"use client";

import { useState, useEffect, useRef } from "react";
import { TransitionResults, TrainingProgram } from "./transition-results";

interface OccupationOption {
  uri: string;
  title: string;
}

interface TransitionResult {
  matchScore: number;
  seekerRelevance: number;
  matchedTitles: string[];
  missingTitles: string[];
  fuzzyTitles: { seekerTitle: string; jobTitle: string; similarity: number }[];
  optionalMatchedTitles: string[];
  optionalMissingTitles: string[];
  scoreBreakdown: {
    essentialExact: number;
    essentialFuzzy: number;
    optionalExact: number;
    optionalFuzzy: number;
    proficiencyBonus: number;
    maxPossible: number;
  };
  coaching: string;
  occupationTitle: string;
}

export function TransitionPanel({ seekerProfileId }: { seekerProfileId: string }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<OccupationOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<OccupationOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<TransitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trainingPrograms, setTrainingPrograms] = useState<TrainingProgram[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/esco/search?q=${encodeURIComponent(query)}&type=occupation`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch {
        // Silently handle search errors
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click-outside to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(occ: OccupationOption) {
    setSelected(occ);
    setQuery(occ.title);
    setShowDropdown(false);
    setResult(null);
    setTrainingPrograms([]);
  }

  async function handleAnalyze() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTrainingPrograms([]);
    setTrainingLoading(false);

    try {
      const res = await fetch("/api/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seekerProfileId,
          occupationUri: selected.uri,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to analyze transition");
      }

      const data = await res.json();
      setResult(data);

      // Fire non-blocking training program search
      if (data.missingTitles?.length > 0) {
        setTrainingLoading(true);
        fetch("/api/training-programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missingSkills: data.missingTitles,
            targetOccupation: data.occupationTitle,
          }),
        })
          .then((r) => (r.ok ? r.json() : { programs: [] }))
          .then((d) => setTrainingPrograms(d.programs ?? []))
          .catch(() => setTrainingPrograms([]))
          .finally(() => setTrainingLoading(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Target Occupation
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setResult(null);
            setTrainingPrograms([]);
          }}
          placeholder="Search for an occupation (e.g., electrician, software developer)"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searching && (
          <div className="absolute right-3 top-9 text-gray-400 text-sm">Searching...</div>
        )}

        {/* Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((occ) => (
              <li key={occ.uri}>
                <button
                  type="button"
                  onClick={() => handleSelect(occ)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors text-sm"
                >
                  {occ.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={!selected || loading}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Analyzing..." : "Analyze Transition"}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-gray-600">
            Analyzing your skills against {selected?.title}...
          </p>
          <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <TransitionResults
          coaching={result.coaching}
          trainingPrograms={trainingPrograms}
          trainingLoading={trainingLoading}
        />
      )}
    </div>
  );
}
