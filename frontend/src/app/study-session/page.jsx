"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "../theme-provider";
import { useStudySession } from "../../hooks/useStudySession";
import { useCognitiveSensor } from "../../hooks/useCognitiveSensor";
import { useClassroomStudent } from "../../hooks/useClassroomStudent";
import StudySessionLayout from "../../components/study-session/StudySessionLayout";

function StudySessionContent() {
  const searchParams = useSearchParams();
  const { theme } = useTheme();

  // All session state and logic lives in the hook; the camera sensor and the live class plug into it
  const session = useStudySession(searchParams);
  const sensor = useCognitiveSensor({ behaviorScore: session.behaviorScore });
  const classroom = useClassroomStudent(session, searchParams.get("classroom"));

  const { setExternalLoad } = session;
  const { active, reading } = sensor;
  useEffect(() => {
    setExternalLoad(active && reading.score !== null ? { score: reading.score, level: reading.level } : null);
  }, [active, reading.score, reading.level, setExternalLoad]);

  return (
    <StudySessionLayout
      {...session}
      sensor={sensor}
      classroom={classroom}
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
