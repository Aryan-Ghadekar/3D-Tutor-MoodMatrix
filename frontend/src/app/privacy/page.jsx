import Link from "next/link";

export const metadata = { title: "Privacy - MoodMatrix" };

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold mb-6">Privacy</h1>
      <p className="mb-4">
        Your account details (name, email, a salted password hash and your chosen learning goal) are stored by
        this application. Quiz results and study progress are stored in your browser and, for quiz results and
        lecture plans, in the application's data folder.
      </p>
      <p className="mb-4">
        Text extracted from the lectures you upload is sent to the configured AI provider (OpenRouter) to
        generate topics, slides and quizzes. Search terms for illustrations are sent to Wikimedia Commons.
      </p>
      <p className="mb-8">No camera, microphone or posture data is collected.</p>
      <Link href="/auth/register" className="text-blue-600 dark:text-blue-400 hover:underline">
        Back to registration
      </Link>
    </main>
  );
}
