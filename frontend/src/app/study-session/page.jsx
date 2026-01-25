"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTheme } from "../theme-provider";
import { useStudySession } from "../../hooks/useStudySession";
import StudySessionLayout from "../../components/study-session/StudySessionLayout";

function StudySessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  // Use the custom hook to manage all session state and logic
  const sessionData = useStudySession(searchParams, router);

  return (
    <StudySessionLayout
      {...sessionData}
      theme={theme}
    />
  );
}

export default function StudySessionPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Initializing intelligent learning session...</p>
        </div>
      </div>
    }>
      <StudySessionContent />
    </Suspense>
  );
}
