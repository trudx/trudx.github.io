"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Clock3, ShieldCheck, Timer } from "lucide-react";
import { toast } from "sonner";

import Button from "@/components/ui/button";
import { SettingsSection } from "./settings-section";
import { get, patch, remove, upsert } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

type PushSubscriptionRecord = {
  id: string;
  user_id: string;
  endpoint: string;
  timezone: string;
  hourly_tasks_enabled: boolean;
  long_task_enabled: boolean;
};

const SELECT_COLUMNS = "id,user_id,endpoint,timezone,hourly_tasks_enabled,long_task_enabled";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;

function decodeBase64Url(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function encodeBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
}

export function TaskPushNotificationsSetting() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [record, setRecord] = useState<PushSubscriptionRecord | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  const loadSubscription = useCallback(async () => {
    if (typeof window === "undefined") return;
    const available =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(VAPID_PUBLIC_KEY);
    setSupported(available);
    if (!available) {
      setPermission("unsupported");
      setIsLoading(false);
      return;
    }

    setPermission(Notification.permission);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setSupported(false);
        return;
      }

      const currentUserId = await getAuthenticatedUserId();
      const browserSubscription = await registration.pushManager.getSubscription();
      const rows = await get<PushSubscriptionRecord>("push_subscriptions", {
        select: SELECT_COLUMNS,
        filters: { user_id: currentUserId },
      });
      const currentRecord = browserSubscription
        ? (rows.find((row) => row.endpoint === browserSubscription.endpoint) ?? null)
        : null;

      if (currentRecord && currentRecord.timezone !== getTimezone()) {
        await patch(
          "push_subscriptions",
          { timezone: getTimezone() },
          { id: currentRecord.id, user_id: currentUserId },
        );
      }

      setUserId(currentUserId);
      setPushSubscription(browserSubscription);
      setRecord(currentRecord);
      setBackendAvailable(true);
    } catch (error) {
      console.error("Falha ao carregar configuração de notificações push:", error);
      setBackendAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Inicializa a preferência a partir das APIs do navegador após a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSubscription();
  }, [loadSubscription]);

  async function handleEnable() {
    if (!supported || !VAPID_PUBLIC_KEY) return;
    setIsSaving(true);

    try {
      const nextPermission =
        Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        toast.error(
          nextPermission === "denied"
            ? "Permissão bloqueada pelo navegador"
            : "Permita notificações para ativar os lembretes",
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const browserSubscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY),
        }));
      const currentUserId = userId ?? (await getAuthenticatedUserId());
      const p256dh = browserSubscription.getKey("p256dh");
      const auth = browserSubscription.getKey("auth");
      if (!p256dh || !auth) throw new Error("O navegador não forneceu as chaves da assinatura.");

      const [savedRecord] = await upsert<PushSubscriptionRecord>(
        "push_subscriptions",
        [
          {
            user_id: currentUserId,
            endpoint: browserSubscription.endpoint,
            p256dh: encodeBase64Url(p256dh),
            auth: encodeBase64Url(auth),
            timezone: getTimezone(),
            hourly_tasks_enabled: true,
            long_task_enabled: true,
          },
        ],
        { onConflict: "endpoint", select: SELECT_COLUMNS },
      );
      if (!savedRecord) throw new Error("O Supabase não retornou a assinatura gravada.");

      setUserId(currentUserId);
      setPushSubscription(browserSubscription);
      setRecord(savedRecord ?? null);
      setBackendAvailable(true);
      toast.success("Notificações ativadas neste dispositivo");
    } catch (error) {
      console.error("Falha ao ativar notificações push:", error);
      toast.error("Não foi possível ativar as notificações", {
        description: error instanceof Error ? error.message : "Verifique a configuração do Supabase e tente novamente.",
      });
      await loadSubscription();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisable() {
    if (!record || !pushSubscription || !userId) return;
    setIsSaving(true);

    try {
      await remove("push_subscriptions", { id: record.id, user_id: userId });
      await pushSubscription.unsubscribe();
      setRecord(null);
      setPushSubscription(null);
      toast.success("Notificações desativadas neste dispositivo");
    } catch (error) {
      console.error("Falha ao desativar notificações push:", error);
      toast.error("Não foi possível desativar as notificações", {
        description: "Tente novamente ou remova a permissão nas configurações do navegador.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function updatePreference(key: "hourly_tasks_enabled" | "long_task_enabled", value: boolean) {
    if (!record || !userId) return;
    const previousRecord = record;
    setRecord({ ...record, [key]: value });

    try {
      await patch("push_subscriptions", { [key]: value, timezone: getTimezone() }, { id: record.id, user_id: userId });
    } catch (error) {
      setRecord(previousRecord);
      toast.error("Não foi possível salvar esta preferência", {
        description: "Confira se a configuração do Supabase está atualizada.",
      });
      console.error("Falha ao atualizar preferência de push:", error);
    }
  }

  const isEnabled = Boolean(record && pushSubscription);

  return (
    <SettingsSection
      title="Notificações de tarefas"
      description="Gerencie os lembretes vinculados à sua conta e a este dispositivo."
      icon={isEnabled ? Bell : BellOff}
    >
      <div className="space-y-4">
        {!VAPID_PUBLIC_KEY ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm leading-6 text-foreground">
            As notificações ainda não estão disponíveis. Você poderá ativá-las quando o recurso for habilitado.
          </div>
        ) : backendAvailable === false ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm leading-6 text-foreground">
            Não foi possível carregar suas preferências de notificações. Recarregue a página para tentar novamente.
          </div>
        ) : !supported ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            Este navegador não oferece suporte a push ou não há um service worker registrado. Abra o PWA publicado em
            HTTPS e tente novamente.
          </div>
        ) : permission === "denied" && !isEnabled ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm leading-6 text-foreground">
            As notificações foram bloqueadas nas permissões do navegador. Libere o acesso ao site nas configurações do
            navegador para ativá-las.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors has-[:disabled]:cursor-not-allowed has-[:checked]:border-primary/40 has-[:checked]:bg-primary/[0.04]">
            <input
              aria-label="Lembrete de tarefas do dia"
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={record?.hourly_tasks_enabled ?? true}
              disabled={!isEnabled || isSaving}
              onChange={(event) => void updatePreference("hourly_tasks_enabled", event.target.checked)}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock3 className="size-4 text-primary" /> Tarefas do dia
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                De hora em hora, das 9h às 18h no fuso do dispositivo, se houver tarefas previstas para hoje.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors has-[:disabled]:cursor-not-allowed has-[:checked]:border-primary/40 has-[:checked]:bg-primary/[0.04]">
            <input
              aria-label="Lembrete para fazer uma pausa"
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={record?.long_task_enabled ?? true}
              disabled={!isEnabled || isSaving}
              onChange={(event) => void updatePreference("long_task_enabled", event.target.checked)}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Timer className="size-4 text-primary" /> Pausa após 3 horas
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Um aviso quando o cronômetro ficar três horas na mesma tarefa.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            As notificações precisam da sua permissão e podem ser desativadas a qualquer momento.
          </p>
          {isEnabled ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || isLoading}
              onClick={() => void handleDisable()}
              className="h-8 shrink-0 px-3 text-xs font-medium"
            >
              {isSaving ? "Salvando..." : "Desativar neste dispositivo"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!supported || backendAvailable === false || isSaving || isLoading || permission === "denied"}
              onClick={() => void handleEnable()}
              className="h-8 shrink-0 px-3 text-xs font-medium"
            >
              {isLoading || isSaving ? "Aguarde..." : "Ativar notificações"}
            </Button>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
