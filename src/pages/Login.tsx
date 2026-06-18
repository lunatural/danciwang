import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import gsap from "gsap";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signInAsGuest } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.from(cardRef.current, {
        opacity: 0,
        y: 40,
        scale: 0.95,
        duration: 0.6,
        ease: "power3.out",
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const err = await signIn(email, password);
      if (err) {
        setError(err.message || "登录失败");
      } else {
        navigate("/");
      }
    } catch {
      setError("登录失败，请检查网络连接");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 relative z-10">
      <div ref={cardRef} className="glass rounded-3xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-purple-600 text-center mb-2">
          单词大师
        </h1>
        <h2 className="text-sm text-gray-400 text-center mb-8">登录</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-white/50 backdrop-blur-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:bg-white/70 transition-all text-sm disabled:opacity-50"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-white/50 backdrop-blur-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:bg-white/70 transition-all text-sm disabled:opacity-50"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-500/80 backdrop-blur-sm hover:bg-purple-500/90 text-white rounded-xl font-medium transition-all text-sm disabled:opacity-60"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">或</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={async () => {
            setLoading(true);
            try {
              await signInAsGuest();
              navigate("/");
            } catch {
              setError("游客登录失败");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="w-full py-3 bg-white/40 backdrop-blur-sm hover:bg-white/60 text-gray-600 rounded-xl font-medium transition-all text-sm border border-white/40 disabled:opacity-50"
        >
          游客登录
        </button>

        <p className="text-sm text-gray-400 text-center mt-5">
          还没有账号？{" "}
          <Link to="/register" className="text-purple-500 hover:text-purple-600 transition-colors">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
