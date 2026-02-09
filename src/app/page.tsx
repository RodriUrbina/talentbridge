import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          Talent<span className="text-blue-600">Bridge</span>
        </h1>
        <p className="text-xl text-gray-600">
          Connecting job seekers with recruiters through ESCO skills matching
          and AI-powered career coaching.
        </p>

        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/seeker"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            I&apos;m a Job Seeker
          </Link>
          <Link
            href="/recruiter"
            className="px-8 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            I&apos;m a Recruiter
          </Link>
        </div>
      </div>
    </main>
  );
}
