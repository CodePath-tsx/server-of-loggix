import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Save, Download, Upload, Building2, Palette, Printer } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useMBStore } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";
import {
  exportBackupFile,
  parseBackup,
  restoreBackup,
  pickBackupFileElectron,
} from "@/lib/backup";
import { isElectron } from "@/lib/ipc-bridge";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { t } = useTranslation();
  const settings = useMBStore((s) => s.settings);
  const setSettings = useMBStore((s) => s.setSettings);
  const store = useMBStore.getState;
  const [f, setF] = useState(settings);

  const [busy, setBusy] = useState(false);

  const runExport = async () => {
    setBusy(true);
    try {
      const res = await exportBackupFile();
      if (res.canceled) toast.info("Sauvegarde annulée");
      else if (res.ok) toast.success("Sauvegarde exportée avec succès");
      else toast.error("Échec de l'export de la sauvegarde");
    } catch (err) {
      console.error("[backup] export", err);
      toast.error(err instanceof Error ? err.message : "Échec de l'export");
    } finally {
      setBusy(false);
    }
  };

  const applyRestore = async (text: string) => {
    const data = parseBackup(text);
    await restoreBackup(data);
    toast.success("Restauration terminée — rechargement…");
    setTimeout(() => window.location.reload(), 800);
  };

  const runImportFromFile = async (file: File) => {
    setBusy(true);
    try {
      await applyRestore(await file.text());
    } catch (err) {
      console.error("[backup] import", err);
      toast.error(err instanceof Error ? err.message : "Fichier de sauvegarde invalide");
    } finally {
      setBusy(false);
    }
  };

  const runImportElectron = async () => {
    setBusy(true);
    try {
      const json = await pickBackupFileElectron();
      if (!json) {
        toast.info("Restauration annulée");
        return;
      }
      await applyRestore(json);
    } catch (err) {
      console.error("[backup] import", err);
      toast.error(err instanceof Error ? err.message : "Fichier de sauvegarde invalide");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    setSettings(f);
    toast.success(t("settings.saved"));
  };

  return (
    <PageBody>
      <PageHeader title={t("settings.title")} description={t("settings.desc")} />
      <div className="grid gap-6 lg:grid-cols-2">

        <Section title={t("settings.company")} icon={Building2}>
          <Row label={t("settings.companyName")}>
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className={inp}
            />
          </Row>
          <Row label={t("settings.currency")}>
            <select
              value={f.currency}
              onChange={(e) => setF({ ...f, currency: e.target.value })}
              className={inp}
            >
              {["DZD","USD","EUR","SAR","AED","MAD","TND","EGP"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Row>
          <Row label={t("settings.taxPct")}>
            <input
              type="number"
              value={f.taxPct}
              onChange={(e) => setF({ ...f, taxPct: +e.target.value })}
              className={inp}
              min={0}
              max={100}
              step={0.5}
            />
          </Row>
        </Section>

        <Section title={t("settings.appearance")} icon={Palette}>
          <Row label={t("settings.theme")}>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => setF({ ...f, theme: th })}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${
                    f.theme === th ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                  }`}
                >
                  {t(`theme.${th}`)}
                </button>
              ))}
            </div>
          </Row>
          <Row label={t("settings.printerSize")}>
            <div className="flex gap-2">
              {(["58mm", "80mm", "A4"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setF({ ...f, printerSize: s })}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${
                    f.printerSize === s ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <Printer className="mx-auto mb-1 h-4 w-4" />
                  {s}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title={t("settings.backup")} icon={Download}>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={runExport}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-success py-3 text-sm font-bold text-success-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Exporter la sauvegarde
            </button>
            {isElectron ? (
              <button
                onClick={runImportElectron}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold hover:bg-accent disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Restaurer
              </button>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold hover:bg-accent">
                <Upload className="h-4 w-4" />
                Restaurer
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void runImportFromFile(file);
                  }}
                />
              </label>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">La sauvegarde enregistre l'intégralité de la base de données (JSON) : produits,
            ventes, clients, stock, dépenses, utilisateurs et paramètres. La restauration
            remplace toutes les données existantes.</p>
        </Section>

      </div>

      <button
        onClick={save}
        className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-primary"
      >
        <Save className="h-4 w-4" />
        {t("actions.save")}
      </button>
    </PageBody>
  );
}

const inp =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-bold">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
