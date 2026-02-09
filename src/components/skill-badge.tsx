interface SkillBadgeProps {
  title: string;
  type?: "matched" | "missing" | "neutral";
}

export function SkillBadge({ title, type = "neutral" }: SkillBadgeProps) {
  const colors = {
    matched: "bg-green-100 text-green-800 border-green-200",
    missing: "bg-red-100 text-red-800 border-red-200",
    neutral: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <span
      className={`inline-block px-3 py-1 text-sm rounded-full border ${colors[type]}`}
    >
      {title}
    </span>
  );
}
