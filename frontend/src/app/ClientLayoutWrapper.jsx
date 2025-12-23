"use client";
import { usePathname } from "next/navigation";
import Header from "../components/Header";

export default function ClientLayoutWrapper({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {!isAuthPage && <Header />}
      <main>{children}</main>
    </div>
  );
}