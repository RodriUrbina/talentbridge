interface SkillBadgeProps {
  title: string;
  type?: "matched" | "missing" | "neutral" | "fuzzy" | "optional-matched";
  subtitle?: string;
}

export function SkillBadge({ title, type = "neutral", subtitle }: SkillBadgeProps) {
  const colors = {
    matched: "bg-green-100 text-green-800 border-green-200",
    missing: "bg-red-100 text-red-800 border-red-200",
    neutral: "bg-blue-100 text-blue-800 border-blue-200",
    fuzzy: "bg-yellow-100 text-yellow-800 border-yellow-200",
    "optional-matched": "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full border ${colors[type]}`}
    >
      {title}
      {subtitle && (
        <span className="text-xs opacity-70">({subtitle})</span>
      )}
    </span>
  );
}
