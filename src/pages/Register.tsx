import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 6) {
      setError("密码至少6位");
      return;
    }
    const err = await signUp(email, password);
    if (err) {
      setError(err.message || "注册失败");
    } else {
      setSuccess("注册成功！正在跳转...");
      setTimeout(() => navigate("/"), 1000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-purple-700 text-center mb-6">
          单词大师
        </h1>
        <h2 className="text-lg text-gray-600 text-center mb-6">注册</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <input
            type="password"
            placeholder="密码（至少6位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          {success && <p className="text-green-500 text-sm text-center">{success}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors"
          >
            注册
          </button>
        </form>
        <p className="text-sm text-gray-500 text-center mt-4">
          已有账号？{" "}
          <Link to="/login" className="text-purple-600 hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
