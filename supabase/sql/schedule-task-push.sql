-- Run after creating these Supabase Vault secrets:
--   task_push_function_url = https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-task-notifications
--   task_push_apikey       = the project's secret API key named "task_push"
-- This replaces only the cron job owned by this feature.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $schedule$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'task-push-dispatch'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'task-push-dispatch',
    '* * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'task_push_function_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'task_push_apikey')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $job$
  );
end;
$schedule$;
