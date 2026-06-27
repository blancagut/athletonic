create table if not exists public.newsletter_subscribers (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    source text not null default 'footer',
    status text not null default 'subscribed',
    metadata jsonb not null default '{}'::jsonb,
    subscribed_at timestamptz not null default timezone('utc'::text, now()),
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint newsletter_subscribers_email_format
        check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    constraint newsletter_subscribers_status_check
        check (status in ('subscribed', 'unsubscribed'))
);

create index if not exists newsletter_subscribers_status_idx
    on public.newsletter_subscribers(status, subscribed_at desc);

create or replace function public.set_newsletter_subscribers_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists set_newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger set_newsletter_subscribers_updated_at
before update on public.newsletter_subscribers
for each row
execute function public.set_newsletter_subscribers_updated_at();

alter table public.newsletter_subscribers enable row level security;
