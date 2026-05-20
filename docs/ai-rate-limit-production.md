# AI Rate Limit Production Notes

Client-side limits are only a usability guard. Production cost control must be enforced in the Supabase Edge Function that handles `/functions/v1/ai-chat`.

Recommended server-side rules:

- Require an authenticated user for every AI chat request.
- Store usage in an `ai_usage` table keyed by `user_id` and date.
- Limit normal users to 40 chat replies per day.
- Limit suggestion generation separately or cache suggestions by screen/context hash.
- Reject requests over 8 recent messages or over a fixed character budget.
- Apply a 2 to 3 second per-user cooldown.
- Log `user_id`, request type, token estimate, status, and latency.
- Return clear JSON errors: `daily_limit_exceeded`, `cooldown`, `unauthorized`, `provider_timeout`.

Suggested table:

```sql
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  chat_count int not null default 0,
  suggestion_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;

create policy "ai_usage_select_own"
on public.ai_usage for select
to authenticated
using (user_id = auth.uid());
```
