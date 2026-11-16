import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw redirect({ to: "/login" });
        }
      } catch (err) {
        // If it's a TanStack redirect, rethrow it
        if (err && typeof err === "object" && "to" in err) {
          throw err;
        }
        throw redirect({ to: "/login" });
      }
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        navigate({ to: "/login" });
      } else {
        setSession(session);
      }
    }).catch(() => {
      if (!mounted) return;
      navigate({ to: "/login" });
    });

    // Listen for auth changes (e.g. sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || !newSession) {
        setSession(null);
        navigate({ to: "/login" });
      } else {
        setSession(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <p className="text-xs text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <Outlet />;
}
