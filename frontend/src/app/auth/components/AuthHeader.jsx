"use client";
import { useTheme } from "../../theme-provider";
import { Activity } from "lucide-react";
import Link from "next/link";

export function AuthHeader() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header className="py-6 px-8">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <span
          className={`text-xl font-semibold ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          MoodMatrix
        </span>
      </Link>
    </header>
  );
}