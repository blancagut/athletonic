alter table public.checkout_intents
    add constraint checkout_intents_subtotal_nonnegative check (subtotal >= 0) not valid;

alter table public.checkout_intents
    validate constraint checkout_intents_subtotal_nonnegative;

drop policy if exists "checkout_intents_insert_guest_or_user" on public.checkout_intents;
create policy "checkout_intents_insert_guest_or_user"
    on public.checkout_intents for insert
    to anon, authenticated
    with check (
        (user_id is null or user_id = auth.uid())
        and status = 'new'
    );