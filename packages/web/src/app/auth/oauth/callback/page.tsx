"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { getHomePathForRole } from "@/lib/roles";

export default function SocialLoginCallbackPage() {
  const router = useRouter();
  const { completeLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);
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
