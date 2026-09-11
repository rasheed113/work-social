drop function if exists public.edit_contractor_stage2_payment(uuid,numeric,timestamp with time zone,text);
create function public.edit_contractor_stage2_payment(p_payment_id uuid, p_amount numeric, p_paid_at timestamp with time zone default now(), p_note text default null, p_team_id bigint default null)
returns void language plpgsql security invoker set search_path to '' as $$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
 if p_note is not null and char_length(p_note)>2000 then raise exception 'Payment note is too long'; end if;
 if p_team_id is not null and not exists(select 1 from public.contractor_teams t where t.id=p_team_id and t.leader_profile_id=v_uid) then raise exception 'Team not found or access denied'; end if;
 update public.contractor_finance_payments set amount=p_amount, paid_at=coalesce(p_paid_at,now()), note=nullif(btrim(p_note),'') where id=p_payment_id and contractor_profile_id=v_uid and deleted_at is null and (p_team_id is null or team_id=p_team_id);
 if not found then raise exception 'Payment not found or outside selected team'; end if;
end; $$;
revoke all on function public.edit_contractor_stage2_payment(uuid,numeric,timestamp with time zone,text,bigint) from public;
grant execute on function public.edit_contractor_stage2_payment(uuid,numeric,timestamp with time zone,text,bigint) to authenticated;

drop function if exists public.delete_contractor_stage2_payment(uuid);
create function public.delete_contractor_stage2_payment(p_payment_id uuid, p_team_id bigint default null)
returns void language plpgsql security invoker set search_path to '' as $$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if p_team_id is not null and not exists(select 1 from public.contractor_teams t where t.id=p_team_id and t.leader_profile_id=v_uid) then raise exception 'Team not found or access denied'; end if;
 update public.contractor_finance_payments set deleted_at=coalesce(deleted_at,now()) where id=p_payment_id and contractor_profile_id=v_uid and deleted_at is null and (p_team_id is null or team_id=p_team_id);
 if not found then raise exception 'Payment not found or outside selected team'; end if;
end; $$;
revoke all on function public.delete_contractor_stage2_payment(uuid,bigint) from public;
grant execute on function public.delete_contractor_stage2_payment(uuid,bigint) to authenticated;
