import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// 邮箱格式校验
function isValidEmail(email: string): string | null {
  if (!email) return "请输入邮箱";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "邮箱格式不正确";
  const blockedDomains = [
    "mailinator.com", "guerrillamail.com", "10minutemail.com",
    "tempmail.com", "throwaway.email", "yopmail.com",
    "sharklasers.com", "trashmail.com", "temp-mail.org",
    "fakeinbox.com", "tempinbox.com", "moakt.com",
  ];
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && blockedDomains.some((d) => domain.endsWith(d))) {
    return "不支持临时邮箱，请使用个人邮箱";
  }
  return null;
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const emailError = isValidEmail(email);
    if (emailError) { setError(emailError); return; }
    if (password.length < 6) { setError("密码至少6位"); return; }

    setLoading(true);
    try {
      const err = await signUp(email, password);
      if (err) {
        if (err.message && (
          err.message.includes("验证邮件") ||
          err.message.includes("检查邮箱") ||
          err.message.includes("验证") ||
          err.message.includes("确认")
        )) {
          setSuccess(err.message);
          setTimeout(() => navigate("/login"), 4000);
        } else {
          setError(err.message || "注册失败");
        }
      } else {
        setSuccess("验证邮件已发送，请检查邮箱后登录");
        setTimeout(() => navigate("/login"), 3000);
      }
    } catch {
      setError("注册失败，请检查网络连接");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-purple-700 text-center mb-6">单词大师</h1>
        <h2 className="text-lg text-gray-600 text-center mb-6">注册</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
          />
          <input
            type="password"
            placeholder="密码（至少6位）"
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
            {loading ? "注册中..." : "注册"}
          </button>
        </form>
        <p className="text-sm text-gray-500 text-center mt-4">
          已有账号？{" "}
          <Link to="/login" className="text-purple-600 hover:underline">登录</Link>
        </p>
      </div>
    </div>
  );
}
