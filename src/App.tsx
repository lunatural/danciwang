import { createContext, useContext, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Learn from "./pages/Learn";
import WordList from "./pages/WordList";
import Review from "./pages/Review";
import { pullAllFromCloud, flushSyncQueue } from "./hooks/useSync";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

// ── Sync Context ────────────────────────────────────────────────────

/** Incremented after each cloud sync – components watch this to re-load */
export const SyncContext = createContext<number>(0);

export function useSyncVersion(): number {
  return useContext(SyncContext);
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isOnline = useOnlineStatus();
  const [syncReady, setSyncReady] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);

  // Init sync: block rendering until first sync is complete
  useEffect(() => {
    if (!user) {
      setSyncReady(false);
      return;
    }

    // Guest users don't need cloud sync
    if (user.provider !== "supabase") {
      setSyncReady(true);
      return;
    }

    if (!isOnline) {
      // Offline: use local data as-is
      setSyncReady(true);
      return;
    }

    // Online Supabase user: pull from cloud first
    let cancelled = false;
    const initSync = async () => {
      try {
        // Push any queued changes from last session
        await flushSyncQueue(user.id);
        // Pull latest from cloud
        const cloud = await pullAllFromCloud(user.id);
        if (!cancelled && cloud) {
          // Always overwrite local with cloud data (cloud is source of truth)
          localStorage.setItem(`vocab_words_${user.id}`, JSON.stringify(cloud.words));
          localStorage.setItem(`vocab_learning_${user.id}`, JSON.stringify(cloud.learning));
          localStorage.setItem(`vocab_schedule_${user.id}`, JSON.stringify(cloud.schedule));
        }
      } catch {
        // Sync failed, use local data
      }
      if (!cancelled) {
        setSyncVersion((v) => v + 1);
        setSyncReady(true);
      }
    };

    initSync();
    return () => { cancelled = true; };
  }, [user?.id, user?.provider, isOnline]);

  // Flush queue when coming back online
  useEffect(() => {
    if (isOnline && user?.provider === "supabase") {
      flushSyncQueue(user.id).catch(() => {});
    }
  }, [isOnline, user?.id, user?.provider]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        加载中...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  // Block rendering until sync is complete (for Supabase users)
  if (!syncReady && user.provider === "supabase") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400">
        <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-500 rounded-full animate-spin" />
        <span className="text-sm">同步数据中...</span>
      </div>
    );
  }

  return (
    <SyncContext.Provider value={syncVersion}>
      {children}
    </SyncContext.Provider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/words" element={<WordList />} />
        <Route path="/review" element={<Review />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
