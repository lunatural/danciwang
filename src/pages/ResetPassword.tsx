import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function ResetPassword() {
  const [step, setStep] = useState<"email" | "sent" | "newPassword">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // 步骤1: 发送重置邮件
  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (err) {
        setError("发送失败：" + (err.message || "请稍后重试"));
      } else {
        setSuccess("密码重置链接已发送至 " + email + "，请检查邮箱");
        setStep("sent");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 步骤2: 设置新密码（从邮件链接跳转回来时）
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("密码至少6位");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError("重置失败：" + (err.message || "请重新发送重置邮件"));
      } else {
        setSuccess("密码重置成功！");
        setTimeout(() => window.location.href = "/login", 2000);
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 检测是否从邮件链接跳转回来
  useState(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setStep("newPassword");
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-purple-700 text-center mb-6">单词大师</h1>

        {step === "newPassword" ? (
          <>
            <h2 className="text-lg text-gray-600 text-center mb-6">设置新密码</h2>
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <input
                type="password"
                placeholder="新密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              {success && <p className="text-green-500 text-sm text-center">{success}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-xl font-medium transition-colors"
              >
                {loading ? "保存中..." : "保存新密码"}
              </button>
            </form>
          </>
        ) : step === "sent" ? (
          <>
            <h2 className="text-lg text-gray-600 text-center mb-6">邮件已发送</h2>
            <p className="text-sm text-gray-500 text-center">{success}</p>
            <p className="text-center mt-4">
              <Link to="/login" className="text-purple-600 hover:underline text-sm">
                返回登录
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg text-gray-600 text-center mb-6">找回密码</h2>
            <form onSubmit={handleSendReset} className="space-y-4">
              <input
                type="email"
                placeholder="输入注册邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-xl font-medium transition-colors"
              >
                {loading ? "发送中..." : "发送重置链接"}
              </button>
            </form>
          </>
        )}

        <p className="text-sm text-gray-400 text-center mt-4">
          <Link to="/login" className="text-purple-500 hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
