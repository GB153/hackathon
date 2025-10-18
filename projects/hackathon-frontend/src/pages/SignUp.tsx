import { useMemo, useState } from "react";
import Button from "@/components/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Signup() {
  const backend = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);
  const pwMatch = pwd.length > 0 && pwd === confirm;
  const canSubmit = emailValid && pwMatch;

  const sanitize = (plain: string) => plain.replace(/\s+/g, " ").trim();

  // Google signup → redirect to /dashboard after success
  const handleGoogleSignup = () => {
    const next = encodeURIComponent(window.location.origin + "/dashboard");
    window.location.href = `${backend}/auth/google/login?next=${next}`;
  };

  // Email/password signup → redirect to /dashboard
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      const res = await fetch(`${backend}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // save session cookie
        body: JSON.stringify({ email, password: pwd }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.detail || "Signup failed");
        return;
      }

      // account created + logged in
      window.location.href = "/dashboard";
    } catch {
      alert("Network error. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FFEDC5] text-[#FA812F] font-display">
      {/* LEFT PANEL */}
      <div className="flex flex-1 flex-col justify-center px-8 sm:px-12 md:px-20 lg:px-28 bg-white/10 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 mb-8">
          <img src="/logo.svg" alt="Radcliffe Logo" className="h-28 w-auto select-none" />
          <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
          <p className="text-base text-[#FA812F]/80">Get started with Radcliffe</p>
        </div>

        <form className="flex flex-col gap-6 w-full max-w-sm mx-auto" onSubmit={onSubmit} noValidate>
          {/* Email */}
          <div className="grid gap-3">
            <Label htmlFor="su-email" className="text-[#FA812F] text-sm font-display">
              Email
            </Label>
            <Input
              id="su-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setEmail(sanitize(e.clipboardData.getData("text/plain")));
              }}
              className="rounded-2xl border border-[#FA812F]/60 bg-transparent text-[#FA812F] placeholder-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 font-display"
              required
            />
            {!emailValid && email.length > 0 && <p className="text-sm text-[#d01818]">Enter a valid email.</p>}
          </div>

          {/* Password */}
          <div className="grid gap-3">
            <Label htmlFor="su-pwd" className="text-[#FA812F] text-sm font-display">
              Password
            </Label>
            <Input
              id="su-pwd"
              type="password"
              placeholder="Password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setPwd(sanitize(e.clipboardData.getData("text/plain")));
              }}
              className="rounded-2xl border border-[#FA812F]/60 bg-transparent text-[#FA812F] placeholder-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 font-display"
              required
            />
          </div>

          {/* Confirm */}
          <div className="grid gap-3">
            <Label htmlFor="su-confirm" className="text-[#FA812F] text-sm font-display">
              Confirm Password
            </Label>
            <Input
              id="su-confirm"
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setConfirm(sanitize(e.clipboardData.getData("text/plain")));
              }}
              className="rounded-2xl border border-[#FA812F]/60 bg-transparent text-[#FA812F] placeholder-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 font-display"
              required
            />
            {confirm.length > 0 && !pwMatch && <p className="text-sm text-[#d01818]">Passwords do not match.</p>}
          </div>

          <Button
            type="submit"
            label="Sign up"
            disabled={!canSubmit}
            className="w-full rounded-2xl text-lg h-12 disabled:opacity-100 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-[0_6px_0_0_rgba(250,129,47,0.4)]"
          />

          {/* Divider */}
          <div className="relative text-center text-sm text-[#FA812F]/70 font-display">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#FA812F]/30" />
            </div>
            <span className="relative bg-[#FFEDC5] px-3 z-10">or continue with</span>
          </div>

          {/* Google signup */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full rounded-2xl text-lg h-12 font-display flex items-center justify-center gap-3 bg-[#FA812F] text-white border border-[#FA812F]/50 shadow-[0_6px_0_0_rgba(250,129,47,0.4)] transition-all duration-200 ease-out hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(250,129,47,0.4)] active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(250,129,47,0.4)] focus:outline-none"
          >
            <img src="/google.png" alt="Google" className="w-5 h-5" />
            Sign up with Google
          </button>
        </form>

        <p className="text-center text-sm text-[#FA812F]/80 mt-6 font-display">
          Already have an account?{" "}
          <a href="/login" className="underline hover:text-[#FA812F]">
            Log in
          </a>
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div className="hidden md:flex flex-1 items-center justify-center relative">
        <img
          src="/ship_signup.png"
          alt="Signup Illustration"
          className="absolute inset-0 w-full h-full object-cover opacity-90 select-none"
        />
      </div>
    </div>
  );
}
