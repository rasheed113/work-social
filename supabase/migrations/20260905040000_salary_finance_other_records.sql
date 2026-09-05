alter table public.worker_finance_received drop constraint if exists worker_finance_received_entry_type_check;

alter table public.worker_finance_received
  add constraint worker_finance_received_entry_type_check
  check (entry_type = any (array['payment'::text, 'advance'::text, 'other'::text]));
