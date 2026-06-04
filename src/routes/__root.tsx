import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/use-auth";
import { Loader2 } from "lucide-react";
import { hydrateKPIFromSupabase } from "@/lib/kpi-data";
import { RepFilterProvider, useRepFilter } from "@/lib/rep-filter";
import { findRepByLooseName } from "@/lib/mock-data";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn’t load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SYNAPS - Pharma Sales Intelligence" },
      { name: "description", content: "Pharma sales intelligence dashboard" },
      { property: "og:title", content: "SYNAPS - Pharma Sales Intelligence" },
      { property: "og:description", content: "Pharma sales intelligence dashboard" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SYNAPS - Pharma Sales Intelligence" },
      { name: "twitter:description", content: "Pharma sales intelligence dashboard" },
      { name: "theme-color", content: "#ffffff" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "SYNAPS" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (isAuthenticated) {
      void hydrateKPIFromSupabase();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!loading && !isAuthenticated && !isLoginPage) {
      router.navigate({ to: "/login" });
    }
    if (!loading && isAuthenticated && isLoginPage) {
      router.navigate({ to: "/" });
    }
  }, [loading, isAuthenticated, isLoginPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isLoginPage) return <Outlet />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground relative">
        <RepFilterProvider>
          <AppSidebar />
          <main className="flex-1 flex flex-col min-w-0 relative z-10 pt-12 md:pt-0">
            <RepHomeRedirect />
            <Outlet />
          </main>
        </RepFilterProvider>
    </div>
  );
}

function RepHomeRedirect() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { scope, myRep, loading } = useRepFilter();
  useEffect(() => {
    if (loading || scope !== "rep" || !myRep) return;
    const mockId = findRepByLooseName(myRep.name)?.id;
    if (!mockId) return;
    // Block rep-only users from non-allowed pages; send them to their page.
    const allowed =
      pathname.startsWith(`/reps/${mockId}`) ||
      pathname === "/performance-analysis" ||
      pathname === "/rx-analysis";
    if (!allowed) {
      router.navigate({ to: "/reps/$id", params: { id: mockId } });
    }
  }, [loading, scope, myRep, pathname, router]);
  return null;
}
