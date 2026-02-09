const ESCO_API = process.env.ESCO_API_URL || "https://ec.europa.eu/esco/api";

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status >= 500 && i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      continue;
    }
    throw new Error(`ESCO API error: ${res.status} ${res.statusText}`);
  }
  throw new Error("ESCO API: max retries reached");
}

export interface EscoSkill {
  uri: string;
  title: string;
  skillType?: string;
  description?: string;
}

export interface EscoOccupation {
  uri: string;
  title: string;
  description?: string;
  preferredLabel?: string;
  alternativeLabels?: string[];
  code?: string;
  essentialSkills: EscoSkill[];
  optionalSkills: EscoSkill[];
}

export async function searchOccupations(query: string): Promise<{ uri: string; title: string }[]> {
  const url = `${ESCO_API}/search?text=${encodeURIComponent(query)}&language=en&type=occupation&limit=10`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  const results = data._embedded?.results ?? [];
  return results.map((r: { uri: string; title: string }) => ({
    uri: r.uri,
    title: r.title,
  }));
}

export async function getOccupationDetails(occupationUri: string): Promise<EscoOccupation> {
  const url = `${ESCO_API}/resource/occupation?uri=${encodeURIComponent(occupationUri)}&language=en`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  const essentialSkills: EscoSkill[] = (data._links?.hasEssentialSkill ?? []).map(
    (s: { uri: string; title: string; skillType?: string }) => ({
      uri: s.uri,
      title: s.title,
      skillType: s.skillType?.split("/").pop(),
    })
  );

  const optionalSkills: EscoSkill[] = (data._links?.hasOptionalSkill ?? []).map(
    (s: { uri: string; title: string; skillType?: string }) => ({
      uri: s.uri,
      title: s.title,
      skillType: s.skillType?.split("/").pop(),
    })
  );

  return {
    uri: data.uri,
    title: data.title,
    description: data.description?.en?.literal,
    preferredLabel: data.preferredLabel?.en,
    alternativeLabels: data.alternativeLabel?.en ?? [],
    code: data.code,
    essentialSkills,
    optionalSkills,
  };
}

export async function searchSkills(query: string): Promise<{ uri: string; title: string }[]> {
  const url = `${ESCO_API}/search?text=${encodeURIComponent(query)}&language=en&type=skill&limit=10`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  const results = data._embedded?.results ?? [];
  return results.map((r: { uri: string; title: string }) => ({
    uri: r.uri,
    title: r.title,
  }));
}
