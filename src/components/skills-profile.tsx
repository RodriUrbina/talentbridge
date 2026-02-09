interface SkillsProfileProps {
  name: string;
  jobTitles: string[];
  education: string[];
}

export function SkillsProfile({ name, jobTitles, education }: SkillsProfileProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">{name}</h2>
      </div>

      {jobTitles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Experience</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            {jobTitles.map((title, i) => (
              <li key={i}>{title}</li>
            ))}
          </ul>
        </div>
      )}

      {education.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Education</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            {education.map((edu, i) => (
              <li key={i}>{edu}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
