import Anthropic from "@anthropic-ai/sdk";

export interface TrainingProgram {
  name: string;
  institution: string;
  cost: string;
  duration: string;
  url: string;
  relevantSkills: string[];
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

async function braveWebSearch(query: string): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      count: "10",
    });

    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const results: BraveSearchResult[] = (data.web?.results ?? []).map(
      (r: { title: string; url: string; description: string }) => ({
        title: r.title,
        url: r.url,
        description: r.description ?? "",
      })
    );

    return results;
  } catch {
    return [];
  }
}

export async function searchTrainingPrograms(
  missingSkills: string[],
  targetOccupation: string
): Promise<TrainingProgram[]> {
  const topSkills = missingSkills.slice(0, 5);
  if (topSkills.length === 0) return [];

  const query = `${targetOccupation} training program course ${topSkills.join(" ")}`;
  const searchResults = await braveWebSearch(query);

  if (searchResults.length === 0) return [];

  const client = new Anthropic();

  const searchContext = searchResults
    .map((r, i) => `${i + 1}. "${r.title}" — ${r.url}\n   ${r.description}`)
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are extracting structured training program data from web search results.

The person wants to become a "${targetOccupation}" and needs to learn these skills: ${topSkills.join(", ")}.

Here are web search results for training programs:

${searchContext}

From these results, extract up to 5 relevant training programs. For each, provide:
- "name": program or course name
- "institution": the school, platform, or organization offering it
- "cost": estimated cost (use "Contact for pricing" if unknown)
- "duration": estimated duration (use "Varies" if unknown)
- "url": the URL from the search result
- "relevantSkills": which of the missing skills [${topSkills.join(", ")}] this program addresses

Return a JSON array of objects. Only include results that are actual training programs, courses, or educational offerings — skip job listings, news articles, or unrelated pages.

Return ONLY the JSON array, no other text.`,
      },
    ],
  });

  try {
    const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
    const text = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
    const programs: TrainingProgram[] = JSON.parse(text);
    return programs;
  } catch {
    return [];
  }
}
