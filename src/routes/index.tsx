import { createFileRoute, redirect, Navigate } from "@tanstack/react-router";
import { useMBStore } from "@/lib/mb-store";
import { useAuthStore, hasPermission } from "@/lib/auth";

function homeRoute(session: ReturnType<typeof useAuthStore.getState>["session"]) {
  // Users with dashboard access land there; others go straight to POS.
  return hasPermission(session?.role, "reports.view") ? "/dashboard" : "/pos";
}

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const store = useMBStore.getState();
    if (!store.setupCompleted) throw redirect({ to: "/setup" });
    if (!store.license) throw redirect({ to: "/activate" });
    const session = useAuthStore.getState().session;
    if (!session) throw redirect({ to: "/login" });
    throw redirect({ to: homeRoute(session) });
  },
  component: IndexRedirect,
});

function IndexRedirect() {
  const setupCompleted = useMBStore((s) => s.setupCompleted);
  const license = useMBStore((s) => s.license);
  const session = useAuthStore((s) => s.session);

  if (!setupCompleted) return <Navigate to="/setup" />;
  if (!license) return <Navigate to="/activate" />;
  if (!session) return <Navigate to="/login" />;
  return <Navigate to={homeRoute(session)} />;
}
