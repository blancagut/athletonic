create or replace function public.submit_checkout_intent(
    p_email text,
    p_cart jsonb,
    p_subtotal numeric,
    p_currency text default 'USD'
)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
    checkout_id uuid;
    checkout_created_at timestamptz;
    normalized_email text;
begin
    normalized_email := lower(trim(p_email));

    if normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
        raise exception 'A valid email is required' using errcode = '22023';
    end if;

    if jsonb_typeof(p_cart) is distinct from 'array' or jsonb_array_length(p_cart) = 0 then
        raise exception 'Cart must include at least one item' using errcode = '22023';
    end if;

    if coalesce(p_subtotal, 0) < 0 then
        raise exception 'Subtotal cannot be negative' using errcode = '22023';
    end if;

    insert into public.checkout_intents (email, user_id, cart, subtotal, currency, status)
    values (
        normalized_email,
        auth.uid(),
        p_cart,
        round(coalesce(p_subtotal, 0), 2),
        upper(coalesce(nullif(trim(p_currency), ''), 'USD')),
        'new'
    )
    returning checkout_intents.id, checkout_intents.created_at
    into checkout_id, checkout_created_at;

    return query select checkout_id, checkout_created_at;
end;
$$;

revoke all on function public.submit_checkout_intent(text, jsonb, numeric, text) from public;
grant execute on function public.submit_checkout_intent(text, jsonb, numeric, text) to anon, authenticated;