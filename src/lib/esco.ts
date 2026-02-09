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
