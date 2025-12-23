"use client";
import { usePathname } from "next/navigation";
import Header from "../components/Header";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');

  return (
    <>
      {!isAuthPage && <Header />}
      <main>{children}</main>
    </>
  );
}