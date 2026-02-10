import { CvUpload } from "@/components/cv-upload";

export default function SeekerPage() {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Build Your Skills Profile</h1>
        <p className="text-gray-600">
          Paste your CV below and we&apos;ll analyze it using AI to extract your skills
          and map them to the European ESCO taxonomy. Then you can explore
          occupations and get a personalized career transition plan.
        </p>
      </div>
      <CvUpload />
    </main>
  );
}
