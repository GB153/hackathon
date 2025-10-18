import { useMemo, useState } from "react";
import Button from "../components/Button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
  const backend = import.meta.env.VITE_API_BASE_URL;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);
  const canSubmit = emailValid && password.length > 0;

  // Sanitize any pasted content (trim + normalize spaces)
  const sanitizePaste = (e: React.ClipboardEvent<HTMLInputElement>, setter: (v: string) => void) => {
    e.preventDefault();
    const plain = e.clipboardData.getData("text/plain");
    const cleaned = plain.replace(/\s+/g, " ").trim();
    setter(cleaned);
  };

  // Google OAuth login → redirect to /dashboard after success
  const handleGoogleLogin = () => {
    window.location.href = `${backend}/auth/google/login?next=${encodeURIComponent(window.location.origin + "/dashboard")}`;
  };

  // Email/password login → redirect to /dashboard
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      const res = await fetch(`${backend}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // important: saves HttpOnly cookie
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.detail || "Invalid credentials");
        return;
      }

      // Logged in successfully
      window.location.href = "/dashboard";
    } catch {
      alert("Network error. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FFEDC5] text-[#FA812F] font-display">
      {/* LEFT PANEL */}
      <div className="flex flex-1 flex-col justify-center px-8 sm:px-12 md:px-20 lg:px-28 bg-white/10 backdrop-blur-md">
        {/* Logo and heading */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <img src="/logo.svg" alt="Radcliffe Logo" className="h-28 w-auto select-none" />
          <h1 className="text-3xl font-bold text-[#FA812F] tracking-tight font-display">Welcome back</h1>
          <p className="text-base text-[#FA812F]/80 font-display">Log in to your Radcliffe account</p>
        </div>

        {/* Login form */}
        <form className="flex flex-col gap-6 w-full max-w-sm mx-auto" onSubmit={onSubmit} noValidate>
          {/* Email */}
          <div className="grid gap-3">
            <Label htmlFor="email" className="text-[#FA812F] text-sm font-display">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onPaste={(e) => sanitizePaste(e, setEmail)}
              className="rounded-2xl bg-transparent text-[#FA812F] placeholder-[#FA812F]/60 font-display border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 outline-none transition-all duration-150"
              required
            />
          </div>

          {/* Password */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[#FA812F] text-sm font-display">
                Password
              </Label>
              <a href="#" className="text-sm text-[#FA812F]/80 hover:text-[#FA812F] underline-offset-4 hover:underline font-display">
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPaste={(e) => sanitizePaste(e, setPassword)}
              className="rounded-2xl bg-transparent text-[#FA812F] placeholder-[#FA812F]/60 font-display border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 outline-none transition-all duration-150"
              required
            />
          </div>

          <Button type="submit" label="Login" className="w-full rounded-2xl text-lg h-12" disabled={!canSubmit} />

          {/* Divider */}
          <div className="relative text-center text-sm text-[#FA812F]/70 font-display">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#FA812F]/30" />
            </div>
            <span className="relative bg-[#FFEDC5] px-3 z-10">or continue with</span>
          </div>

          {/* Google login button */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full rounded-2xl text-lg h-12 font-display flex items-center justify-center gap-3 bg-[#FA812F] text-white border border-[#FA812F]/50 shadow-[0_6px_0_0_rgba(250,129,47,0.4)] transition-all duration-200 ease-out hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(250,129,47,0.4)] active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(250,129,47,0.4)] focus:outline-none"
          >
            <img src="/google.png" alt="Google" className="w-5 h-5" />
            Login with Google
          </button>
        </form>

        <p className="text-center text-sm text-[#FA812F]/80 mt-6 font-display">
          Don’t have an account?{" "}
          <a href="/signup" className="underline hover:text-[#FA812F]">
            Sign up
          </a>
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div className="hidden md:flex flex-1 items-center justify-center relative">
        <img
          src="/ship_login.png"
          alt="Background Illustration"
          className="absolute inset-0 w-full h-full object-cover opacity-90 select-none"
        />
      </div>
    </div>
  );
}
