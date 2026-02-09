"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function CvUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cvText, setCvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }

    setPdfFile(file);
    setFileName(file.name);
    setCvText("");
    setError("");
  }

  function clearFile() {
    setPdfFile(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cvText.trim() && !pdfFile) return;
    setLoading(true);
    setError("");

    try {
      let res: Response;

      if (pdfFile) {
        const formData = new FormData();
        formData.append("pdf", pdfFile);
        if (name) formData.append("name", name);
        if (email) formData.append("email", email);

        res = await fetch("/api/seeker", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/seeker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, cvText }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create profile");
      }

      const data = await res.json();
      router.push(`/seeker/${data.seeker.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const hasInput = cvText.trim() || pdfFile;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Full Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="John Doe"
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
          placeholder="john@example.com"
        />
      </div>

      {/* PDF Upload */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Upload CV (PDF)
        </label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            fileName
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          {fileName ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-blue-700 font-medium">{fileName}</span>
              <button
                type="button"
                onClick={clearFile}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdfUpload"
              />
              <label
                htmlFor="pdfUpload"
                className="cursor-pointer text-sm text-gray-500"
              >
                <span className="text-blue-600 font-medium hover:underline">
                  Click to upload
                </span>{" "}
                or drag and drop a PDF file
              </label>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      {!pdfFile && (
        <>
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-sm text-gray-400">or paste text</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Text input */}
          <div>
            <label htmlFor="cvText" className="block text-sm font-medium mb-1">
              Paste your CV / Resume
            </label>
            <textarea
              id="cvText"
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="Paste your CV text here..."
            />
          </div>
        </>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !hasInput}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Analyzing your CV..." : "Analyze CV & Build Skills Profile"}
      </button>

      {loading && (
        <p className="text-sm text-gray-500 text-center">
          This may take a moment — Claude is reading your CV and mapping skills to ESCO taxonomy.
        </p>
      )}
    </form>
  );
}
