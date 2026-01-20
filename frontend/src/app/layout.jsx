import { Inter } from "next/font/google";
import { ThemeProvider } from "./theme-provider";
import ClientLayout from "./ClientLayout";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "MoodMatrix - AI Learning Platform",
  description: "Transform your learning experience with AI-powered emotional intelligence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/video-error-prevention.js" async />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <ClientLayout>{children}</ClientLayout>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}