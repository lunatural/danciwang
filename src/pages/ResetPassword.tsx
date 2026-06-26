import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../supabase";

const TURNSTILE_SITE_KEY = "0x4AAAAAADrJ9BVPxHj4LpqQ";

declare global {
  interface Window {
    turnstile: any;
    _turnstileToken: string | null;
  }
}

export default function ResetPassword() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  // 兜底：直接用 getSession 检测是否有登录态（不依赖 useAuth 的 user 状态）
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
      }
      setChecking(false);
    });
  }, []);

  const resetToken = searchParams.get("token");

  // 冷却倒计时
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => { if (c <= 1) { clearInterval(cooldownRef.current); return 0; } return c - 1; });
      }, 1000);
    }
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [cooldown > 0]);

  // 兜底检测：如果 user 为空，主动查 session（防止 hash 处理时机早于组件挂载）
  useEffect(() => {
    if (!user) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          // user 会由 useAuth 的 onAuthStateChange 设置
          // 强制触发一次 getSession 让事件传播
          supabase.auth.setSession(data.session);
        }
      });
    }
  }, []);

  // 从邮件链接的 query 参数提取 token 并验证
  useEffect(() => {
    if (!resetToken) return;
    setVerifyingToken(true);
    supabase.auth.verifyOtp({ token_hash: resetToken, type: "recovery" })
      .then(({ error: err }) => {
        if (err) {
          setError("重置链接已过期或无效，请重新发送。");
        }
        setVerifyingToken(false);
      });
  }, [resetToken]);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileId = useRef<string | null>(null);

  // 初始化 Turnstile
  useEffect(() => {
    window._turnstileToken = null;
    let attempts = 0;
    const tryRender = () => {
      const el = turnstileRef.current;
      if (el && window.turnstile) {
        turnstileId.current = window.turnstile.render(el, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => { window._turnstileToken = token; },
          "expired-callback": () => { window._turnstileToken = null; },
          theme: "light",
        });
      } else if (attempts < 30) {
        attempts++;
        setTimeout(tryRender, 200);
      }
    };
    tryRender();
  }, []);


  // 发送重置邮件
  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const token = window._turnstileToken;
    if (!token) {
      setError("请完成人机验证");
      return;
    }
    // 服务端检查邮箱是否已注册
    try {
      const checkResp = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkData = await checkResp.json();
      if (!checkData.exists) {
        setError("该邮箱尚未注册，请确认邮箱地址是否正确。");
        return;
      }
    } catch {
      // 接口挂了走兜底：直接发送（Supabase 会自动忽略未注册邮箱）
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/?mode=reset",
        captchaToken: token,
      });
      if (err) {
        // 从错误消息提取限流秒数
        const match = err.message?.match(/(\d+)\s*seconds?/);
        setCooldown(match ? parseInt(match[1]) + 5 : 0);
        setError(err.message || "发送失败，请稍后重试");
      } else {
        setSent(true);
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 设置新密码
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
        setError(err.message || "重置失败，请重新发送重置邮件");
      } else {
        setSuccess("密码重置成功！");
        // 退出登录，让用户重新登录
        await supabase.auth.signOut();
        setTimeout(() => { window.location.href = "/login"; }, 2000);
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 还在检查 session → 加载状态
  if (checking || verifyingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-purple-700 mb-6">单词大师</h1>
          <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">验证中...</p>
        </div>
      </div>
    );
  }

  // 已登录（从重置邮件链接验证通过）→ 显示设置新密码
  if (user || hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-purple-700 text-center mb-6">单词大师</h1>
          <h2 className="text-lg text-gray-600 text-center mb-6">设置新密码</h2>
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <input
              type="password"
              placeholder="新密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoFocus
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
        </div>
      </div>
    );
  }

  // 已发送邮件
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-purple-700 text-center mb-6">单词大师</h1>
          <h2 className="text-lg text-gray-600 text-center mb-6">邮件已发送</h2>
          <p className="text-sm text-gray-500 text-center">密码重置链接已发送至 {email}，请检查邮箱。</p>
          <p className="text-center mt-4">
            <Link to="/login" className="text-purple-600 hover:underline text-sm">返回登录</Link>
          </p>
        </div>
      </div>
    );
  }

  // 默认：输入邮箱发送重置链接
  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-purple-700 text-center mb-6">单词大师</h1>
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
          <div ref={turnstileRef} className="flex justify-center" />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || cooldown > 0}
            className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-xl font-medium transition-colors"
          >
            {loading ? "发送中..." : cooldown > 0 ? `${cooldown}秒后可重发` : "发送重置链接"}
          </button>
        </form>
        <p className="text-sm text-gray-400 text-center mt-4">
          <Link to="/login" className="text-purple-500 hover:underline">返回登录</Link>
        </p>
      </div>
    </div>
  );
}
