import { useEffect, useState } from "react";

interface AuthUser {
  id: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("vocab_current_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem("vocab_users") || "{}");
    if (users[email]) {
      return { message: "该邮箱已注册" } as unknown as Error;
    }
    users[email] = { email, password };
    localStorage.setItem("vocab_users", JSON.stringify(users));
    const newUser: AuthUser = { id: email, email };
    localStorage.setItem("vocab_current_user", JSON.stringify(newUser));
    setUser(newUser);
    return null;
  };

  const signIn = async (email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem("vocab_users") || "{}");
    if (!users[email]) {
      return { message: "该邮箱未注册" } as unknown as Error;
    }
    if (users[email].password !== password) {
      return { message: "密码错误" } as unknown as Error;
    }
    const authUser: AuthUser = { id: email, email };
    localStorage.setItem("vocab_current_user", JSON.stringify(authUser));
    setUser(authUser);
    return null;
  };

  const signInAsGuest = async () => {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const guestUser: AuthUser = { id: guestId, email: "游客" };
    localStorage.setItem("vocab_current_user", JSON.stringify(guestUser));
    setUser(guestUser);
    return null;
  };

  const signOut = async () => {
    localStorage.removeItem("vocab_current_user");
    setUser(null);
  };

  return { user, loading, signUp, signIn, signInAsGuest, signOut };
}
