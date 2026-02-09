"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OccupationResult {
  uri: string;
  title: string;
}

export function JobForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [occupations, setOccupations] = useState<OccupationResult[]>([]);
  const [selectedUri, setSelectedUri] = useState<string>("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError("");
    setOccupations([]);
    setSelectedUri("");

    try {
      const res = await fetch(
        `/api/esco/search?text=${encodeURIComponent(jobTitle)}&type=occupation`
      );
      if (!res.ok) throw new Error("Failed to search ESCO occupations");
      const data = await res.json();
      if (data.length === 0) {
        setError("No ESCO occupations found for this job title. Try a different title.");
        return;
      }
      setOccupations(data);
      setSelectedUri(data[0].uri);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSearching(false);
    }
  }

  async function handleCreate() {
    if (!selectedUri) return;
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/recruiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, email, occupationUri: selectedUri }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create job posting");
      }

      const data = await res.json();
      const postingId = data.recruiter.jobPostings.at(-1).id;
      router.push(`/recruiter/${postingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <form onSubmit={handleSearch} className="space-y-6">
        <div>
          <label htmlFor="company" className="block text-sm font-medium mb-1">
            Company Name
          </label>
          <input
            id="company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Acme Corp"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="hr@acme.com"
          />
        </div>

        <div>
          <label htmlFor="jobTitle" className="block text-sm font-medium mb-1">
            Job Title
          </label>
          <input
            id="jobTitle"
            type="text"
            value={jobTitle}
            onChange={(e) => {
              setJobTitle(e.target.value);
              setOccupations([]);
              setSelectedUri("");
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. Software Developer, Data Analyst, Marketing Manager"
            required
          />
        </div>

        <button
          type="submit"
          disabled={searching || !jobTitle.trim()}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {searching ? "Searching ESCO..." : "Search ESCO Occupations"}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {occupations.length > 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Select the correct ESCO occupation
            </label>
            <div className="space-y-2">
              {occupations.map((occ) => (
                <label
                  key={occ.uri}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedUri === occ.uri
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="occupation"
                    value={occ.uri}
                    checked={selectedUri === occ.uri}
                    onChange={() => setSelectedUri(occ.uri)}
                    className="text-blue-600"
                  />
                  <span className="text-sm">{occ.title}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !selectedUri}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating
              ? "Creating job posting..."
              : "Create Job Posting with Selected Occupation"}
          </button>

          {creating && (
            <p className="text-sm text-gray-500 text-center">
              Fetching skills for the selected occupation...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
