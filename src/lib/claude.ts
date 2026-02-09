import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface ParsedCv {
  jobTitles: string[];
  education: string[];
  rawSkills: string[];
}

export async function parseCv(cvText: string): Promise<ParsedCv> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze the following CV/resume text and extract structured information. Return a JSON object with exactly these fields:

- "jobTitles": an array of job titles the person has held or is qualified for
- "education": an array of educational qualifications (degrees, certifications, courses)
- "rawSkills": an array of skills mentioned or implied (technical skills, soft skills, tools, languages, etc.)

Be thorough — extract every skill you can identify, including those implied by job experience.

CV text:
${cvText}

Return ONLY the JSON object, no other text.`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const text = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
  const parsed = JSON.parse(text);
  return {
    jobTitles: parsed.jobTitles ?? [],
    education: parsed.education ?? [],
    rawSkills: parsed.rawSkills ?? [],
  };
}

export async function explainGaps(
  matchedSkills: string[],
  missingSkills: string[],
  jobTitle: string
): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a career coach helping a recent graduate. They want to get a job as "${jobTitle}".

They already have these skills: ${matchedSkills.join(", ")}
They are missing these skills: ${missingSkills.join(", ")}

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
  jobTitle: string
): Promise<string> {
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
Missing skills: ${missingSkills.join(", ")}

Write a 2-3 sentence recruiter-friendly summary highlighting strengths and gaps.`,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}
