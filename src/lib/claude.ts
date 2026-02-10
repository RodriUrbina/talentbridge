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

- "jobTitles": an array of job titles the person has actually held in professional work experience (do NOT include titles inferred from education, degrees, or coursework — only actual positions held)
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

export async function validateInferredSkills(
  candidateSkills: { uri: string; title: string }[],
  cvText: string
): Promise<Set<string>> {
  if (candidateSkills.length === 0) return new Set();

  const skillList = candidateSkills
    .map((s, i) => `${i + 1}. ${s.title}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are evaluating whether skills are supported by evidence in a CV.

Here is a list of candidate skills:
${skillList}

Here is the CV text:
${cvText}

For each skill, determine if the CV provides evidence that the person has this skill. A skill is supported if:
- The CV mentions it directly
- The CV describes work that clearly requires this skill
- The CV lists a closely related technology or practice

Do NOT include skills just because they are common in the person's occupation. Only include skills with real evidence in the CV.

Return a JSON array of the NUMBERS (1-based indices) of the supported skills. Example: [1, 3, 5]
Return ONLY the JSON array, no other text.`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
  const text = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
  const indices: number[] = JSON.parse(text);

  const validatedUris = new Set<string>();
  for (const idx of indices) {
    if (idx >= 1 && idx <= candidateSkills.length) {
      validatedUris.add(candidateSkills[idx - 1].uri);
    }
  }
  return validatedUris;
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
  }

  const matchRatio = matchedSkills.length + missingSkills.length > 0
    ? Math.round((matchedSkills.length / (matchedSkills.length + missingSkills.length)) * 100)
    : 0;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a career coach helping a recent graduate. They want to get a job as "${jobTitle}".

They match ${matchedSkills.length} out of ${matchedSkills.length + missingSkills.length} essential skills for this role (${matchRatio}%).
${matchedSkills.length > 0 ? `Skills they have: ${matchedSkills.join(", ")}` : "They have none of the essential skills yet."}
${missingSkills.length > 0 ? `Skills they are missing: ${missingSkills.join(", ")}` : ""}${extraContext}

Provide a brief, encouraging explanation of:
1. What they're strong in (based ONLY on their matched skills above — do not overstate their readiness)
2. What skills they need to develop
3. Practical suggestions for how to acquire the missing skills (courses, projects, certifications)

Be realistic about their current level. If they match few or no essential skills, acknowledge the gap honestly while staying encouraging. Keep it concise and actionable.`,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function explainTransitionGaps(
  currentTitles: string[],
  targetOccupation: string,
  matchedSkills: string[],
  missingSkills: string[],
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
  }

  const matchRatio = matchedSkills.length + missingSkills.length > 0
    ? Math.round((matchedSkills.length / (matchedSkills.length + missingSkills.length)) * 100)
    : 0;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `You are a career transition advisor. This person currently works as ${currentTitles.length > 0 ? currentTitles.join(", ") : "an unspecified role"} and wants to transition to "${targetOccupation}".

They match ${matchedSkills.length} out of ${matchedSkills.length + missingSkills.length} essential skills for this occupation (${matchRatio}%).
${matchedSkills.length > 0 ? `Transferable skills they already have: ${matchedSkills.join(", ")}` : "They have none of the essential skills yet."}
${missingSkills.length > 0 ? `Skills they need to acquire: ${missingSkills.join(", ")}` : ""}${extraContext}

Provide a personalized career transition plan with EXACTLY these 6 section headings (use ## markdown headings):

## Executive Summary
High-level overview of the transition viability — is this realistic, what's the overall picture.

## Transferable Strengths
Which existing skills carry over strongly, what advantages they provide, and an honest reality check.

## Skills Gap Analysis
What's missing and how critical each gap is. Rank gaps by importance.

## Recommended Transition Path
Concrete steps: courses, certifications, entry-level positions, apprenticeships, or projects to build.

## Timeline Estimate
Realistic timeframe for making the transition, broken into phases if helpful.

## Financial Considerations
Costs of training/certifications, salary expectations during transition, and potential ROI.

Be realistic about the effort required. If the gap is large, acknowledge it while staying constructive. Keep the advice specific and actionable.`,
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
