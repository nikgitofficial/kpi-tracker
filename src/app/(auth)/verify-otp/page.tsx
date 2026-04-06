"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, RotateCcw } from "lucide-react";

const RESEND_COOLDOWN = 60;

/* ── Inline OTP Input (replaces dark-theme OTPInput component) ── */
function OTPInput({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  error: boolean;
  disabled: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, char: string) => {
    const digit = char.replace(/\D/g, "").slice(-1);
    const arr = value.padEnd(6, " ").split("");
    arr[i] = digit || " ";
    const next = arr.join("").trimEnd();
    onChange(next);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (value[i]) {
        const arr = value.padEnd(6, " ").split("");
        arr[i] = " ";
        onChange(arr.join("").trimEnd());
      } else if (i > 0) {
        inputsRef.current[i - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`w-11 h-13 text-center text-lg font-semibold rounded-xl border transition-all duration-150 bg-white text-slate-900 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed
            ${error
              ? "border-red-300 focus:border-red-400 focus:ring-red-500/20"
              : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-500/30"
            }`}
          style={{ height: "52px" }}
        />
      ))}
    </div>
  );
}

export default function VerifyOTPPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!email) router.replace("/forgot-password");
  }, [email, router]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCooldown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async () => {
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Invalid code");
      if (res.status !== 400) setOtp("");
      return;
    }
    router.push(
      `/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`
    );
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setError("");
    setOtp("");
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResending(false);
    startCooldown();
  };

  useEffect(() => {
    if (otp.length === 6 && !loading && !resending) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, resending]);

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) =>
    a + "*".repeat(Math.max(0, b.length)) + c
  );

  return (
    <div className="w-full max-w-[400px] bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/60 p-8">

      {/* Heading */}
      <div className="mb-7">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 mb-4">
          <ShieldCheck size={20} className="text-indigo-500" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
          Enter verification code
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-slate-700">{maskedEmail}</span>
        </p>
      </div>

      <div className="space-y-6">
        <OTPInput
          value={otp}
          onChange={setOtp}
          error={!!error}
          disabled={loading}
        />

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            {error}
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={otp.length < 6 || loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-all duration-150 shadow-sm shadow-indigo-200"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Verifying…
            </>
          ) : (
            "Verify code"
          )}
        </button>

        <div className="text-center">
          <p className="text-sm text-slate-500">
            Didn&apos;t receive the code?{" "}
            {cooldown > 0 ? (
              <span className="text-slate-400">
                Resend in{" "}
                <span className="font-mono font-medium text-slate-600">{cooldown}s</span>
              </span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-600 font-medium transition-colors disabled:opacity-50"
              >
                <RotateCcw size={12} className={resending ? "animate-spin" : ""} />
                Resend
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-100 text-center">
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={14} />
          Try a different email
        </Link>
      </div>
    </div>
  );
}