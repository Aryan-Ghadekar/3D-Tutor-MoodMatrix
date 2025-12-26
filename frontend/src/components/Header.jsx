"use client";
import { useTheme } from "../app/theme-provider";
import { Moon, Sun, Home, Activity } from "lucide-react";
import Link from "next/link";
import * as Switch from "@radix-ui/react-switch";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md transition-colors
      ${
        isDark
          ? "bg-[#0B1220]/80 border-b border-gray-800"
          : "bg-white/80 border-b border-gray-200"
      }`}
    >
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">

          {/* ================= LEFT: LOGO ================= */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span
              className={`text-lg font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              MoodMatrix
            </span>
          </Link>

          {/* ================= CENTER: NAV LINKS ================= */}
          <nav
            className={`hidden md:flex items-center gap-10 text-sm
            ${isDark ? "text-gray-300" : "text-gray-600"}`}
          >
            <Link
              href="/"
              className="flex items-center gap-2 hover:text-blue-500 transition"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Link>

            <Link
              href="/lecture-input"
              className="hover:text-blue-500 transition"
            >
              Study Session
            </Link>

            <Link
              href="#"
              className="hover:text-blue-500 transition"
            >
              Analytics
            </Link>

            <Link
              href="#"
              className="hover:text-blue-500 transition"
            >
              Settings
            </Link>
          </nav>

          {/* ================= RIGHT: THEME TOGGLE ================= */}
          <div className="flex items-center gap-3">
            <Sun className={`w-4 h-4 ${isDark ? "text-gray-400" : "text-gray-600"}`} />

            <Switch.Root
              checked={isDark}
              onCheckedChange={toggleTheme}
              className={`w-12 h-6 rounded-full relative transition-colors
              ${
                isDark
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
            >
              <Switch.Thumb
                className={`block w-5 h-5 bg-white rounded-full transition-transform duration-200
                ${isDark ? "translate-x-7" : "translate-x-0.5"}`}
              />
            </Switch.Root>

            <Moon className={`w-4 h-4 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
          </div>

        </div>
      </div>
    </header>
  );
}
