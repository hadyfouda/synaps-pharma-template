// Server-only helper to verify a Supabase bearer token on raw TSS server routes.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function requireUser(request: Request): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  const supabase = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  return { ok: true, userId: data.user.id };
}
