"use client";

interface Section {
  title: string;
  body: string;
}

const accentColors: Record<string, string> = {
  "Executive Summary": "border-blue-500 bg-blue-50",
  "Transferable Strengths": "border-green-500 bg-green-50",
  "Skills Gap Analysis": "border-amber-500 bg-amber-50",
  "Recommended Transition Path": "border-purple-500 bg-purple-50",
  "Timeline Estimate": "border-cyan-500 bg-cyan-50",
  "Financial Considerations": "border-rose-500 bg-rose-50",
};

function parseSections(coaching: string): Section[] {
  const parts = coaching.split(/^## /m);
  const sections: Section[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const newlineIdx = trimmed.indexOf("\n");
    if (newlineIdx === -1) {
      sections.push({ title: trimmed, body: "" });
    } else {
      sections.push({
        title: trimmed.slice(0, newlineIdx).trim(),
        body: trimmed.slice(newlineIdx + 1).trim(),
      });
    }
  }

  return sections;
}

export function TransitionResults({ coaching }: { coaching: string }) {
  const sections = parseSections(coaching);

  if (sections.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-gray-600 whitespace-pre-wrap">{coaching}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((section) => {
        const colors = accentColors[section.title] ?? "border-gray-400 bg-gray-50";
        return (
          <div
            key={section.title}
            className={`rounded-xl border-l-4 p-5 shadow-sm ${colors}`}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {section.title}
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {section.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
