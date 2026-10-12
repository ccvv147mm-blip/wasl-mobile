create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

alter table public.push_tokens enable row level security;

do $$ begin
  create policy "own push tokens" on public.push_tokens
    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform extensions.net_http_post(
    url := 'https://project--2a26991d-944d-41ba-b079-e4402e540c00.lovable.app/api/public/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', 'd162d006d2f329a4d6ef583a628d22a7f7560fb029aad6f2'
    ),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', coalesce(NEW.body, ''),
      'link', coalesce(NEW.link, '/notifications')
    )
  );
  return NEW;
exception when others then
  return NEW;
end;
$$;

revoke all on function public.dispatch_push_notification() from public, anon, authenticated;

drop trigger if exists notifications_push_dispatch on public.notifications;
create trigger notifications_push_dispatch
after insert on public.notifications
for each row execute function public.dispatch_push_notification();