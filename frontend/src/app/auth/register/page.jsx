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
  Sun,
  Briefcase,
  Phone,
  BookOpen
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Switch from "@radix-ui/react-switch";

export default function RegisterPage() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userType, setUserType] = useState("student");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    specialization: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const isDark = theme === "dark";

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "At least 6 characters";
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }
    
    if (userType === "teacher" && !formData.specialization) {
      newErrors.specialization = "Required for teachers";
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setErrors({});
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          specialization: formData.specialization,
          role: userType,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors({ form: data.error || "Could not create the account. Please try again." });
        return;
      }
      router.push("/auth/login?registered=true");
    } catch {
      setErrors({ form: "Cannot reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: ""
      });
    }
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

      <div className="text-center mb-4">
        <div className="inline-flex p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 mb-2">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-lg font-bold mb-1">Create Account</h2>
        <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"} mb-3`}>
          Join MoodMatrix to transform your learning
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
            <Briefcase className="w-3.5 h-3.5" />
            Teacher
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {errors.form && (
          <div role="alert" className="text-xs rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
            {errors.form}
          </div>
        )}
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Full Name
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <User className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            </div>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-all
                ${errors.name
                  ? isDark
                    ? "border-red-500 bg-red-900/20"
                    : "border-red-400 bg-red-50"
                  : isDark
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-900/50"
                    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                }`}
              placeholder="John Doe"
            />
          </div>
          {errors.name && (
            <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
              {errors.name}
            </p>
          )}
        </div>

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
              className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-all
                ${errors.email
                  ? isDark
                    ? "border-red-500 bg-red-900/20"
                    : "border-red-400 bg-red-50"
                  : isDark
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-900/50"
                    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                }`}
              placeholder="you@example.com"
            />
          </div>
          {errors.email && (
            <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
              {errors.email}
            </p>
          )}
        </div>

        {userType === "teacher" && (
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Specialization
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <BookOpen className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              </div>
              <input
                type="text"
                name="specialization"
                value={formData.specialization}
                onChange={handleChange}
                className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-all
                  ${errors.specialization
                    ? isDark
                      ? "border-red-500 bg-red-900/20"
                      : "border-red-400 bg-red-50"
                    : isDark
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-900/50"
                      : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                  }`}
                placeholder="e.g., Computer Science"
              />
            </div>
            {errors.specialization && (
              <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                {errors.specialization}
              </p>
            )}
          </div>
        )}

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
              className={`w-full pl-9 pr-9 py-2 rounded-lg border text-sm transition-all
                ${errors.password
                  ? isDark
                    ? "border-red-500 bg-red-900/20"
                    : "border-red-400 bg-red-50"
                  : isDark
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
          {errors.password && (
            <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
              {errors.password}
            </p>
          )}
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <Lock className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            </div>
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full pl-9 pr-9 py-2 rounded-lg border text-sm transition-all
                ${errors.confirmPassword
                  ? isDark
                    ? "border-red-500 bg-red-900/20"
                    : "border-red-400 bg-red-50"
                  : isDark
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-900/50"
                    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                }`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              {showConfirmPassword ? (
                <EyeOff className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              ) : (
                <Eye className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
              {errors.confirmPassword}
            </p>
          )}
        </div>

        <div className="flex items-start text-xs pt-1">
          <input
            type="checkbox"
            required
            className={`w-3 h-3 rounded border mr-2 mt-0.5
              ${isDark
                ? "bg-gray-800 border-gray-700 text-blue-500"
                : "bg-gray-100 border-gray-300 text-blue-600"
              }`}
          />
          <span className={isDark ? "text-gray-400" : "text-gray-600"}>
            I agree to the{" "}
            <Link href="/terms" className={`font-medium ${isDark ? "text-blue-400" : "text-blue-600"}`}>
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className={`font-medium ${isDark ? "text-blue-400" : "text-blue-600"}`}>
              Privacy Policy
            </Link>
          </span>
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
              Creating account...
            </div>
          ) : (
            `Register as ${userType === "student" ? "Student" : "Teacher"}`
          )}
        </button>
      </form>

      <div className="text-center mt-4 pt-3 border-t border-gray-300 dark:border-gray-700">
        <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className={`font-medium transition-colors
              ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}