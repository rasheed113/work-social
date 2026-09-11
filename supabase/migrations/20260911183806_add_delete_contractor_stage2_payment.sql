create or replace function public.delete_contractor_stage2_payment(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path to ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  update public.contractor_finance_payments
  set deleted_at=coalesce(deleted_at, now())
  where id=p_payment_id and contractor_profile_id=v_uid and deleted_at is null;
  if not found then raise exception 'Payment not found or already voided'; end if;
end;
$$;
revoke all on function public.delete_contractor_stage2_payment(uuid) from public;
grant execute on function public.delete_contractor_stage2_payment(uuid) to authenticated;
