"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { API_URL, getTenantIdFromSubdomain } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CloudIntegration {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  isActive: boolean;
  updatedAt: string;
}

interface CloudConversation {
  id: string;
  contactId: string;
  phoneNumber: string | null;
  profileName: string | null;
  aiEnabled: boolean;
  lastMessageText: string | null;
  lastMessageAt: string | null;
}

interface CloudMessage {
  id: string;
  providerMessageId: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  body: string | null;
  status: string;
  timestamp: string;
  isVoiceNote: boolean;
}

interface IntegrationResponse {
  configured: boolean;
  integration: CloudIntegration | null;
}

function authHeaders() {
  const token = getAuthToken();
  const tenantId = getTenantIdFromSubdomain();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return data as T;
}

export default function AIManagerV2Page() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [integration, setIntegration] = useState<CloudIntegration | null>(null);
  const [conversations, setConversations] = useState<CloudConversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<CloudConversation | null>(null);
  const [messages, setMessages] = useState<CloudMessage[]>([]);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const locationId = user?.locationId;
  const isAdministrator =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const loadData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const locationQuery = `locationId=${encodeURIComponent(locationId)}`;
      const [integrationResult, conversationResult] = await Promise.all([
        request<IntegrationResponse>(
          `/whatsapp-cloud/integration?${locationQuery}`,
        ),
        request<CloudConversation[]>(
          `/whatsapp-cloud/conversations?${locationQuery}`,
        ),
      ]);
      setIntegration(integrationResult.integration);
      setPhoneNumberId(integrationResult.integration?.phoneNumberId ?? "");
      setWabaId(integrationResult.integration?.wabaId ?? "");
      setConversations(conversationResult);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar WhatsApp Cloud API.",
      );
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!locationId) return;
      try {
        const result = await request<CloudMessage[]>(
          `/whatsapp-cloud/conversations/${encodeURIComponent(conversationId)}/messages?locationId=${encodeURIComponent(locationId)}`,
        );
        setMessages(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los mensajes.",
        );
      }
    },
    [locationId],
  );

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (!user.locationId) {
      setError("Tu usuario no tiene una sede asignada.");
      setLoading(false);
      return;
    }
    void loadData();
  }, [isAuthLoading, loadData, router, user]);

  useEffect(() => {
    if (selectedConversation) {
      void loadMessages(selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [loadMessages, selectedConversation]);

  async function saveIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await request<IntegrationResponse>(
        "/whatsapp-cloud/integration",
        {
          method: "PUT",
          body: JSON.stringify({
            locationId,
            phoneNumberId: phoneNumberId.trim(),
            wabaId: wabaId.trim(),
            accessToken: accessToken.trim(),
          }),
        },
      );
      setIntegration(result.integration);
      setAccessToken("");
      setNotice("La conexión oficial con Meta fue validada y guardada.");
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la conexión.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversation || !locationId || !draft.trim()) return;
    setSending(true);
    setError("");
    try {
      await request(
        `/whatsapp-cloud/conversations/${encodeURIComponent(selectedConversation.id)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ locationId, message: draft.trim() }),
        },
      );
      setDraft("");
      await Promise.all([loadMessages(selectedConversation.id), loadData()]);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar el mensaje.",
      );
    } finally {
      setSending(false);
    }
  }

  async function toggleAi() {
    if (!selectedConversation || !locationId) return;
    const nextEnabled = !selectedConversation.aiEnabled;
    try {
      await request(
        `/whatsapp-cloud/conversations/${encodeURIComponent(selectedConversation.id)}/ai`,
        {
          method: "PATCH",
          body: JSON.stringify({ locationId, aiEnabled: nextEnabled }),
        },
      );
      const updated = { ...selectedConversation, aiEnabled: nextEnabled };
      setSelectedConversation(updated);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === updated.id ? updated : conversation,
        ),
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo cambiar el estado del agente.",
      );
    }
  }

  if (isAuthLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Cargando" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-7 w-7 text-emerald-600" />
            <h1 className="text-2xl font-bold">Inteligencia Artificial V2.0</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Agente de ventas conectado con WhatsApp Business Platform de Meta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={integration?.isActive ? "default" : "secondary"}>
            {integration?.isActive ? "Meta conectado" : "Sin conexión"}
          </Badge>
          <Button variant="outline" size="icon" onClick={() => void loadData()}>
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Actualizar</span>
          </Button>
        </div>
      </header>

      {error && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {!integration ? (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Conectar WhatsApp Cloud API
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Registra el número habilitado en Meta. La API valida las
              credenciales y cifra el token antes de guardarlo.
            </p>
          </CardHeader>
          <CardContent>
            {isAdministrator ? (
              <form className="space-y-4" onSubmit={saveIntegration}>
                <div className="space-y-2">
                  <label
                    htmlFor="phoneNumberId"
                    className="text-sm font-medium leading-none"
                  >
                    Phone Number ID
                  </label>
                  <Input
                    id="phoneNumberId"
                    autoComplete="off"
                    value={phoneNumberId}
                    onChange={(event) => setPhoneNumberId(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="wabaId"
                    className="text-sm font-medium leading-none"
                  >
                    WhatsApp Business Account ID
                  </label>
                  <Input
                    id="wabaId"
                    autoComplete="off"
                    value={wabaId}
                    onChange={(event) => setWabaId(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="accessToken"
                    className="text-sm font-medium leading-none"
                  >
                    System User access token
                  </label>
                  <Input
                    id="accessToken"
                    type="password"
                    autoComplete="new-password"
                    value={accessToken}
                    onChange={(event) => setAccessToken(event.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Se envía solo al servidor y nunca se devuelve a la pantalla.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configura este callback en Meta y suscribe el campo{" "}
                  <code className="break-all">
                    {API_URL}/webhooks/meta/whatsapp
                  </code>{" "}
                  al webhook <code>messages</code>.
                </p>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="mr-2 h-4 w-4" />
                  )}
                  Validar y conectar
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Un administrador debe configurar la conexión de Meta para esta
                sede.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Número oficial conectado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">
                  {integration.verifiedName || integration.displayPhoneNumber}
                </p>
                <p className="text-muted-foreground">
                  {integration.displayPhoneNumber || integration.phoneNumberId}
                </p>
                <p className="text-xs text-muted-foreground">
                  ID: {integration.phoneNumberId}
                </p>
                <p className="break-all pt-2 text-xs text-muted-foreground">
                  Webhook: {API_URL}/webhooks/meta/whatsapp
                </p>
                {isAdministrator && (
                  <form className="space-y-3 pt-3" onSubmit={saveIntegration}>
                    <label
                      htmlFor="newAccessToken"
                      className="text-sm font-medium leading-none"
                    >
                      Actualizar credenciales
                    </label>
                    <Input
                      id="newPhoneNumberId"
                      aria-label="Phone Number ID"
                      placeholder="Phone Number ID"
                      value={phoneNumberId}
                      onChange={(event) => setPhoneNumberId(event.target.value)}
                    />
                    <Input
                      id="newWabaId"
                      aria-label="WhatsApp Business Account ID"
                      placeholder="WhatsApp Business Account ID"
                      value={wabaId}
                      onChange={(event) => setWabaId(event.target.value)}
                    />
                    <Input
                      id="newAccessToken"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nuevo access token"
                      value={accessToken}
                      onChange={(event) => setAccessToken(event.target.value)}
                    />
                    <Button
                      className="w-full"
                      variant="outline"
                      type="submit"
                      disabled={saving || !accessToken.trim()}
                    >
                      {saving ? "Validando..." : "Actualizar conexión"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="h-5 w-5" />
                  Conversaciones
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {conversations.length}
                </span>
              </CardHeader>
              <div className="h-[420px] overflow-y-auto">
                <div className="space-y-1 p-2 pt-0">
                  {conversations.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Los mensajes nuevos aparecerán aquí.
                    </p>
                  ) : (
                    conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setSelectedConversation(conversation)}
                        className={`w-full rounded-md p-3 text-left transition hover:bg-muted ${
                          selectedConversation?.id === conversation.id
                            ? "bg-muted"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {conversation.profileName ||
                              conversation.phoneNumber ||
                              conversation.contactId}
                          </span>
                          {conversation.aiEnabled && (
                            <Bot
                              className="h-4 w-4 shrink-0 text-emerald-600"
                              aria-label="Agente activo"
                            />
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {conversation.lastMessageText || "Sin mensajes"}
                        </p>
                        {conversation.lastMessageAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(
                              conversation.lastMessageAt,
                            ).toLocaleString()}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </Card>
          </section>

          <Card className="flex min-h-[620px] flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between border-b">
                  <div>
                    <CardTitle className="text-base">
                      {selectedConversation.profileName ||
                        selectedConversation.phoneNumber ||
                        selectedConversation.contactId}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation.phoneNumber ||
                        selectedConversation.contactId}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void toggleAi()}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Agente{" "}
                    {selectedConversation.aiEnabled ? "activo" : "inactivo"}
                  </Button>
                </CardHeader>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.direction === "OUTBOUND"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            message.direction === "OUTBOUND"
                              ? "bg-emerald-600 text-white"
                              : "bg-muted"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {message.body ||
                              (message.isVoiceNote
                                ? "Nota de voz sin transcripción"
                                : `[${message.type}]`)}
                          </p>
                          <p className="mt-1 text-right text-[10px] opacity-70">
                            {new Date(message.timestamp).toLocaleTimeString()}{" "}
                            {message.direction === "OUTBOUND" &&
                              `· ${message.status.toLowerCase()}`}
                          </p>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <p className="py-12 text-center text-sm text-muted-foreground">
                        Aún no hay mensajes guardados.
                      </p>
                    )}
                  </div>
                </div>
                <form
                  onSubmit={sendMessage}
                  className="flex gap-2 border-t p-4"
                >
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Escribe un mensaje..."
                    maxLength={4096}
                    aria-label="Mensaje"
                  />
                  <Button type="submit" disabled={sending || !draft.trim()}>
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="sr-only">Enviar</span>
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <MessageCircle className="h-10 w-10" />
                <p>
                  Selecciona una conversación para ver y responder mensajes.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm">
              Webhooks de Meta verificados por firma y procesados con
              reintentos.
            </p>
          </div>
          <div className="flex gap-3">
            <Bot className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm">
              Reutiliza el agente, catálogo y cálculo de pedidos existente.
            </p>
          </div>
          <div className="flex gap-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm">
              Las notas de voz entrantes se descargan y transcriben antes de
              enviarse al agente.
            </p>
          </div>
          <div className="flex gap-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm">
              Los mensajes libres están sujetos a la ventana de atención de
              Meta; fuera de ella se requieren plantillas aprobadas.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
