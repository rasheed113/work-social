create or replace function public.edit_contractor_stage2_payment(p_payment_id uuid, p_amount numeric, p_paid_at timestamptz default now(), p_note text default null)
returns void
language plpgsql
security invoker
set search_path to ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_note is not null and char_length(p_note) > 2000 then raise exception 'Payment note is too long'; end if;
  update public.contractor_finance_payments
  set amount=p_amount, paid_at=coalesce(p_paid_at,now()), note=nullif(btrim(p_note),'')
  where id=p_payment_id and contractor_profile_id=v_uid and deleted_at is null;
  if not found then raise exception 'Payment not found or already voided'; end if;
end;
$$;
