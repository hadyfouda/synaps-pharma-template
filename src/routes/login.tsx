import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — SYNAPS" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Invalid email or password" : error.message);
    else navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative">
      <form onSubmit={submit} className="relative z-10 w-full max-w-sm bg-white/5 backdrop-blur-sm ring-1 ring-white/20 rounded-xl p-7 shadow-2xl text-white bg-slate-900">
        <div className="flex flex-col items-center mb-6">
          <div className="size-14 mb-3 rounded-full bg-brand/20 grid place-items-center text-3xl">💊</div>
          <h1 className="text-xl font-bold">Sign in to SYNAPS</h1>
          <p className="text-xs text-white/60 mt-1 uppercase tracking-wider font-medium text-[10px]">Pharma Sales Intelligence</p>
        </div>
        <label className="block text-xs font-medium mb-1">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full text-sm bg-white/10 text-white placeholder-white/40 ring-1 ring-white/20 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-white/50" />
        <label className="block text-xs font-medium mb-1">Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full text-sm bg-white/10 text-white placeholder-white/40 ring-1 ring-white/20 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-white/50" />
        {error && <p className="text-xs text-red-200 mb-3 bg-red-500/20 ring-1 ring-red-300/30 rounded-md p-2">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full text-sm font-medium bg-slate-950/60 text-white ring-1 ring-white/20 backdrop-blur-md rounded-md py-2.5 flex items-center justify-center gap-2 hover:bg-slate-950/80 disabled:opacity-60">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
