import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { migrateLocalToCloud } from "./useSync";

export interface AuthUser {
  id: string;
  email: string;
  provider: "supabase" | "guest";
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: recover session from Supabase or localStorage
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Try Supabase session first
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const su: AuthUser = {
          id: session.user.id,
          email: session.user.email || "",
          provider: "supabase",
        };
        if (!cancelled) {
          // Cache in localStorage for quick recovery on next mount
          localStorage.setItem("vocab_current_user", JSON.stringify(su));
          setUser(su);

          // Check if there's old localStorage data to migrate
          await maybeMigrate(su);
        }
        if (!cancelled) setLoading(false);
        return;
      }

      // Fall back to cached user in localStorage
      const stored = localStorage.getItem("vocab_current_user");
      if (stored && !cancelled) {
        try {
          const parsed = JSON.parse(stored) as AuthUser;
          // Ensure provider field exists (backward compat)
          if (!parsed.provider) {
            parsed.provider = parsed.email === "游客" ? "guest" : "supabase";
          }
          setUser(parsed);
        } catch {
          // corrupted, ignore
        }
      }
      if (!cancelled) setLoading(false);
    };

    init();

    // Listen for auth state changes (token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          const su: AuthUser = {
            id: session.user.id,
            email: session.user.email || "",
            provider: "supabase",
          };
          localStorage.setItem("vocab_current_user", JSON.stringify(su));
          setUser(su);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  /** Detect and migrate old localStorage data to new Supabase UUID */
  async function maybeMigrate(newUser: AuthUser) {
    if (newUser.provider !== "supabase") return;

    // Already migrated?
    if (localStorage.getItem(`vocab_migrated_${newUser.id}`)) return;

    // Find old localStorage keys keyed by email (old-style userId)
    const emailKey = newUser.email;
    const hasOldData = localStorage.getItem(`vocab_words_${emailKey}`)
      || localStorage.getItem(`vocab_learning_${emailKey}`)
      || localStorage.getItem(`vocab_schedule_${emailKey}`);

    if (hasOldData) {
      const ok = await migrateLocalToCloud(emailKey, newUser.id);
      if (ok) {
        // Remove old keys
        localStorage.removeItem(`vocab_words_${emailKey}`);
        localStorage.removeItem(`vocab_learning_${emailKey}`);
        localStorage.removeItem(`vocab_schedule_${emailKey}`);
        localStorage.removeItem(`vocab_daily_${emailKey}`);
      }
    }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { message: translateAuthError(error.message) } as unknown as Error;
    }

    // If session is available, email confirmation is disabled — auto sign in
    if (data.session && data.user) {
      const newUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || email,
        provider: "supabase",
      };
      localStorage.setItem("vocab_current_user", JSON.stringify(newUser));
      setUser(newUser);
      return null;
    }

    // Email confirmation is required
    return {
      message: "注册成功！请检查邮箱并点击确认链接，然后返回登录。",
    } as unknown as Error;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { message: translateAuthError(error.message) } as unknown as Error;
    }

    if (data.user) {
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || email,
        provider: "supabase",
      };
      localStorage.setItem("vocab_current_user", JSON.stringify(authUser));
      setUser(authUser);

      // Check and migrate old data
      await maybeMigrate(authUser);
    }
    return null;
  };

  const signInAsGuest = async () => {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const guestUser: AuthUser = { id: guestId, email: "游客", provider: "guest" };
    localStorage.setItem("vocab_current_user", JSON.stringify(guestUser));
    setUser(guestUser);
    return null;
  };

  const signOut = async () => {
    const current = user;
    localStorage.removeItem("vocab_current_user");
    setUser(null);

    if (current?.provider === "supabase") {
      await supabase.auth.signOut().catch(() => { /* ignore */ });
    }
  };

  return { user, loading, signUp, signIn, signInAsGuest, signOut };
}

// ── Helpers ────────────────────────────────────────────────────────

/** Translate Supabase Auth error messages to Chinese */
function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "邮箱或密码错误",
    "Email not confirmed": "邮箱尚未验证，请检查邮箱",
    "User already registered": "该邮箱已注册",
    "Password should be at least 6 characters": "密码至少需要6位",
    "Invalid email": "邮箱格式不正确",
    "User not found": "该邮箱未注册",
  };
  return map[message] || message;
}
