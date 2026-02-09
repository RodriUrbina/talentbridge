import { SkillBadge } from "@/components/skill-badge";
import { RecruiterMatchPanel } from "@/components/recruiter-match-panel";
import Link from "next/link";

interface JobSkill {
  id: string;
  escoUri: string;
  title: string;
  skillType: string | null;
  isEssential: boolean;
}

interface PostingData {
  id: string;
  title: string;
  escoOccupationUri: string | null;
  skills: JobSkill[];
  recruiterProfile: {
    company: string | null;
    user: { name: string | null };
  };
}

interface SeekerData {
  id: string;
  user: { name: string | null };
  skills: { id: string }[];
}

async function getPosting(id: string): Promise<PostingData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";
  const res = await fetch(`${baseUrl}/api/recruiter/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function getSeekers(): Promise<SeekerData[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";
  const res = await fetch(`${baseUrl}/api/seeker`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function JobPostingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [posting, seekers] = await Promise.all([
    getPosting(id),
    getSeekers(),
  ]);

  if (!posting) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Job posting not found</h1>
        <Link href="/recruiter" className="text-blue-600 hover:underline">
          Create a new posting
        </Link>
      </main>
    );
  }

  const essential = posting.skills.filter((s) => s.isEssential);
  const optional = posting.skills.filter((s) => !s.isEssential);

  const seekerOptions = seekers.map((s) => ({
    id: s.id,
    name: s.user.name || "Anonymous Seeker",
    skillCount: s.skills.length,
  }));

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link
        href="/recruiter"
        className="text-blue-600 hover:underline text-sm mb-6 inline-block"
      >
        &larr; Back to Job Posting
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">{posting.title}</h1>
        <p className="text-gray-500">
          {posting.recruiterProfile.company || posting.recruiterProfile.user.name}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-8 mb-8">
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Essential Skills ({essential.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {essential.map((skill) => (
              <SkillBadge key={skill.id} title={skill.title} type="neutral" />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">
            Optional Skills ({optional.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {optional.map((skill) => (
              <SkillBadge key={skill.id} title={skill.title} type="neutral" />
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-400">
          Total: {posting.skills.length} skills from ESCO taxonomy
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Match Candidates</h2>
        <p className="text-gray-600">
          Select a candidate to see how their skills compare to this job&apos;s
          requirements.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <RecruiterMatchPanel
          jobPostingId={posting.id}
          seekers={seekerOptions}
        />
      </div>
    </main>
  );
}
