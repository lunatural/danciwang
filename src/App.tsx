import { useEffect } from "react";
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

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isOnline = useOnlineStatus();

  // Init sync: pull from cloud on load, push pending changes
  useEffect(() => {
    if (!user || user.provider !== "supabase") return;

    const initSync = async () => {
      if (isOnline) {
        // First push any queued changes from last session
        await flushSyncQueue(user.id).catch(() => {});

        // Then pull latest data from cloud
        const cloud = await pullAllFromCloud(user.id);
        if (cloud) {
          // Merge cloud data into localStorage (cloud wins on conflict)
          if (cloud.words.length > 0) {
            localStorage.setItem(
              `vocab_words_${user.id}`,
              JSON.stringify(cloud.words)
            );
          }
          if (cloud.learning.length > 0) {
            localStorage.setItem(
              `vocab_learning_${user.id}`,
              JSON.stringify(cloud.learning)
            );
          }
          if (cloud.schedule.length > 0) {
            localStorage.setItem(
              `vocab_schedule_${user.id}`,
              JSON.stringify(cloud.schedule)
            );
          }
        }
      }
    };

    initSync();
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
  return <>{children}</>;
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
