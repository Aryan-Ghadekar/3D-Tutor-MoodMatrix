"use client";
import { useState } from "react";
import { useTheme } from "../../theme-provider";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User, 
  GraduationCap,
  Brain,
  Activity,
  Moon,
  Sun
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Switch from "@radix-ui/react-switch";

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState("student");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const isDark = theme === "dark";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    setTimeout(() => {
      console.log("Login attempt:", { ...formData, userType });
      setLoading(false);
      router.push("/onboarding/goal"); 
    }, 1500);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className={`w-full max-w-sm rounded-2xl p-6 shadow-xl border transition-all duration-300
      ${isDark
        ? "bg-gray-900/90 border-gray-800"
        : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              MoodMatrix
            </h1>
            <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              AI Learning Platform
            </p>
          </div>
        </Link>
        
        <div className="flex items-center gap-2">
          <Sun className={`w-3.5 h-3.5 ${isDark ? "text-gray-400" : "text-gray-600"}`} />
          <Switch.Root
            checked={isDark}
            onCheckedChange={toggleTheme}
            className={`w-10 h-5 rounded-full relative transition-colors
              ${isDark ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <Switch.Thumb
              className={`block w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${isDark ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </Switch.Root>
          <Moon className={`w-3.5 h-3.5 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
        </div>
      </div>

      <div className="text-center mb-5">
        <div className="inline-flex p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 mb-2">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-lg font-bold mb-1">Welcome Back</h2>
        <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"} mb-4`}>
          Sign in to continue your learning journey
        </p>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setUserType("student")}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs
              ${userType === "student"
                ? isDark
                  ? "bg-blue-900/40 border border-blue-600 text-blue-300"
                  : "bg-blue-100 border border-blue-400 text-blue-700"
                : isDark
                  ? "bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700"
                  : "bg-gray-100 border border-gray-300 text-gray-600 hover:bg-gray-200"
              }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Student
          </button>
          
          <button
            type="button"
            onClick={() => setUserType("teacher")}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs
              ${userType === "teacher"
                ? isDark
                  ? "bg-purple-900/40 border border-purple-600 text-purple-300"
                  : "bg-purple-100 border border-purple-400 text-purple-700"
                : isDark
                  ? "bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700"
                  : "bg-gray-100 border border-gray-300 text-gray-600 hover:bg-gray-200"
              }`}
          >
            <User className="w-3.5 h-3.5" />
            Teacher
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Email Address
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <Mail className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            </div>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-all
                ${isDark
                  ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-900/50"
                  : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                }`}
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Password
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <Lock className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className={`w-full pl-9 pr-9 py-2 rounded-lg border text-sm transition-all
                ${isDark
                  ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-900/50"
                  : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                }`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              {showPassword ? (
                <EyeOff className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              ) : (
                <Eye className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center">
            <input
              type="checkbox"
              className={`w-3 h-3 rounded border mr-2
                ${isDark
                  ? "bg-gray-800 border-gray-700 text-blue-500"
                  : "bg-gray-100 border-gray-300 text-blue-600"
                }`}
            />
            <span className={isDark ? "text-gray-400" : "text-gray-600"}>
              Remember me
            </span>
          </label>
          <Link
            href="#"
            className={`font-medium transition-colors
              ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2.5 rounded-lg font-medium transition-all transform hover:scale-[1.02] active:scale-95 text-sm mt-2
            ${loading
              ? "opacity-70 cursor-not-allowed"
              : ""
            }
            ${isDark
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90"
              : "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90"
            }`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Signing in...
            </div>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="text-center mt-4 pt-3 border-t border-gray-300 dark:border-gray-700">
        <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Don't have an account?{" "}
          <Link
            href="/auth/register"
            className={`font-medium transition-colors
              ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}