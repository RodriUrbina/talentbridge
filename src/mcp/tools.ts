import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { searchOccupations, getOccupationDetails, searchSkills } from "../lib/esco";
import { parseCv, explainGaps, summarizeCandidate } from "../lib/claude";
import { matchSkills } from "../lib/matching";

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerTools(server: McpServer) {
  // 1. parse_cv
  server.tool(
    "parse_cv",
    "Upload CV text, parse it with Claude AI, map skills to ESCO taxonomy, and create a seeker profile. Returns the new seeker profile with all mapped ESCO skills.",
    {
      name: z.string().describe("Name of the job seeker"),
      email: z.string().optional().describe("Email address (optional)"),
      cvText: z.string().describe("The full CV/resume text to parse"),
    },
    async ({ name, email, cvText }) => {
      const parsed = await parseCv(cvText);

      const escoSkills: { uri: string; title: string; skillType?: string }[] = [];

      for (const rawSkill of parsed.rawSkills) {
        const results = await searchSkills(rawSkill);
        if (results.length > 0) {
          escoSkills.push({ uri: results[0].uri, title: results[0].title });
        }
      }

      for (const jobTitle of parsed.jobTitles) {
        const occupations = await searchOccupations(jobTitle);
        if (occupations.length > 0) {
          const occupation = await getOccupationDetails(occupations[0].uri);
          for (const s of [...occupation.essentialSkills, ...occupation.optionalSkills]) {
            escoSkills.push({ uri: s.uri, title: s.title, skillType: s.skillType });
          }
        }
      }

      const uniqueSkills = Array.from(
        new Map(escoSkills.map((s) => [s.uri, s])).values()
      );

      const user = await prisma.user.create({
        data: {
          name: name || "Anonymous Seeker",
          email: email || `seeker-${Date.now()}@talentbridge.local`,
          role: "SEEKER",
          seeker: {
            create: {
              cvText,
              jobTitles: parsed.jobTitles,
              education: parsed.education,
              skills: {
                create: uniqueSkills.map((s) => ({
                  escoUri: s.uri,
                  title: s.title,
                  skillType: s.skillType,
                })),
              },
            },
          },
        },
        include: { seeker: { include: { skills: true } } },
      });

      return text(JSON.stringify({
        seekerProfileId: user.seeker!.id,
        name: user.name,
        jobTitles: parsed.jobTitles,
        education: parsed.education,
        totalSkills: uniqueSkills.length,
      }, null, 2));
    }
  );

  // 2. search_occupations
  server.tool(
    "search_occupations",
    "Search ESCO occupations by job title. Returns up to 10 matching occupations with their URIs. Use the URI to create a job posting.",
    {
      query: z.string().describe("Job title to search for (e.g. 'sales manager', 'data analyst')"),
    },
    async ({ query }) => {
      const results = await searchOccupations(query);
      return text(JSON.stringify(results, null, 2));
    }
  );

  // 3. create_job_posting
  server.tool(
    "create_job_posting",
    "Create a job posting from an ESCO occupation URI. Fetches all essential and optional skills for the occupation. Use search_occupations first to find the right URI.",
    {
      occupationUri: z.string().describe("ESCO occupation URI from search_occupations"),
      company: z.string().optional().describe("Company name"),
      email: z.string().optional().describe("Recruiter email address"),
    },
    async ({ occupationUri, company, email }) => {
      const occupation = await getOccupationDetails(occupationUri);

      const resolvedEmail = email || `recruiter-${Date.now()}@talentbridge.local`;

      let user = await prisma.user.findUnique({
        where: { email: resolvedEmail },
        include: { recruiter: true },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: company || "Anonymous Recruiter",
            email: resolvedEmail,
            role: "RECRUITER",
            recruiter: { create: { company: company || null } },
          },
          include: { recruiter: true },
        });
      } else if (!user.recruiter) {
        await prisma.recruiterProfile.create({
          data: { userId: user.id, company: company || null },
        });
        user = await prisma.user.findUnique({
          where: { id: user.id },
          include: { recruiter: true },
        });
      }

      const jobPosting = await prisma.jobPosting.create({
        data: {
          recruiterProfileId: user!.recruiter!.id,
          title: occupation.title,
          escoOccupationUri: occupation.uri,
          skills: {
            create: [
              ...occupation.essentialSkills.map((s) => ({
                escoUri: s.uri,
                title: s.title,
                skillType: s.skillType,
                isEssential: true,
              })),
              ...occupation.optionalSkills.map((s) => ({
                escoUri: s.uri,
                title: s.title,
                skillType: s.skillType,
                isEssential: false,
              })),
            ],
          },
        },
        include: { skills: true },
      });

      return text(JSON.stringify({
        jobPostingId: jobPosting.id,
        title: jobPosting.title,
        essentialSkills: occupation.essentialSkills.length,
        optionalSkills: occupation.optionalSkills.length,
        totalSkills: jobPosting.skills.length,
      }, null, 2));
    }
  );

  // 4. match_seeker_to_job
  server.tool(
    "match_seeker_to_job",
    "Match a seeker profile against a job posting. Compares ESCO skill URIs, calculates match score, and generates AI career coaching (for seeker) and candidate summary (for recruiter).",
    {
      seekerProfileId: z.string().describe("Seeker profile ID"),
      jobPostingId: z.string().describe("Job posting ID"),
    },
    async ({ seekerProfileId, jobPostingId }) => {
      const [seeker, jobPosting] = await Promise.all([
        prisma.seekerProfile.findUnique({
          where: { id: seekerProfileId },
          include: { user: true, skills: true },
        }),
        prisma.jobPosting.findUnique({
          where: { id: jobPostingId },
          include: { skills: true },
        }),
      ]);

      if (!seeker) return text(JSON.stringify({ error: "Seeker not found" }));
      if (!jobPosting) return text(JSON.stringify({ error: "Job posting not found" }));

      const seekerTitleMap: Record<string, string> = {};
      for (const s of seeker.skills) seekerTitleMap[s.escoUri] = s.title;
      const jobTitleMap: Record<string, string> = {};
      for (const s of jobPosting.skills) jobTitleMap[s.escoUri] = s.title;

      // Check for existing match
      const existing = await prisma.match.findUnique({
        where: { seekerProfileId_jobPostingId: { seekerProfileId, jobPostingId } },
      });

      let matchRecord;
      let result;

      if (existing) {
        matchRecord = existing;
        const matchedTitles = existing.matchedSkills.map((uri) => jobTitleMap[uri] || seekerTitleMap[uri] || uri);
        const missingTitles = existing.missingSkills.map((uri) => jobTitleMap[uri] || uri);
        result = { matchScore: existing.matchScore, matchedTitles, missingTitles };
      } else {
        const essentialUris = jobPosting.skills.filter((s) => s.isEssential).map((s) => s.escoUri);
        const seekerUris = seeker.skills.map((s) => s.escoUri);
        result = matchSkills(seekerUris, essentialUris, seekerTitleMap, jobTitleMap);

        matchRecord = await prisma.match.create({
          data: {
            seekerProfileId,
            jobPostingId,
            matchScore: result.matchScore,
            matchedSkills: result.matchedSkills,
            missingSkills: result.missingSkills,
          },
        });
      }

      const [coaching, summary] = await Promise.all([
        explainGaps(result.matchedTitles, result.missingTitles, jobPosting.title),
        summarizeCandidate(
          seeker.user.name || "Anonymous Seeker",
          seeker.jobTitles,
          result.matchScore,
          result.matchedTitles,
          result.missingTitles,
          jobPosting.title
        ),
      ]);

      return text(JSON.stringify({
        matchId: matchRecord.id,
        seekerName: seeker.user.name,
        jobTitle: jobPosting.title,
        matchScore: result.matchScore,
        matchedSkills: result.matchedTitles,
        missingSkills: result.missingTitles,
        coaching,
        recruiterSummary: summary,
      }, null, 2));
    }
  );

  // 5. list_seekers
  server.tool(
    "list_seekers",
    "List all job seeker profiles with their names, job titles, and skill counts.",
    {},
    async () => {
      const seekers = await prisma.seekerProfile.findMany({
        include: { user: true, skills: true },
        orderBy: { createdAt: "desc" },
      });

      const result = seekers.map((s) => ({
        seekerProfileId: s.id,
        name: s.user.name,
        jobTitles: s.jobTitles,
        skillCount: s.skills.length,
        createdAt: s.createdAt,
      }));

      return text(JSON.stringify(result, null, 2));
    }
  );

  // 6. list_job_postings
  server.tool(
    "list_job_postings",
    "List all job postings with their titles, companies, and skill counts.",
    {},
    async () => {
      const postings = await prisma.jobPosting.findMany({
        include: {
          skills: true,
          recruiterProfile: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const result = postings.map((p) => ({
        jobPostingId: p.id,
        title: p.title,
        company: p.recruiterProfile.company,
        essentialSkills: p.skills.filter((s) => s.isEssential).length,
        optionalSkills: p.skills.filter((s) => !s.isEssential).length,
        createdAt: p.createdAt,
      }));

      return text(JSON.stringify(result, null, 2));
    }
  );
}
