"use client";
import { usePathname } from "next/navigation";
import { AuthHeader } from "./auth/components/AuthHeader";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');

  return (
    <>
      {/* {!isAuthPage && <AuthHeader />} */}
      <main>{children}</main>
    </>
  );
}