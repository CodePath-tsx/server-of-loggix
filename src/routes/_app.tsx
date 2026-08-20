import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuthStore } from "@/lib/auth";
import { useMBStore } from "@/lib/mb-store";
import { verifyLicense } from "@/core/license";
import { getMachineId } from "@/lib/seed";
import { setLanguage, type LangCode } from "@/i18n";
import { installStoreSyncBridge } from "@/lib/sync/store-bridge";

async function checkLicense(): Promise<boolean> {
  const lic = useMBStore.getState().license;
  if (!lic || !lic.key) return false;
  if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) return false;
  try {
    await verifyLicense(lic.key, getMachineId());
    return true;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const store = useMBStore.getState();
    if (!store.setupCompleted) throw redirect({ to: "/setup" });
    if (!store.users.some((u) => u.role === "administrator" && u.active)) {
      throw redirect({ to: "/setup" });
    }
    const licenseValid = await checkLicense();
    if (!licenseValid) throw redirect({ to: "/activate" });

    const session = useAuthStore.getState().session;
    if (!session) throw redirect({ to: "/login" });

    // Session must still correspond to an active user
    const user = store.users.find((u) => u.id === session.userId);
    if (!user || !user.active) {
      useAuthStore.getState().setSession(null);
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  // Keep i18n, localStorage and mb-store in sync.
  // When settings.language changes (from settings page or header toggle),
  // setLanguage() applies it to the i18n instance and the <html> tag.
  const lang = useMBStore((s) => s.settings.language as LangCode | undefined);
  useEffect(() => {
    if (lang) setLanguage(lang);
  }, [lang]);

  useEffect(() => installStoreSyncBridge(), []);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
