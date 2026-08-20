import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Store, User, Building2, Globe, ChevronLeft, ChevronRight, Check, Loader2, Upload } from "lucide-react";
import { useMBStore } from "@/lib/mb-store";
import { hashPassword } from "@/lib/auth";
import { seedDemoData } from "@/lib/seed";
import { setLanguage } from "@/i18n";

export const Route = createFileRoute("/setup")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (useMBStore.getState().setupCompleted) {
      throw redirect({ to: "/login" });
    }
  },
  component: SetupWizard,
});

const CURRENCIES = ["DZD", "USD", "EUR", "MAD", "TND", "EGP", "SAR", "AED"];
const TZS = [
  "Africa/Algiers", "Africa/Casablanca", "Africa/Cairo", "Africa/Tunis",
  "Asia/Riyadh", "Asia/Dubai", "Europe/Paris", "Europe/London", "UTC",
];

interface WizardData {
  companyName: string;
  logo: string;
  address: string;
  phone: string;
  taxId: string;
  currency: string;
  language: "fr";
  timezone: string;
  adminUsername: string;
  adminDisplayName: string;
  adminEmail: string;
  adminPassword: string;
  adminConfirm: string;
  addCashier: boolean;
  cashierUsername: string;
  cashierDisplayName: string;
  cashierPassword: string;
  includeDemo: boolean;
}

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<WizardData>({
    companyName: "",
    logo: "",
    address: "",
    phone: "",
    taxId: "",
    currency: "DZD",
    language: "fr",
    timezone: "Africa/Algiers",
    adminUsername: "admin",
    adminDisplayName: "",
    adminEmail: "",
    adminPassword: "",
    adminConfirm: "",
    addCashier: true,
    cashierUsername: "cashier",
    cashierDisplayName: "",
    cashierPassword: "",
    includeDemo: true,
  });

  const set = <K extends keyof WizardData>(k: K, v: WizardData[K]) => setD((p) => ({ ...p, [k]: v }));

  const onLogo = (file: File) => {
    if (file.size > 800_000) return toast.error("Taille du logo trop grande (max 800KB)");
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result));
    reader.readAsDataURL(file);
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!d.companyName.trim()) return toast.error("Entrez le nom de l'entreprise"), false;
    }
    if (step === 1) {
      if (!d.adminDisplayName.trim()) return toast.error("Entrez le nom de l'administrateur"), false;
      if (!d.adminUsername.trim()) return toast.error("Entrez le nom d'utilisateur de l'administrateur"), false;
      if (d.adminPassword.length < 6) return toast.error("Le mot de passe administrateur doit contenir au moins 6 caractères"), false;
      if (d.adminPassword !== d.adminConfirm) return toast.error("Confirmation du mot de passe incorrecte"), false;
      if (d.addCashier) {
        if (!d.cashierDisplayName.trim()) return toast.error("Entrez le nom du caissier"), false;
        if (!d.cashierUsername.trim()) return toast.error("Entrez le nom d'utilisateur du caissier"), false;
        if (d.cashierPassword.length < 4) return toast.error("Le mot de passe caissier doit contenir au moins 4 caractères"), false;
        if (d.cashierUsername.toLowerCase() === d.adminUsername.toLowerCase()) return toast.error("Nom d'utilisateur déjà utilisé"), false;
      }
    }
    return true;
  };

  const finish = async () => {
    if (!validateStep()) return;
    setSaving(true);
    try {
      const s = useMBStore.getState();
      const now = new Date().toISOString();

      s.setSettings({
        name: d.companyName.trim(),
        logo: d.logo || undefined,
        address: d.address.trim() || undefined,
        phone: d.phone.trim() || undefined,
        taxId: d.taxId.trim() || undefined,
        currency: d.currency,
        language: d.language,
        timezone: d.timezone,
      });

      const adminHash = await hashPassword(d.adminPassword);
      s.upsertUser({
        id: "u_admin_" + crypto.randomUUID().slice(0, 8),
        username: d.adminUsername.trim(),
        displayName: d.adminDisplayName.trim(),
        email: d.adminEmail.trim(),
        passwordHash: adminHash,
        role: "administrator",
        active: true,
        createdAt: now,
      });

      if (d.addCashier) {
        const cashierHash = await hashPassword(d.cashierPassword);
        s.upsertUser({
          id: "u_cashier_" + crypto.randomUUID().slice(0, 8),
          username: d.cashierUsername.trim(),
          displayName: d.cashierDisplayName.trim(),
          email: "",
          passwordHash: cashierHash,
          role: "cashier",
          active: true,
          createdAt: now,
        });
      }

      if (d.includeDemo) seedDemoData();

      s.markSetupCompleted();

      setLanguage();

      toast.success("Application configurée avec succès ✓");
      navigate({ to: "/activate" });
    } catch (e) {
      toast.error("Échec de la configuration : " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < 2) setStep(step + 1);
    else void finish();
  };

  const steps = [
    { icon: Building2, title: "Entreprise", desc: "Informations de la société" },
    { icon: User, title: "Utilisateurs", desc: "Admin + Caissier" },
    { icon: Globe, title: "Région", desc: "Langue, devise et fuseau horaire" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4 sm:p-8" dir="ltr">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-primary">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight">LogixStore ERP</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">First-Time Setup</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-6 grid grid-cols-3 gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.title} className={`rounded-2xl border p-3 ${active ? "border-primary bg-primary/5" : done ? "border-success/40 bg-success/5" : "bg-card"}`}>
                <div className="flex items-center gap-2">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-elevated">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold">Bienvenue sur LogixStore</h2>
              <p className="text-sm text-muted-foreground">Commençons par configurer les informations de votre entreprise.</p>
              <Field label="Nom de l'entreprise *"><input value={d.companyName} onChange={(e) => set("companyName", e.target.value)} className={inputCls} placeholder="Ex: Boutique Lumière" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Téléphone"><input value={d.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} placeholder="+213 ..." /></Field>
                <Field label="Identifiant fiscal"><input value={d.taxId} onChange={(e) => set("taxId", e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Adresse"><input value={d.address} onChange={(e) => set("address", e.target.value)} className={inputCls} /></Field>
              <Field label="Logo de l'entreprise">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-dashed border-input px-4 py-2.5 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" /> Choisir un fichier
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
                  </label>
                  {d.logo && <img src={d.logo} alt="logo" className="h-12 w-12 rounded-lg border object-contain" />}
                </div>
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold">Création des comptes</h2>
              <p className="text-sm text-muted-foreground">Le compte administrateur est requis. Vous pourrez ajouter un caissier plus tard.</p>
              <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-bold">👤 Compte Administrateur (Administrator)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nom complet *"><input value={d.adminDisplayName} onChange={(e) => set("adminDisplayName", e.target.value)} className={inputCls} /></Field>
                  <Field label="Nom d'utilisateur *"><input value={d.adminUsername} onChange={(e) => set("adminUsername", e.target.value)} className={inputCls} /></Field>
                  <Field label="E-mail"><input type="email" value={d.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} className={inputCls} /></Field>
                  <div />
                  <Field label="Mot de passe (6+) *"><input type="password" value={d.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} className={inputCls} /></Field>
                  <Field label="Confirmer le mot de passe *"><input type="password" value={d.adminConfirm} onChange={(e) => set("adminConfirm", e.target.value)} className={inputCls} /></Field>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={d.addCashier} onChange={(e) => set("addCashier", e.target.checked)} className="h-4 w-4" />
                <span>Ajouter un compte caissier maintenant</span>
              </label>
              {d.addCashier && (
                <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-bold">🧾 Compte Caissier (Cashier)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nom complet *"><input value={d.cashierDisplayName} onChange={(e) => set("cashierDisplayName", e.target.value)} className={inputCls} /></Field>
                    <Field label="Nom d'utilisateur *"><input value={d.cashierUsername} onChange={(e) => set("cashierUsername", e.target.value)} className={inputCls} /></Field>
                    <Field label="Mot de passe (4+) *"><input type="password" value={d.cashierPassword} onChange={(e) => set("cashierPassword", e.target.value)} className={inputCls} /></Field>
                  </div>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold">Région et devise</h2>
              <p className="text-sm text-muted-foreground">Ces paramètres peuvent être modifiés ultérieurement dans les réglages.</p>
              <Field label="Langue de l'interface">
                <div className="rounded-xl border bg-muted/30 px-3 py-2.5 text-sm font-semibold">Français</div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Devise">
                  <select value={d.currency} onChange={(e) => set("currency", e.target.value)} className={inputCls}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Fuseau horaire">
                  <select value={d.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls}>
                    {TZS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={d.includeDemo} onChange={(e) => set("includeDemo", e.target.checked)} className="h-4 w-4" />
                <span>Ajouter des données de démonstration (produit + catégorie + client) pour tester</span>
              </label>
              <div className="rounded-xl border border-info/40 bg-info/5 p-3 text-xs text-info-foreground">
                Après cette étape, il vous sera demandé d'activer une licence Ed25519 valide pour continuer.
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0 || saving}
              className="flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" /> Précédent
            </button>
            <div className="text-xs text-muted-foreground">Étape {step + 1} sur {steps.length}</div>
            <button
              onClick={next}
              disabled={saving}
              className="flex items-center gap-1 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-primary hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 2 ? <>Terminer la configuration <Check className="h-4 w-4" /></> : <>Suivant <ChevronLeft className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
