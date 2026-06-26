export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const { email } = await request.json() as { email?: string };
    if (!email) {
      return Response.json({ error: "邮箱不能为空" }, { status: 400 });
    }

    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return Response.json({ exists: false });
    }

    // 通过 Supabase Admin API 查询用户
    const resp = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email.toLowerCase())}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!resp.ok) {
      return Response.json({ exists: false });
    }

    const users = await resp.json() as any[];
    // 有些 Supabase 版本返回 { users: [...] }
    const list = Array.isArray(users) ? users : users.users || [];

    return Response.json({ exists: list.some((u: any) => u.email?.toLowerCase() === email.toLowerCase()) });
  } catch {
    return Response.json({ exists: false });
  }
}
