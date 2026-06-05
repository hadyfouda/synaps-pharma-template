import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { synapsConfig } from "@/synaps.config";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: `Sign in — SYNAPS` }] }),
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
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <form onSubmit={submit} className="w-full max-w-sm bg-card ring-1 ring-border rounded-xl p-7 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="size-14 mb-3 text-5xl flex items-center justify-center">
            {synapsConfig.company.logo}
          </div>
          <h1 className="text-xl font-bold">{synapsConfig.company.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">{synapsConfig.company.productLine}</p>
        </div>
        <label className="block text-xs font-medium mb-1">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full text-sm bg-background ring-1 ring-border rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-primary" />
        <label className="block text-xs font-medium mb-1">Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full text-sm bg-background ring-1 ring-border rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-primary" />
        {error && <p className="text-xs text-destructive mb-3 bg-destructive/10 ring-1 ring-destructive/30 rounded-md p-2">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full text-sm font-medium bg-primary text-primary-foreground rounded-md py-2.5 flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
