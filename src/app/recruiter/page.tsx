import { JobForm } from "@/components/job-form";

export default function RecruiterPage() {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Post a Job</h1>
        <p className="text-gray-600">
          Enter a job title and we&apos;ll automatically map it to the ESCO
          taxonomy, extracting all essential and optional skills required for the
          role. This creates a standardized skills profile for matching with
          candidates.
        </p>
      </div>
      <JobForm />
    </main>
  );
}
