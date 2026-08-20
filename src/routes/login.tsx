import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Store, Eye, EyeOff, Loader2 } from "lucide-react";
import { login, useAuthStore } from "@/lib/auth";
import { useMBStore } from "@/lib/mb-store";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const store = useMBStore.getState();
    if (!store.setupCompleted) throw redirect({ to: "/setup" });
    if (!store.license) throw redirect({ to: "/activate" });
    if (useAuthStore.getState().session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

const schema = z.object({
  username: z.string().min(1, "Entrez le nom d'utilisateur"),
  password: z.string().min(1, "Entrez le mot de passe"),
  remember: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", remember: true },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await login(data.username, data.password, !!data.remember);
      toast.success("Bon retour");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background" dir="ltr">
      {/* Left: brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 backdrop-blur">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight">LogixStore</p>
            <p className="text-xs uppercase tracking-widest opacity-70">ERP · POS · Offline</p>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight">
            Un système intégré<br />pour gérer votre entreprise intelligemment
          </h2>
          <p className="mt-4 text-sm opacity-80 max-w-md">
            Points de vente, stock, rapports, clients et fournisseurs — tout fonctionne à 100% hors ligne,
            avec une interface rapide et sécurisée.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-xs">
            {["Offline", "Multi-User", "Reports"].map((t) => (
              <div key={t} className="rounded-xl bg-white/10 px-3 py-2 text-center backdrop-blur">{t}</div>
            ))}
          </div>
        </div>
        <p className="relative text-xs opacity-60">© {new Date().getFullYear()} LogixStore. All rights reserved.</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <p className="text-xl font-extrabold text-primary">LogixStore</p>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Connexion</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entrez vos identifiants pour accéder au tableau de bord</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-medium">Nom d'utilisateur</label>
              <input
                {...register("username")}
                className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                autoComplete="username"
              />
              {errors.username && <p className="mt-1 text-xs text-destructive">{errors.username.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Mot de passe</label>
              <div className="relative mt-1.5">
                <input
                  {...register("password")}
                  type={showPw ? "text" : "password"}
                  className="w-full rounded-xl border border-input bg-card px-4 py-2.5 pl-11 text-sm outline-none focus:ring-2 focus:ring-ring"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 left-3 grid place-items-center text-muted-foreground"
                  aria-label="Afficher le mot de passe"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("remember")} className="h-4 w-4 rounded border-input" />
              <span>Se souvenir de moi</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-hover disabled:opacity-60"
            >
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Se connecter"}
            </button>

            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>Utilisez les comptes créés lors de l'étape de configuration initiale.</p>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Problème d'activation ?{" "}
              <Link to="/activate" className="text-primary font-medium hover:underline">Gestion de la licence</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
