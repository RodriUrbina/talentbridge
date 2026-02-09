import { SkillsProfile } from "@/components/skills-profile";
import { SeekerMatchPanel } from "@/components/seeker-match-panel";
import Link from "next/link";

interface SeekerData {
  id: string;
  user: { name: string | null };
  jobTitles: string[];
  education: string[];
  skills: {
    id: string;
    escoUri: string;
    title: string;
    skillType: string | null;
  }[];
}

interface JobPostingData {
  id: string;
  title: string;
  skills: { isEssential: boolean }[];
  recruiterProfile: {
    company: string | null;
  };
}

async function getSeeker(id: string): Promise<SeekerData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";
  const res = await fetch(`${baseUrl}/api/seeker/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function getJobPostings(): Promise<JobPostingData[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";
  const res = await fetch(`${baseUrl}/api/recruiter`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function SeekerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [seeker, jobPostings] = await Promise.all([
    getSeeker(id),
    getJobPostings(),
  ]);

  if (!seeker) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Seeker not found</h1>
        <Link href="/seeker" className="text-blue-600 hover:underline">
          Create a new profile
        </Link>
      </main>
    );
  }

  const jobOptions = jobPostings.map((jp) => ({
    id: jp.id,
    title: jp.title,
    company: jp.recruiterProfile.company,
    essentialCount: jp.skills.filter((s) => s.isEssential).length,
    optionalCount: jp.skills.filter((s) => !s.isEssential).length,
  }));

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link
        href="/seeker"
        className="text-blue-600 hover:underline text-sm mb-6 inline-block"
      >
        &larr; Back to CV Upload
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Skills Profile</h1>
        <p className="text-gray-600">
          Your CV has been analyzed and your skills mapped to the ESCO taxonomy.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-8">
        <SkillsProfile
          name={seeker.user.name || "Anonymous Seeker"}
          jobTitles={seeker.jobTitles}
          education={seeker.education}
        />
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Match Against a Job</h2>
        <p className="text-gray-600">
          Select a job posting to see how your skills compare and get
          personalized coaching on how to close any gaps.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <SeekerMatchPanel
          seekerProfileId={seeker.id}
          jobPostings={jobOptions}
        />
      </div>
    </main>
  );
}
