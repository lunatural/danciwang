import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-purple-500 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-wide">
            单词大师
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/" className="hover:text-purple-200 transition-colors">
              首页
            </Link>
            <Link to="/search" className="hover:text-purple-200 transition-colors">
              查单词
            </Link>
            <Link to="/learn" className="hover:text-purple-200 transition-colors">
              学习
            </Link>
            <Link to="/words" className="hover:text-purple-200 transition-colors">
              单词本
            </Link>
            <Link to="/review" className="hover:text-purple-200 transition-colors">
              复习
            </Link>
            <span className="text-purple-200 text-xs mr-2">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-lg transition-colors text-xs"
            >
              退出
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
