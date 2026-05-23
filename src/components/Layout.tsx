import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleExport = () => {
    // Collect all localStorage data
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("vocab_")) {
        data[key] = localStorage.getItem(key) || "";
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `单词大师备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        let count = 0;
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith("vocab_")) {
            localStorage.setItem(key, value as string);
            count++;
          }
        }
        alert(`导入完成！共恢复 ${count} 条数据。\n\n请刷新页面以生效。`);
        window.location.reload();
      } catch {
        alert("文件格式错误，请选择正确的备份文件");
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-purple-500 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-wide">
            单词大师
          </Link>
          <div className="flex items-center gap-4 text-sm">
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
            <button
              onClick={handleExport}
              className="text-purple-200 hover:text-white transition-colors text-xs"
              title="导出数据备份"
            >
              导出
            </button>
            <button
              onClick={handleImport}
              className="text-purple-200 hover:text-white transition-colors text-xs"
              title="从备份恢复数据"
            >
              导入
            </button>
            <span className="text-purple-200 text-xs">{user?.email}</span>
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
