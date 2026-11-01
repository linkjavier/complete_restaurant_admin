"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";

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
      window.history.replaceState({}, document.title, window.location.pathname);
      const expectedNonce = sessionStorage.getItem("social-login-nonce");
      sessionStorage.removeItem("social-login-nonce");
      if (!nonce || nonce !== expectedNonce) {
        setError(
          "No se pudo validar la solicitud de inicio de sesión. Inténtalo de nuevo.",
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

        await completeLogin(result.access_token);
        router.replace("/admin/dashboard");
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
        <Link href="/auth/login">Volver al inicio de sesión</Link>
      </Button>
    </main>
  );
}
