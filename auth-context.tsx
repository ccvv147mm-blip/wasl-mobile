import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    // Capture referral code from URL (?ref=username) into localStorage
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get("ref");
        if (ref && !localStorage.getItem("pending_referrer")) {
          localStorage.setItem("pending_referrer", ref);
        }
      } catch {
        /* ignore */
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      router.invalidate();
      queryClient.invalidateQueries();

      // On sign-in, claim any pending referral once
      if (event === "SIGNED_IN" && s?.user) {
        const pending = localStorage.getItem("pending_referrer");
        if (pending) {
          supabase.rpc("claim_referral", { _referrer_username: pending }).then(() => {
            localStorage.removeItem("pending_referrer");
          });
        }
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
