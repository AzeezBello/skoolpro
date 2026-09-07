-- Payment application was a read-modify-write done in JavaScript across three
-- separate callers (Paystack webhook, Flutterwave webhook, the browser
-- redirect /api/payments/verify, plus the manual apply-payment route). Two of
-- those fire for the same gateway reference within seconds of each other, and
-- each did "read invoice -> compute -> update" plus "read payment -> update"
-- with no lock, so a single successful charge could be credited twice and a
-- single reference could produce duplicate payments rows.
--
-- This migration moves the whole operation into one Postgres function that:
--   * locks the invoice row (SELECT ... FOR UPDATE),
--   * treats a reference already present in payment_history as a no-op,
--   * appends to payment_history, updates amount_paid/status, and upserts the
--     payments row in the same transaction (so a failed invoice update can no
--     longer leave the payment marked "success" with nothing credited),
--   * records overpayments honestly (received vs applied) instead of silently
--     dropping the excess.
-- and adds unique indexes on the gateway reference so a duplicate row cannot
-- be inserted even by a code path that bypasses the function.

-- 1. Dedupe any existing duplicate gateway rows before adding uniqueness.
with ranked as (
  select id,
         row_number() over (
           partition by gateway, gateway_response ->> 'reference'
           order by (status = 'success') desc, created_at asc
         ) as rn
  from public.payments
  where gateway = 'paystack' and gateway_response ->> 'reference' is not null
)
delete from public.payments p using ranked r where p.id = r.id and r.rn > 1;

with ranked as (
  select id,
         row_number() over (
           partition by gateway, gateway_response ->> 'tx_ref'
           order by (status = 'success') desc, created_at asc
         ) as rn
  from public.payments
  where gateway = 'flutterwave' and gateway_response ->> 'tx_ref' is not null
)
delete from public.payments p using ranked r where p.id = r.id and r.rn > 1;

drop index if exists public.idx_payments_gateway_reference;
drop index if exists public.idx_payments_gateway_tx_ref;

create unique index if not exists idx_payments_paystack_reference_unique
  on public.payments (gateway, (gateway_response ->> 'reference'))
  where gateway = 'paystack' and gateway_response ->> 'reference' is not null;

create unique index if not exists idx_payments_flutterwave_tx_ref_unique
  on public.payments (gateway, (gateway_response ->> 'tx_ref'))
  where gateway = 'flutterwave' and gateway_response ->> 'tx_ref' is not null;

-- 2. Atomic, idempotent payment application.
create or replace function public.apply_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_gateway public.payment_gateway,
  p_reference text default null,
  p_method text default null,
  p_note text default null,
  p_actor uuid default null,
  p_gateway_response jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_applied numeric(12,2);
  v_new_paid numeric(12,2);
  v_new_status public.invoice_status;
  v_entry jsonb;
  v_reference_field text;
  v_payment_id uuid;
  v_already boolean := false;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;

  if v_invoice.status = 'cancelled' then
    raise exception 'Invoice is cancelled' using errcode = '22023';
  end if;

  -- Idempotency: the same gateway reference is only ever applied once.
  if p_reference is not null and p_reference <> '' then
    select exists (
      select 1
      from jsonb_array_elements(coalesce(v_invoice.payment_history, '[]'::jsonb)) e
      where e ->> 'reference' = p_reference
    ) into v_already;
  end if;

  v_total := coalesce(v_invoice.total_amount, v_invoice.amount, 0);
  v_paid := coalesce(v_invoice.amount_paid, 0);
  v_remaining := greatest(v_total - v_paid, 0);

  if v_already then
    -- Still make sure the payments row reflects success (e.g. webhook and
    -- redirect-verify raced and the first caller already credited).
    v_applied := 0;
    v_new_paid := v_paid;
    v_new_status := v_invoice.status;
  else
    if p_gateway = 'manual' and p_amount > v_remaining then
      raise exception 'Amount exceeds invoice balance' using errcode = '22023';
    end if;

    v_applied := least(p_amount, v_remaining);
    v_new_paid := v_paid + v_applied;
    v_new_status := case
      when v_new_paid >= v_total and v_total > 0 then 'paid'::public.invoice_status
      when v_new_paid > 0 then 'partial'::public.invoice_status
      else v_invoice.status
    end;

    v_entry := jsonb_strip_nulls(jsonb_build_object(
      'amount', v_applied,
      'received', p_amount,
      'date', now(),
      'by', coalesce(p_actor::text, p_gateway::text),
      'method', coalesce(p_method, case when p_gateway = 'manual' then 'manual' else 'gateway' end),
      'note', nullif(p_note, ''),
      'reference', nullif(p_reference, ''),
      'gateway', p_gateway
    ));

    update public.invoices
    set amount_paid = v_new_paid,
        status = v_new_status,
        payment_history = coalesce(payment_history, '[]'::jsonb) || jsonb_build_array(v_entry),
        updated_at = now()
    where id = p_invoice_id;
  end if;

  -- Upsert the payments ledger row. Gateway rows are keyed by reference;
  -- manual rows are always new.
  v_reference_field := case p_gateway when 'paystack' then 'reference' when 'flutterwave' then 'tx_ref' else null end;

  if v_reference_field is not null and p_reference is not null then
    select id into v_payment_id
    from public.payments
    where gateway = p_gateway
      and gateway_response ->> v_reference_field = p_reference
    for update;
  end if;

  if v_payment_id is not null then
    update public.payments
    set invoice_id = p_invoice_id,
        amount = p_amount,
        status = 'success',
        gateway_response = coalesce(p_gateway_response, '{}'::jsonb)
                           || jsonb_build_object(v_reference_field, p_reference)
                           || jsonb_build_object('applied_amount', v_applied),
        school_id = coalesce(school_id, v_invoice.school_id),
        updated_at = now()
    where id = v_payment_id;
  elsif not v_already then
    insert into public.payments (invoice_id, gateway, amount, status, gateway_response, school_id)
    values (
      p_invoice_id,
      p_gateway,
      p_amount,
      'success',
      coalesce(p_gateway_response, '{}'::jsonb)
        || case when v_reference_field is not null and p_reference is not null
             then jsonb_build_object(v_reference_field, p_reference) else '{}'::jsonb end
        || jsonb_strip_nulls(jsonb_build_object(
             'applied_amount', v_applied,
             'method', p_method,
             'note', nullif(p_note, ''),
             'recorded_by', p_actor
           )),
      v_invoice.school_id
    )
    returning id into v_payment_id;
  end if;

  return jsonb_build_object(
    'invoice_id', p_invoice_id,
    'duplicate', v_already,
    'applied', v_applied,
    'received', p_amount,
    'amount_paid', v_new_paid,
    'status', v_new_status,
    'payment_id', v_payment_id
  );
end;
$$;

-- Only the service role (server routes) may call this; RLS-scoped clients
-- must go through the API so the role/tenant checks apply.
revoke all on function public.apply_invoice_payment(uuid, numeric, public.payment_gateway, text, text, text, uuid, jsonb) from public;
revoke all on function public.apply_invoice_payment(uuid, numeric, public.payment_gateway, text, text, text, uuid, jsonb) from anon, authenticated;
grant execute on function public.apply_invoice_payment(uuid, numeric, public.payment_gateway, text, text, text, uuid, jsonb) to service_role;

-- 3. Keep invoice status consistent when amounts are edited directly, and
--    flip pending/partial invoices past their due date to "overdue".
create or replace function public.populate_invoice_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_school_id uuid;
  student_email text;
  student_parent_email text;
  amounts_changed boolean := false;
begin
  if new.student_id is not null then
    select s.school_id, s.email, s.parent_email
    into student_school_id, student_email, student_parent_email
    from public.students s
    where s.id = new.student_id;
  end if;

  if coalesce(new.total_amount, 0) = 0 and coalesce(new.amount, 0) > 0 then
    new.total_amount := new.amount;
  end if;

  if coalesce(new.amount, 0) = 0 and coalesce(new.total_amount, 0) > 0 then
    new.amount := new.total_amount;
  end if;

  if new.reference is null or new.reference = '' then
    new.reference := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  end if;

  if coalesce(new.parent_email, '') = '' then
    new.parent_email := coalesce(student_parent_email, student_email);
  end if;

  if new.school_id is null then
    new.school_id := student_school_id;
  end if;

  if tg_op = 'UPDATE' then
    amounts_changed := new.amount_paid is distinct from old.amount_paid
                    or new.total_amount is distinct from old.total_amount;
  end if;

  if new.status is distinct from 'cancelled'::public.invoice_status
     and (new.status is null or amounts_changed) then
    if coalesce(new.amount_paid, 0) >= coalesce(new.total_amount, 0) and coalesce(new.total_amount, 0) > 0 then
      new.status := 'paid'::public.invoice_status;
    elsif coalesce(new.amount_paid, 0) > 0 then
      new.status := 'partial'::public.invoice_status;
    else
      new.status := 'pending'::public.invoice_status;
    end if;
  end if;

  if new.status in ('pending', 'partial') and new.due_date is not null and new.due_date < current_date then
    new.status := 'overdue'::public.invoice_status;
  end if;

  return new;
end;
$$;

create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.invoices
  set status = 'overdue'::public.invoice_status, updated_at = now()
  where status in ('pending', 'partial')
    and due_date is not null
    and due_date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_overdue_invoices() from public, anon, authenticated;
grant execute on function public.mark_overdue_invoices() to service_role;

-- Nightly sweep via pg_cron when the extension is available (Supabase
-- exposes it; local/other Postgres may not). Silently skipped otherwise —
-- the trigger above and the /api/cron/mark-overdue route cover that case.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable, skipping schedule: %', sqlerrm;
    return;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'skoolpro_mark_overdue_invoices';
    perform cron.schedule('skoolpro_mark_overdue_invoices', '15 0 * * *', 'select public.mark_overdue_invoices();');
  end if;
exception when others then
  raise notice 'could not schedule overdue sweep: %', sqlerrm;
end
$$;
