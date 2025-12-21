"use client";
import { useTheme } from "../theme-provider";
import { Activity } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen transition-colors duration-500 flex items-center justify-center px-4
      ${isDark
        ? "bg-gradient-to-br from-[#0B1220] via-[#0E1628] to-[#0A1020]"
        : "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50"
      }`}
    >
      {children}
    </div>
  );
}