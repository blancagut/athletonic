create or replace function public.generate_order_reference(p_prefix text default 'ATH')
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    candidate text;
begin
    loop
        candidate := upper(p_prefix) || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex'));
        exit when not exists (
            select 1 from public.orders where order_reference = candidate
        ) and not exists (
            select 1 from public.return_requests where return_reference = candidate
        );
    end loop;

    return candidate;
end;
$$;
