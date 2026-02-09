import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface SkillWithProficiency {
  name: string;
  proficiency: number; // 1-5
}

export interface ParsedCv {
  jobTitles: string[];
  education: string[];
  rawSkills: string[];
  skillsWithProficiency: SkillWithProficiency[];
}

export async function parseCv(cvText: string): Promise<ParsedCv> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Analyze the following CV/resume text and extract structured information. Return a JSON object with exactly these fields:

- "jobTitles": an array of job titles the person has held or is qualified for
- "education": an array of educational qualifications (degrees, certifications, courses)
- "rawSkills": an array of skill name strings mentioned or implied (technical skills, soft skills, tools, languages, etc.)
- "skillsWithProficiency": an array of objects { "name": string, "proficiency": number } where proficiency is 1-5:
  - 1 = mentioned only / passing reference
  - 2 = basic / coursework / learning
  - 3 = used in a job / practical experience
  - 4 = multiple years / lead role / deep experience
  - 5 = expert / certified / recognized authority

Be thorough — extract every skill you can identify, including those implied by job experience.
Each entry in "skillsWithProficiency" should correspond to an entry in "rawSkills".

CV text:
${cvText}

Return ONLY the JSON object, no other text.`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const text = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
  const parsed = JSON.parse(text);

  const rawSkills: string[] = parsed.rawSkills ?? [];
  const skillsWithProficiency: SkillWithProficiency[] =
    parsed.skillsWithProficiency?.length > 0
      ? parsed.skillsWithProficiency
      : rawSkills.map((name: string) => ({ name, proficiency: 3 }));

  return {
    jobTitles: parsed.jobTitles ?? [],
    education: parsed.education ?? [],
    rawSkills,
    skillsWithProficiency,
  };
}

export async function generateJobDescription(
  jobTitle: string,
  essentialSkills: string[],
  optionalSkills: string[]
): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Write a professional job description for the role of "${jobTitle}".

Essential skills: ${essentialSkills.join(", ")}
Nice-to-have skills: ${optionalSkills.join(", ")}

Structure the description with these sections:
1. **Role Overview** — A brief paragraph about the role
2. **Key Responsibilities** — 4-6 bullet points
3. **Required Skills** — Incorporate the essential skills naturally
4. **Nice-to-Have** — Incorporate the optional skills naturally

Keep it concise and professional. Use markdown formatting.`,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export interface EnhancedGapContext {
  fuzzyMatches?: { seekerTitle: string; jobTitle: string; similarity: number }[];
  optionalMatchedTitles?: string[];
  seekerRelevance?: number;
}

export async function explainGaps(
  matchedSkills: string[],
  missingSkills: string[],
  jobTitle: string,
  enhanced?: EnhancedGapContext
): Promise<string> {
  let extraContext = "";
  if (enhanced) {
    if (enhanced.fuzzyMatches && enhanced.fuzzyMatches.length > 0) {
      extraContext += `\n\nThey also have near-matches (related but not exact skills):\n${enhanced.fuzzyMatches
        .map((f) => `- "${f.seekerTitle}" is ~${Math.round(f.similarity * 100)}% related to required "${f.jobTitle}"`)
        .join("\n")}`;
    }
    if (enhanced.optionalMatchedTitles && enhanced.optionalMatchedTitles.length > 0) {
      extraContext += `\n\nThey also match these optional/nice-to-have skills: ${enhanced.optionalMatchedTitles.join(", ")}`;
    }
    if (enhanced.seekerRelevance !== undefined) {
      extraContext += `\n\n${Math.round(enhanced.seekerRelevance)}% of their total skill set is relevant to this job.`;
    }
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a career coach helping a recent graduate. They want to get a job as "${jobTitle}".

They already have these skills: ${matchedSkills.join(", ")}
They are missing these skills: ${missingSkills.join(", ")}${extraContext}

Provide a brief, encouraging explanation of:
1. What they're strong in
2. What skills they need to develop
3. Practical suggestions for how to acquire the missing skills (courses, projects, certifications)

Keep it concise and actionable.`,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function summarizeCandidate(
  seekerName: string,
  jobTitles: string[],
  matchScore: number,
  matchedSkills: string[],
  missingSkills: string[],
  jobTitle: string,
  enhanced?: EnhancedGapContext
): Promise<string> {
  let extraContext = "";
  if (enhanced) {
    if (enhanced.fuzzyMatches && enhanced.fuzzyMatches.length > 0) {
      extraContext += `\nNear-matches: ${enhanced.fuzzyMatches.map((f) => `"${f.seekerTitle}" ≈ "${f.jobTitle}"`).join(", ")}`;
    }
    if (enhanced.optionalMatchedTitles && enhanced.optionalMatchedTitles.length > 0) {
      extraContext += `\nOptional skills matched: ${enhanced.optionalMatchedTitles.join(", ")}`;
    }
    if (enhanced.seekerRelevance !== undefined) {
      extraContext += `\nSkill relevance: ${Math.round(enhanced.seekerRelevance)}% of their skills are relevant to this role`;
    }
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Summarize this candidate for a recruiter hiring for "${jobTitle}":

Candidate: ${seekerName}
Previous roles: ${jobTitles.join(", ")}
Match score: ${matchScore}%
Matching skills: ${matchedSkills.join(", ")}
Missing skills: ${missingSkills.join(", ")}${extraContext}

Write a 2-3 sentence recruiter-friendly summary highlighting strengths and gaps.`,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}
