import { useMemo, useState, useEffect } from "react";
import { useSnackbar } from "notistack";
import Button from "./Button";

export default function MailingList() {
  const { enqueueSnackbar } = useSnackbar();

  const [email, setEmail] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | "ok" | "already" | "error">(null);

  const hasContent = email.trim().length > 0;

  const apiBase = import.meta.env.VITE_API_BASE_URL;
  const endpoint = `${apiBase}/subscribe`;

  const isValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  // Reset border when editing after submit
  useEffect(() => {
    if (submitAttempted && ["ok", "already", "error"].includes(result || "")) {
      setResult(null);
    }
  }, [email, submitAttempted, result]);

  // Reset border after 5s
  useEffect(() => {
    if (["ok", "already", "error"].includes(result || "")) {
      const t = setTimeout(() => {
        setSubmitAttempted(false);
        setResult(null);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [result]);

  // Border color logic
  const borderClass = (() => {
    if (isFocused && !submitAttempted) return "border-[#FFEDC5]/75";
    if (!submitAttempted) return "border-transparent";
    if (result === "ok" || result === "already") return "border-[#4cbb17]";
    if (result === "error" || !isValid) return "border-[#d01818]/75";
    return "border-transparent";
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasContent) return;

    setSubmitAttempted(true);
    setResult(null);

    if (!isValid) {
      enqueueSnackbar("Please enter a valid email.", { variant: "warning" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();

      if (data?.ok && data?.already) {
        setResult("already");
        enqueueSnackbar("You’re already on the list!", { variant: "info" });
      } else if (data?.ok) {
        setResult("ok");
        enqueueSnackbar("Thanks! You’re on the list.", { variant: "success" });
        setEmail("");
      } else {
        setResult("error");
        enqueueSnackbar("Hmm, something went wrong. Try again.", { variant: "error" });
      }
    } catch {
      setResult("error");
      enqueueSnackbar("Network error. Please try again.", { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed left-1/2 top-[80vh] z-40 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 px-4">
      <form
        onSubmit={onSubmit}
        className={[
          "flex items-center justify-between",
          // more rounded than button to balance proportions
          "rounded-3xl bg-[#FFEDC5]/50 backdrop-blur-[9px]",
          borderClass,
          "border-[1.5px]",
          // ⬇ tighter padding to hug the button & input more closely
          "px-4 sm:px-6 py-2.5 sm:py-3",
          "transition-colors duration-200",
          "shadow-[0_10px_30px_rgba(0,0,0,0.12)]",
        ].join(" ")}
      >
        <label htmlFor="ml-email" className="sr-only">
          Email
        </label>

        <input
          id="ml-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="What’s your email?"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onPaste={(e) => {
            e.preventDefault();
            const plain = e.clipboardData.getData("text/plain");
            const cleaned = plain.replace(/\s+/g, " ").trim();
            setEmail(cleaned);
            queueMicrotask(() => {
              const el = document.getElementById("ml-email") as HTMLInputElement | null;
              if (el) {
                const v = el.value;
                el.value = "";
                el.value = v;
                try {
                  el.setSelectionRange(v.length, v.length);
                } catch {}
              }
            });
          }}
          aria-invalid={submitAttempted && !isValid}
          className={[
            // ⬇ add this token back so the CSS overrides match
            "mailing-input",
            "flex-1 bg-transparent border-none outline-none",
            "text-white placeholder-white/80",
            "text-lg sm:text-xl font-display",
            "px-3",
            "appearance-none focus:outline-none focus:ring-0",
          ].join(" ")}
        />

        <Button
          label={submitting ? "Joining..." : "Join waitlist"}
          disabled={submitting || !hasContent}
          type="submit"
          className="rounded-2xl h-12 sm:h-14 px-8 text-lg sm:text-xl flex-shrink-0"
        />
      </form>
    </div>
  );
}
