"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, ArrowRight, Eye, EyeOff, TrendingUp, Users, Clock, Zap, Shield, Activity, CheckCircle2, BarChart3, FileText, Target } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        {children}
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setServerError("");
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (result?.error) {
      setServerError("Invalid email or password. Please try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="flex min-h-dvh">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 flex-col justify-between relative overflow-y-auto">
        <div className="relative z-10 p-12">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Image src="/logo.png" alt="KPI Logo" fill className="object-contain p-2" priority />
            </div>
            <div>
              <span className="font-bold text-2xl tracking-tight">
                <span className="text-blue-400">K</span>
                <span className="text-red-400">P</span>
                <span className="text-amber-400">I</span>
              </span>
              <p className="text-xs text-indigo-300 mt-0.5">Performance Analytics</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30">
                <Zap className="w-3 h-3 text-indigo-300" />
                <span className="text-xs font-medium text-indigo-300">Inclusive for HerbJoy & FlexSkill Teams</span>
              </div>
              
              <p className="text-indigo-200 text-lg leading-relaxed">
                Monitor agent performance for  FlexSkill teams, track productivity metrics, and manage EOD records in real-time.
              </p>
            </div>

            {/* Key Features */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-indigo-700">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">Core Features</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-1 h-auto bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-white font-medium mb-1">Real-time Agent Monitoring</p>
                    <p className="text-indigo-200 text-sm">Track HerbJoy & FlexSkill agent activity, response times, and task completion rates</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-1 h-auto bg-emerald-500 rounded-full"></div>
                  <div>
                    <p className="text-white font-medium mb-1">Productivity Analytics</p>
                    <p className="text-indigo-200 text-sm">Measure individual and team output with detailed performance metrics for both departments</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-1 h-auto bg-amber-500 rounded-full"></div>
                  <div>
                    <p className="text-white font-medium mb-1">EOD Reports & Records</p>
                    <p className="text-indigo-200 text-sm">Generate end-of-day reports with complete productivity summaries for HerbJoy and FlexSkill</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-1 h-auto bg-purple-500 rounded-full"></div>
                  <div>
                    <p className="text-white font-medium mb-1">Performance Trends</p>
                    <p className="text-indigo-200 text-sm">Visualize historical data and identify improvement opportunities across teams</p>
                  </div>
                </div>
              </div>
            </div>

           

            {/* Productivity Flow */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3 pb-2 border-b border-indigo-700">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">Unified Productivity Workflow</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-indigo-200">Track daily agent tasks and assignments across HerbJoy & FlexSkill</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-indigo-200">Monitor time spent on each activity per department</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-indigo-200">Generate automated EOD performance reports for both teams</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Users className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-indigo-200">Compare HerbJoy vs FlexSkill team performance metrics</span>
                </div>
              </div>
            </div>

            {/* Inclusive Note */}
            <div className="mt-6 p-4 bg-indigo-500/10 rounded-lg border border-indigo-400/20">
              <p className="text-indigo-300 text-sm text-center">
                ✨ Comprehensive solution for <strong className="text-white">FlexSkill</strong> teams
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 p-12 pt-0">
          <div className="flex items-center justify-between text-[11px] text-indigo-400 border-t border-indigo-800 pt-6">
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3" />
              <span>Secure Enterprise Access</span>
            </div>
            <span>Encrypted Data</span>
            <span>© 2026 KPI Analytics</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-[400px] bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/60 p-8">

          {/* Logo + brand (mobile only) */}
          <div className="flex items-center gap-2.5 mb-7 lg:hidden">
            <div className="flex-shrink-0 w-7 h-7 relative">
              <Image src="/logo.png" alt="Logo" fill className="object-contain" priority />
            </div>
            <span className="font-semibold text-base tracking-tight">
              <span className="text-[#2EA8FF]">K</span>
              <span className="text-[#FF4D4D]">P</span>
              <span className="text-[#F4C542]">I</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to access the KPI Dashboard</p>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading || isSubmitting}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mb-5 shadow-sm"
          >
            {googleLoading ? (
              <svg className="animate-spin w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <GoogleIcon />
            )}
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or sign in with email</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Email address" icon={<Mail size={15} />} error={errors.email?.message}>
              <input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
              />
            </Field>

            <Field label="Password" icon={<Lock size={15} />} error={errors.password?.message}>
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </Field>

            <div className="flex justify-end -mt-1">
              <Link
                href="/forgot-password"
                className="text-xs text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {serverError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-all duration-150 shadow-sm shadow-indigo-200 mt-1"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}