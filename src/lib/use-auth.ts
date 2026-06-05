import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "line_manager" | "rep" | "dm";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setRoles([]); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data, error }) => {
      if (error) {
        console.error("[use-auth] Failed to fetch user roles:", error.message);
        setRoles([]);
        return;
      }
      setRoles((data ?? []).map((r) => r.role as Role));
    });
  }, [user]);

  return {
    session, user, roles, loading,
    isAuthenticated: !!user,
    hasRole: (r: Role) => roles.includes(r),
    signOut: () => supabase.auth.signOut(),
  };
}
