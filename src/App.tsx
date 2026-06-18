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
import { pullAllFromCloud, flushSyncQueue, mergeCloudIntoLocal, pushWordsToCloud, pushLearningToCloud, pushScheduleToCloud } from "./hooks/useSync";
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

    // Online Supabase user: pull from cloud first, then push local if needed
    let cancelled = false;
    const initSync = async () => {
      try {
        // Step 1: Pull latest from cloud
        const cloud = await pullAllFromCloud(user.id);
        if (!cancelled && cloud) {
          // Merge cloud data with local (cloud wins on conflict, preserve local-only)
          mergeCloudIntoLocal(user.id, cloud);
        }

        // Step 2: If local has more data than cloud, push all local to cloud
        // This handles the case where cloud was empty (tables just created)
        if (!cancelled && cloud) {
          const fullPushKey = `vocab_full_push_${user.id}`;
          const hasFullPushed = localStorage.getItem(fullPushKey);

          if (!hasFullPushed) {
            // Read local data (already merged with cloud)
            const localWordsRaw = localStorage.getItem(`vocab_words_${user.id}`);
            const localLearningRaw = localStorage.getItem(`vocab_learning_${user.id}`);
            const localScheduleRaw = localStorage.getItem(`vocab_schedule_${user.id}`);

            const localWords = localWordsRaw ? JSON.parse(localWordsRaw) : [];
            const localLearning = localLearningRaw ? JSON.parse(localLearningRaw) : [];
            const localSchedule = localScheduleRaw ? JSON.parse(localScheduleRaw) : [];

            // Push if local has more data than cloud
            if (localWords.length > cloud.words.length) {
              await pushWordsToCloud(user.id, localWords).catch(() => {});
            }
            if (localLearning.length > cloud.learning.length) {
              await pushLearningToCloud(user.id, localLearning).catch(() => {});
            }
            if (localSchedule.length > cloud.schedule.length) {
              await pushScheduleToCloud(user.id, localSchedule).catch(() => {});
            }

            // Mark full push done to avoid repeating
            localStorage.setItem(fullPushKey, "true");
          }
        }
      } catch {
        // Sync failed, use local data
      }
      if (!cancelled) {
        setSyncVersion((v) => v + 1);
        setSyncReady(true);
      }
      // Flush queue in background (don't block UI)
      if (!cancelled) {
        flushSyncQueue(user.id).catch(() => {});
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
