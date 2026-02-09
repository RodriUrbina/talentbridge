import mongoose from "mongoose";

// ---------- MongoDB connection (Nine Gates jobSkillsDB) ----------

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://root:root@localhost:27017/jobSkillsDB?authSource=admin";

let connected = false;

async function connectMongo() {
  if (connected) return;
  if (mongoose.connection.readyState >= 1) {
    connected = true;
    return;
  }
  await mongoose.connect(MONGODB_URI);
  connected = true;
}

// ---------- Mongoose models (read-only, matches Nine Gates schema) ----------

const skillSchema = new mongoose.Schema(
  {
    title: String,
    uri: String,
    skillType: String,
    description: String,
  },
  { collection: "skills" }
);

const occupationSchema = new mongoose.Schema(
  {
    title: String,
    uri: String,
    description: String,
    preferredLabel: String,
    alternativeLabel: [String],
    code: String,
    essentialSkills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
    optionalSkills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
  },
  { collection: "occupations" }
);

const Skill =
  mongoose.models.Skill || mongoose.model("Skill", skillSchema);
const Occupation =
  mongoose.models.Occupation || mongoose.model("Occupation", occupationSchema);

// ---------- Exported interfaces (unchanged) ----------

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

// ---------- Exported functions (same signatures, now query MongoDB) ----------

export async function searchOccupations(
  query: string
): Promise<{ uri: string; title: string }[]> {
  await connectMongo();
  const results = await Occupation.find(
    { title: { $regex: query, $options: "i" } },
    { uri: 1, title: 1, _id: 0 }
  ).limit(10);
  return results.map((r) => ({ uri: r.uri, title: r.title }));
}

export async function getOccupationDetails(
  occupationUri: string
): Promise<EscoOccupation> {
  await connectMongo();
  const occ = await Occupation.findOne({ uri: occupationUri })
    .populate("essentialSkills")
    .populate("optionalSkills");

  if (!occ) throw new Error(`Occupation not found: ${occupationUri}`);

  const mapSkill = (s: { uri: string; title: string; skillType?: string }): EscoSkill => ({
    uri: s.uri,
    title: s.title,
    skillType: s.skillType,
  });

  return {
    uri: occ.uri,
    title: occ.title,
    description: occ.description,
    preferredLabel: occ.preferredLabel,
    alternativeLabels: occ.alternativeLabel ?? [],
    code: occ.code,
    essentialSkills: (occ.essentialSkills || []).map(mapSkill),
    optionalSkills: (occ.optionalSkills || []).map(mapSkill),
  };
}

export async function searchSkills(
  query: string
): Promise<{ uri: string; title: string }[]> {
  await connectMongo();
  const results = await Skill.find(
    { title: { $regex: query, $options: "i" } },
    { uri: 1, title: 1, _id: 0 }
  ).limit(10);
  return results.map((r) => ({ uri: r.uri, title: r.title }));
}

// ---------- New: Title similarity (pure function, no DB) ----------

export function computeTitleSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1.0;

  // Containment check: one title contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  // Token-based Jaccard similarity
  const tokensA = new Set(na.split(/\s+/).filter(Boolean));
  const tokensB = new Set(nb.split(/\s+/).filter(Boolean));

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------- New: Batch co-occurrence via MongoDB ----------

export async function batchCoOccurrence(
  seekerUris: string[],
  jobUris: string[]
): Promise<Map<string, Map<string, number>>> {
  await connectMongo();

  const allUris = [...new Set([...seekerUris, ...jobUris])];
  if (allUris.length === 0) return new Map();

  // 1. Resolve URIs to Skill ObjectIds
  const skillDocs = await Skill.find(
    { uri: { $in: allUris } },
    { _id: 1, uri: 1 }
  ).lean();

  const uriToId = new Map<string, string>();
  const idToUri = new Map<string, string>();
  for (const doc of skillDocs) {
    uriToId.set(doc.uri, doc._id.toString());
    idToUri.set(doc._id.toString(), doc.uri);
  }

  const allIds = skillDocs.map((d) => d._id);
  if (allIds.length === 0) return new Map();

  // 2. Find all occupations containing any of these skills (in essential or optional)
  const occupations = await Occupation.find(
    {
      $or: [
        { essentialSkills: { $in: allIds } },
        { optionalSkills: { $in: allIds } },
      ],
    },
    { essentialSkills: 1, optionalSkills: 1 }
  ).lean();

  // 3. Build skill → set of occupation indices
  const skillOccupations = new Map<string, Set<number>>();

  for (let i = 0; i < occupations.length; i++) {
    const occ = occupations[i];
    const allSkillIds = [
      ...(occ.essentialSkills || []).map((id: mongoose.Types.ObjectId) => id.toString()),
      ...(occ.optionalSkills || []).map((id: mongoose.Types.ObjectId) => id.toString()),
    ];

    for (const skillId of allSkillIds) {
      const uri = idToUri.get(skillId);
      if (uri && (seekerUris.includes(uri) || jobUris.includes(uri))) {
        if (!skillOccupations.has(uri)) skillOccupations.set(uri, new Set());
        skillOccupations.get(uri)!.add(i);
      }
    }
  }

  // 4. Compute Jaccard similarity for each (seekerUri, jobUri) pair
  const result = new Map<string, Map<string, number>>();

  for (const sUri of seekerUris) {
    const sOccs = skillOccupations.get(sUri);
    if (!sOccs) continue;

    const innerMap = new Map<string, number>();

    for (const jUri of jobUris) {
      if (sUri === jUri) continue; // exact match handled separately
      const jOccs = skillOccupations.get(jUri);
      if (!jOccs) continue;

      let intersection = 0;
      for (const idx of sOccs) {
        if (jOccs.has(idx)) intersection++;
      }
      const union = sOccs.size + jOccs.size - intersection;
      const jaccard = union === 0 ? 0 : intersection / union;

      if (jaccard > 0) {
        innerMap.set(jUri, jaccard);
      }
    }

    if (innerMap.size > 0) {
      result.set(sUri, innerMap);
    }
  }

  return result;
}
