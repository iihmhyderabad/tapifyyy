import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — Dynamic QR Manager" },
      { name: "description", content: "Sign in to manage dynamic QR codes and NFC cards." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If user already has an active session, redirect straight to dashboard
  useEffect(() => {
    let active = true;

    async function checkCurrentSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && active) {
          navigate({ to: "/dashboard" });
          return;
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        if (active) setCheckingAuth(false);
      }
    }

    checkCurrentSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && active) {
        navigate({ to: "/dashboard" });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const fillAdminCredentials = () => {
    setEmail("tapifyyy@vercel.app");
    setPassword("tapifyyyadmin");
    setErrorMessage(null);
    toast.info("Admin credentials filled");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please enter your email or username.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message || "Failed to sign in. Please verify your credentials.");
        toast.error(error.message || "Invalid email or password");
        return;
      }

      if (data.session) {
        toast.success("Welcome back! Signed in successfully.");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <p className="text-xs text-muted-foreground">Checking session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Background ambient accents */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Logo and Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-card border border-border p-3 shadow-sm mb-4">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-gold/15 p-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-gold" />
              <span className="h-2.5 w-2.5 rounded-[2px] border border-gold" />
              <span className="h-2.5 w-2.5 rounded-[2px] border border-gold" />
              <span className="h-2.5 w-2.5 rounded-[2px] bg-gold" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              Dynamic QR Manager
            </span>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your credentials to access full management of all cards and links.
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive"
            >
              <p className="font-medium">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="email-input">
                Username / Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="email-input"
                  type="email"
                  required
                  autoComplete="email"
                  className="field-input pl-9"
                  placeholder="tapifyyy@vercel.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="password-input">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="field-input pl-9 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gold mt-2 w-full py-2.5 text-sm font-semibold shadow"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Quick Helper Credentials Card */}
          <div className="mt-6 rounded-xl border border-border/70 bg-secondary/50 p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                <span>Admin Credentials</span>
              </div>
              <button
                type="button"
                onClick={fillAdminCredentials}
                className="text-[11px] font-semibold text-gold hover:underline cursor-pointer"
              >
                Autofill
              </button>
            </div>
            <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
              <p>User: <span className="text-foreground">tapifyyy@vercel.app</span></p>
              <p>Password: <span className="text-foreground">tapifyyyadmin</span></p>
            </div>
          </div>
        </div>

        {/* Footer with Portfolio Link */}
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <p>Protected by Supabase Auth · Full administrative access</p>
          <p>
            Made by{" "}
            <a
              href="https://naveen-kr.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gold hover:underline transition-colors"
            >
              Naveen Kumar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
