"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { getHomePathForRole } from "@/lib/roles";
import {
  ArrowLeft,
  Check,
  Clock3,
  CookingPot,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

export default function SocialLoginCallbackPage() {
  const router = useRouter();
  const { completeLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const completeSocialLogin = async () => {
      const callbackParams = new URLSearchParams(window.location.search);
      const code = callbackParams.get("code");
      const nonce = callbackParams.get("nonce");
      const status = callbackParams.get("status");
      const tenantRegistration = callbackParams.get("tenantRegistration");
      window.history.replaceState({}, document.title, window.location.pathname);
      const expectedNonce = sessionStorage.getItem("social-login-nonce");
      sessionStorage.removeItem("social-login-nonce");
      if (
        !nonce ||
        (expectedNonce
          ? nonce !== expectedNonce
          : tenantRegistration !== "1")
      ) {
        setError(
          "No se pudo validar la solicitud de inicio de sesión. Inténtalo de nuevo.",
        );
        return;
      }
      if (status === "pending") {
        setIsPending(true);
        setError(
          "Tu solicitud de acceso fue enviada al Super Admin del negocio. Podrás iniciar sesión cuando sea aprobada.",
        );
        return;
      }
      if (status === "business_exists") {
        setError(
          "Ya existe un negocio con ese nombre. Vuelve al registro e ingresa otro nombre.",
        );
        return;
      }
      if (!code) {
        setError("El proveedor no devolvió un código de inicio de sesión.");
        return;
      }
      try {
        const response = await fetch(`${API_URL}/auth/oauth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const result: { access_token?: string; message?: string } =
          await response.json();
        if (!response.ok || !result.access_token) {
          throw new Error(
            result.message || "No se pudo validar la sesión social.",
          );
        }

        const user = await completeLogin(result.access_token);
        router.replace(getHomePathForRole(user.role));
      } catch (loginError) {
        setError(
          loginError instanceof Error
            ? loginError.message
            : "No se pudo completar el inicio de sesión.",
        );
      }
    };

    void completeSocialLogin();
  }, [completeLogin, router]);

  if (!error) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status">Completando inicio de sesión...</p>
      </main>
    );
  }

  if (isPending) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#101112] px-4 py-5 text-[#f4efe7] sm:px-6 sm:py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:44px_44px]"
        />
        <section className="relative w-full max-w-[760px] overflow-hidden rounded-xl border border-white/15 bg-[#191a1b] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d6a25f]/80 to-transparent" />
          <header className="flex justify-center border-b border-white/10 px-6 py-3.5 sm:py-5">
            <div className="flex items-center gap-2.5">
              <Image
                src="/assets/kutchen_app_logo.png"
                alt="Logo de KutchenAI"
                width={48}
                height={48}
                priority
                className="size-10 object-contain"
              />
              <span className="text-[15px] font-semibold tracking-[0.12em] text-white">
                KUTCHEN<span className="text-[#d6a25f]">AI</span>
              </span>
            </div>
          </header>

          <div className="px-5 pb-5 pt-6 sm:px-10 sm:pb-9 sm:pt-10">
            <div className="mx-auto max-w-[680px] text-center">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c5b9a6]">
                Bienvenido a KutchenAI
              </p>
              <h1 className="font-serif text-[clamp(1.7rem,5vw,2.65rem)] font-semibold leading-tight text-[#e2b474]">
                Tu solicitud está en proceso
              </h1>
            </div>

            <div className="mt-5 grid items-center gap-5 sm:mt-10 sm:grid-cols-[0.9fr_1.1fr] sm:gap-10">
              <div
                aria-hidden="true"
                className="relative mx-auto flex aspect-square w-full max-w-[170px] items-center justify-center rounded-full border border-[#d6a25f]/20 bg-[radial-gradient(circle,rgba(214,162,95,0.14),rgba(214,162,95,0.025)_52%,transparent_72%)] sm:max-w-[220px]"
              >
                <div className="absolute inset-[12%] rounded-full border border-dashed border-[#d6a25f]/20" />
                <div className="flex size-28 items-center justify-center rounded-full border border-[#d6a25f]/30 bg-[#202122] text-[#e2b474] shadow-[0_0_46px_rgba(214,162,95,0.12)]">
                  <CookingPot size={58} strokeWidth={1.25} />
                </div>
                <span className="absolute left-[13%] top-[25%] flex size-10 items-center justify-center rounded-full border border-white/10 bg-[#242526] text-[#d6a25f]">
                  <Clock3 size={19} strokeWidth={1.6} />
                </span>
                <span className="absolute bottom-[18%] right-[14%] flex size-9 items-center justify-center rounded-full border border-white/10 bg-[#242526] text-[#d6a25f]">
                  <Sparkles size={17} strokeWidth={1.6} />
                </span>
                <span className="absolute right-[10%] top-[22%] size-1.5 rounded-full bg-[#d6a25f] shadow-[0_0_12px_3px_rgba(214,162,95,0.45)]" />
                <span className="absolute bottom-[23%] left-[12%] size-1 rounded-full bg-[#d6a25f]/70" />
              </div>

              <div className="text-center sm:text-left">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d6a25f]/25 bg-[#d6a25f]/[0.07] px-3 py-1.5 text-xs font-medium text-[#e2b474]">
                  <Clock3 aria-hidden="true" size={14} />
                  En revisión
                </div>
                <p className="text-sm leading-6 text-[#d1ccc4] sm:text-[15px]">
                  El administrador del negocio recibió tu solicitud y revisará tus
                  credenciales. Cuando tu acceso sea aprobado, podrás iniciar sesión
                  y entrar a KutchenAI.
                </p>
                <p className="mt-3 text-xs leading-5 text-[#918d86]">
                  Por ahora, puedes cerrar esta ventana y volver más tarde.
                </p>
              </div>
            </div>

            <ol
              aria-label="Estado de la solicitud"
              className="mt-6 grid grid-cols-3 border-y border-white/10 py-4 sm:mt-10 sm:py-6"
            >
              <li className="flex flex-col items-center gap-2 text-center">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#d6a25f] text-[#191a1b]">
                  <Check aria-hidden="true" size={17} strokeWidth={2.5} />
                </span>
                <span className="text-[10px] font-medium leading-4 text-[#d9d3ca] sm:text-xs">
                  Registro recibido
                </span>
              </li>
              <li className="relative flex flex-col items-center gap-2 text-center before:absolute before:right-1/2 before:top-4 before:h-px before:w-1/2 before:bg-[#d6a25f]/50 after:absolute after:left-1/2 after:top-4 after:h-px after:w-1/2 after:bg-white/10">
                <span className="relative z-10 flex size-8 items-center justify-center rounded-full border border-[#d6a25f] bg-[#25211c] text-[#e2b474] shadow-[0_0_18px_rgba(214,162,95,0.18)]">
                  <Clock3 aria-hidden="true" size={16} />
                </span>
                <span className="text-[10px] font-medium leading-4 text-[#e2b474] sm:text-xs">
                  Revisión del administrador
                </span>
              </li>
              <li className="relative flex flex-col items-center gap-2 before:absolute before:right-1/2 before:top-4 before:h-px before:w-1/2 before:bg-white/10">
                <span className="relative z-10 flex size-8 items-center justify-center rounded-full border border-white/15 bg-[#222324] text-[#77756f]">
                  <LockKeyhole aria-hidden="true" size={15} />
                </span>
                <span className="text-[10px] font-medium leading-4 text-[#77756f] sm:text-xs">
                  Acceso permitido
                </span>
              </li>
            </ol>

            <div className="mt-5 flex justify-center sm:mt-7">
              <Button
                asChild
                variant="outline"
                className="h-11 min-w-52 border-[#d6a25f]/60 bg-transparent px-6 text-sm font-medium text-[#e2b474] hover:bg-[#d6a25f]/10 hover:text-[#f1c98f]"
              >
                <Link href="/auth/login">
                  <ArrowLeft aria-hidden="true" size={16} />
                  Cerrar y volver
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p role="alert" className="text-destructive">
        {error}
      </p>
      <Button asChild>
        <Link href={error.includes("Ya existe un negocio") ? "/auth/register" : "/auth/login"}>
          {error.includes("Ya existe un negocio") ? "Volver al registro" : "Volver al inicio de sesión"}
        </Link>
      </Button>
    </main>
  );
}
