"use client";

export interface TrainingProgram {
  name: string;
  institution: string;
  cost: string;
  duration: string;
  url: string;
  relevantSkills: string[];
}

interface Section {
  title: string;
  body: string;
}

interface TransitionResultsProps {
  coaching: string;
  trainingPrograms?: TrainingProgram[];
  trainingLoading?: boolean;
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

export function TransitionResults({ coaching, trainingPrograms, trainingLoading }: TransitionResultsProps) {
  const sections = parseSections(coaching);

  if (sections.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-gray-600 whitespace-pre-wrap">{coaching}</p>
      </div>
    );
  }

  const showTrainingCard = trainingLoading || (trainingPrograms && trainingPrograms.length > 0);

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

      {showTrainingCard && (
        <div className="md:col-span-2 rounded-xl border-l-4 border-emerald-500 bg-emerald-50 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Training Programs Found
          </h3>

          {trainingLoading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-600 border-t-transparent" />
              <span className="text-sm text-gray-600">Searching for training programs...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {trainingPrograms!.map((program, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-lg border border-emerald-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <a
                        href={program.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                      >
                        {program.name}
                      </a>
                      <p className="text-xs text-gray-500 mt-0.5">{program.institution}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-gray-700">{program.cost}</p>
                      <p className="text-xs text-gray-500">{program.duration}</p>
                    </div>
                  </div>
                  {program.relevantSkills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {program.relevantSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-block px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
