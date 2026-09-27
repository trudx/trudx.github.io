import { ApplicationServer, importVapidKeys, PushMessageError, Urgency } from "@negrel/webpush";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  hourly_tasks_enabled: boolean;
  long_task_enabled: boolean;
};

type TimerRow = {
  id: string;
  user_id: string;
  started_at: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  due_date: string;
  column_id: string;
};

type TaskColumnRow = { id: string; user_id: string; name: string };
type PushPayload = { title: string; body: string; url: string; tag: string };

const FUNCTION_NAME = "dispatch-task-notifications";

function getLocalTime(timezone: string, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      hour: Number(values.hour),
      hourKey: `${values.year}-${values.month}-${values.day}T${values.hour}`,
    };
  } catch {
    return getLocalTime("America/Sao_Paulo", date);
  }
}

function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;

    const host = url.hostname.toLowerCase();
    return (
      host === "fcm.googleapis.com" ||
      host === "android.googleapis.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".push.services.mozilla.com") ||
      host.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

function isCompletedColumn(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return /^(conclu|finalizad|feito|done|complete)/.test(normalized);
}

function createPayload(payload: PushPayload) {
  return JSON.stringify(payload);
}

async function reserveEvent(
  supabase: SupabaseClient,
  subscriptionId: string,
  eventKey: string,
): Promise<string | null> {
  const now = new Date();
  const retryAfter = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("push_notification_events")
    .insert({
      subscription_id: subscriptionId,
      event_key: eventKey,
      status: "sending",
      attempts: 1,
      last_attempt_at: now.toISOString(),
      retry_after: retryAfter,
    })
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") {
    const { data: existing, error: lookupError } = await supabase
      .from("push_notification_events")
      .select("id,status,attempts,retry_after")
      .eq("subscription_id", subscriptionId)
      .eq("event_key", eventKey)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (
      !existing ||
      existing.status === "sent" ||
      existing.attempts >= 10 ||
      (existing.retry_after && new Date(existing.retry_after).getTime() > now.getTime())
    ) {
      return null;
    }

    // Compare-and-set the old retry time to avoid two overlapping cron invocations sending twice.
    const { data: claimed, error: claimError } = await supabase
      .from("push_notification_events")
      .update({
        status: "sending",
        attempts: existing.attempts + 1,
        last_attempt_at: now.toISOString(),
        retry_after: retryAfter,
      })
      .eq("id", existing.id)
      .eq("retry_after", existing.retry_after)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    return claimed?.id ?? null;
  }
  if (error) throw error;
  return data?.id ?? null;
}

async function deliver(
  supabase: SupabaseClient,
  appServer: ApplicationServer,
  subscription: PushSubscriptionRow,
  eventKey: string,
  payload: PushPayload,
) {
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    console.warn("Skipped unsupported Web Push endpoint", { subscriptionId: subscription.id });
    return "skipped" as const;
  }

  let eventId: string | null = null;
  try {
    eventId = await reserveEvent(supabase, subscription.id, eventKey);
  } catch (error) {
    console.error("Could not reserve push notification event", {
      subscriptionId: subscription.id,
    });
    return "failed" as const;
  }

  // A unique event key makes overlapping cron invocations safe and prevents duplicate pushes.
  if (!eventId) return "skipped" as const;

  try {
    await appServer
      .subscribe({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      })
      .pushTextMessage(createPayload(payload), {
        ttl: 3600,
        urgency: Urgency.High,
      });
    const { error: sentError } = await supabase
      .from("push_notification_events")
      .update({ status: "sent", sent_at: new Date().toISOString(), retry_after: null })
      .eq("id", eventId);
    if (sentError) throw sentError;
    return "sent" as const;
  } catch (error) {
    const status = error instanceof PushMessageError ? error.response.status : undefined;
    if (status === 404 || status === 410) {
      await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
      return "expired" as const;
    }

    // Retry transient delivery failures after a cooldown instead of on every minute tick.
    await supabase
      .from("push_notification_events")
      .update({ status: "failed", last_attempt_at: new Date().toISOString() })
      .eq("id", eventId);
    console.error("Web Push delivery failed", { subscriptionId: subscription.id, status });
    return "failed" as const;
  }
}

export default {
  fetch: withSupabase({ auth: "secret:task_push" }, async (request, { supabaseAdmin }) => {
    if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    try {
      const exportedVapidKeys = Deno.env.get("VAPID_KEYS_JSON");
      const contactInformation = Deno.env.get("VAPID_SUBJECT");
      if (!exportedVapidKeys || !contactInformation) {
        throw new Error("Missing Web Push server configuration.");
      }

      const supabase = supabaseAdmin;
      const vapidKeys = await importVapidKeys(JSON.parse(exportedVapidKeys), { extractable: false });
      const appServer = await ApplicationServer.new({ contactInformation, vapidKeys });

      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from("push_subscriptions")
        .select("id,user_id,endpoint,p256dh,auth,timezone,hourly_tasks_enabled,long_task_enabled");
      if (subscriptionsError) throw subscriptionsError;

      const activeSubscriptions = (subscriptions ?? []) as PushSubscriptionRow[];
      const enabledSubscriptions = activeSubscriptions.filter(
        (subscription) => subscription.hourly_tasks_enabled || subscription.long_task_enabled,
      );
      const userIds = [...new Set(enabledSubscriptions.map((subscription) => subscription.user_id))];
      const stats = { sent: 0, failed: 0, expired: 0 };
      const deliverAndCount = async (subscription: PushSubscriptionRow, eventKey: string, payload: PushPayload) => {
        const result = await deliver(supabase, appServer, subscription, eventKey, payload);
        if (result === "sent") stats.sent += 1;
        if (result === "failed") stats.failed += 1;
        if (result === "expired") stats.expired += 1;
      };

      if (userIds.length) {
        const { data: timers, error: timersError } = await supabase
          .from("task_time_entries")
          .select("id,user_id,started_at")
          .is("ended_at", null)
          .in("user_id", userIds);
        if (timersError) throw timersError;

        const activeTimers = (timers ?? []) as TimerRow[];
        const longTimers = activeTimers.filter(
          (timer) => Date.now() - new Date(timer.started_at).getTime() >= 3 * 60 * 60 * 1000,
        );
        for (const timer of longTimers) {
          const timerSubscriptions = enabledSubscriptions.filter(
            (subscription) => subscription.user_id === timer.user_id && subscription.long_task_enabled,
          );
          for (const subscription of timerSubscriptions) {
            await deliverAndCount(subscription, `pause:${timer.id}`, {
              title: "Hora de fazer uma pausa",
              body: "Você está na mesma tarefa há 3 horas. Faça uma pausa, levante e alongue-se um pouco.",
              url: "dashboard/tasks",
              tag: `pause-${timer.id}`,
            });
          }
        }

        const hourlySubscriptions = enabledSubscriptions.filter((subscription) => subscription.hourly_tasks_enabled);
        const dueUsersByDate = new Map<string, Set<string>>();
        const dueSubscriptions: { subscription: PushSubscriptionRow; hourKey: string; date: string }[] = [];

        for (const subscription of hourlySubscriptions) {
          const localTime = getLocalTime(subscription.timezone);
          // Keep reminders within a normal workday, in each device's configured timezone.
          if (localTime.hour < 9 || localTime.hour > 18) continue;
          const dueUsers = dueUsersByDate.get(localTime.date) ?? new Set<string>();
          dueUsers.add(subscription.user_id);
          dueUsersByDate.set(localTime.date, dueUsers);
          dueSubscriptions.push({
            subscription,
            hourKey: localTime.hourKey,
            date: localTime.date,
          });
        }

        const dueTasksByUserDate = new Map<string, TaskRow[]>();
        const subscribedUsers = [...new Set(dueSubscriptions.map(({ subscription }) => subscription.user_id))];
        if (dueSubscriptions.length) {
          const { data: columns, error: columnsError } = await supabase
            .from("task_columns")
            .select("id,user_id,name")
            .in("user_id", subscribedUsers);
          if (columnsError) throw columnsError;

          const completedColumnsByUser = new Map<string, Set<string>>();
          for (const column of (columns ?? []) as TaskColumnRow[]) {
            if (!isCompletedColumn(column.name)) continue;
            const completed = completedColumnsByUser.get(column.user_id) ?? new Set<string>();
            completed.add(column.id);
            completedColumnsByUser.set(column.user_id, completed);
          }

          for (const [date, usersForDate] of dueUsersByDate) {
            const { data: tasks, error: tasksError } = await supabase
              .from("tasks")
              .select("id,user_id,due_date,column_id")
              .eq("due_date", date)
              .in("user_id", [...usersForDate]);
            if (tasksError) throw tasksError;

            for (const task of (tasks ?? []) as TaskRow[]) {
              if (completedColumnsByUser.get(task.user_id)?.has(task.column_id)) continue;
              const key = `${task.user_id}:${date}`;
              const userTasks = dueTasksByUserDate.get(key) ?? [];
              userTasks.push(task);
              dueTasksByUserDate.set(key, userTasks);
            }
          }
        }

        for (const { subscription, hourKey, date } of dueSubscriptions) {
          const dueTasks = dueTasksByUserDate.get(`${subscription.user_id}:${date}`) ?? [];
          if (!dueTasks.length) continue;
          await deliverAndCount(subscription, `due-tasks:${hourKey}`, {
            title: "Você tem tarefas para hoje",
            body: `Há ${dueTasks.length} tarefa${dueTasks.length === 1 ? "" : "s"} prevista${dueTasks.length === 1 ? "" : "s"} para hoje. Organize seu dia e lembre-se de fazer pausas.`,
            url: "dashboard/tasks",
            tag: `due-tasks-${date}`,
          });
        }
      }

      const retentionDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
      const { error: cleanupError } = await supabase
        .from("push_notification_events")
        .delete()
        .lt("created_at", retentionDate);
      if (cleanupError) console.error("Could not clean old push events", cleanupError.message);

      return Response.json({ ok: true, function: FUNCTION_NAME, ...stats });
    } catch (error) {
      console.error("Task push dispatcher failed", {
        message: error instanceof Error ? error.message : "unknown error",
      });
      return Response.json({ error: "Notification dispatch failed" }, { status: 500 });
    }
  }),
};
