create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(11);

-- The SQL fixture mirrors the deterministic TypeScript contract fixture.
-- It uses real source tables so the field and state assumptions stay visible.
insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-00000000f901',
  'authenticated',
  'authenticated',
  'analytics-fixture@nodria.test',
  '',
  '{}',
  '{}',
  now(),
  now()
);

insert into public.warehouses (id, code, name, city, country_code, is_active)
values
  ('10000000-0000-4000-8000-00000000f911', 'QA-AN-MAD', 'Analytics QA Madrid', 'Madrid', 'ES', true),
  ('10000000-0000-4000-8000-00000000f912', 'QA-AN-SEV', 'Analytics QA Sevilla', 'Sevilla', 'ES', true);

create temporary table analytics_qa_period on commit drop as
select
  (((now() at time zone 'Europe/Madrid')::date - 29)::timestamp at time zone 'Europe/Madrid') as start_inclusive,
  now() as end_exclusive;

insert into public.orders (
  id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency,
  subtotal, tax_total, shipping_total, discount_total, grand_total,
  shipping_address, billing_address, placed_at
)
values
  ('10000000-0000-4000-8000-00000000f921', 'NDR-QA-AN-PAID', '10000000-0000-4000-8000-00000000f901', 'qa-analytics-paid', repeat(md5('qa-analytics-paid'), 2), 'paid', 'EUR', 121.00, 0, 0, 0, 121.00, '{}', '{}', now() - interval '1 day'),
  ('10000000-0000-4000-8000-00000000f922', 'NDR-QA-AN-SHIP', '10000000-0000-4000-8000-00000000f901', 'qa-analytics-shipped', repeat(md5('qa-analytics-shipped'), 2), 'shipped', 'EUR', 80.50, 0, 0, 0, 80.50, '{}', '{}', now() - interval '2 days'),
  ('10000000-0000-4000-8000-00000000f923', 'NDR-QA-AN-FAIL', '10000000-0000-4000-8000-00000000f901', 'qa-analytics-failed', repeat(md5('qa-analytics-failed'), 2), 'cancelled', 'EUR', 50.00, 0, 0, 0, 50.00, '{}', '{}', now() - interval '3 days'),
  ('10000000-0000-4000-8000-00000000f924', 'NDR-QA-AN-PEND', '10000000-0000-4000-8000-00000000f901', 'qa-analytics-pending', repeat(md5('qa-analytics-pending'), 2), 'pending_payment', 'EUR', 30.00, 0, 0, 0, 30.00, '{}', '{}', now() - interval '4 days'),
  ('10000000-0000-4000-8000-00000000f925', 'NDR-QA-AN-REF', '10000000-0000-4000-8000-00000000f901', 'qa-analytics-refunded', repeat(md5('qa-analytics-refunded'), 2), 'refunded', 'EUR', 25.00, 0, 0, 0, 25.00, '{}', '{}', now() - interval '5 days'),
  ('10000000-0000-4000-8000-00000000f926', 'NDR-QA-AN-START', '10000000-0000-4000-8000-00000000f901', 'qa-analytics-start', repeat(md5('qa-analytics-start'), 2), 'paid', 'EUR', 10.00, 0, 0, 0, 10.00, '{}', '{}', (select start_inclusive from analytics_qa_period)),
  ('10000000-0000-4000-8000-00000000f927', 'NDR-QA-AN-END', '10000000-0000-4000-8000-00000000f901', 'qa-analytics-end', repeat(md5('qa-analytics-end'), 2), 'paid', 'EUR', 15.00, 0, 0, 0, 15.00, '{}', '{}', (select end_exclusive from analytics_qa_period));

insert into public.payment_transactions (order_id, provider, status, amount, currency, processed_at)
values
  ('10000000-0000-4000-8000-00000000f921', 'demo', 'paid', 121.00, 'EUR', now() - interval '1 day'),
  ('10000000-0000-4000-8000-00000000f921', 'demo', 'paid', 121.00, 'EUR', now() - interval '1 day'),
  ('10000000-0000-4000-8000-00000000f922', 'demo', 'partially_refunded', 80.50, 'EUR', now() - interval '2 days'),
  ('10000000-0000-4000-8000-00000000f923', 'demo', 'failed', 50.00, 'EUR', now() - interval '3 days'),
  ('10000000-0000-4000-8000-00000000f927', 'demo', 'paid', 15.00, 'EUR', (select end_exclusive from analytics_qa_period));

insert into public.order_events (order_id, event_key, note, details, occurred_at)
values
  ('10000000-0000-4000-8000-00000000f921', 'payment_paid', 'Analytics fixture approved', '{}', now() - interval '1 day'),
  ('10000000-0000-4000-8000-00000000f921', 'payment_paid', 'Analytics fixture duplicate approved event', '{}', now() - interval '1 day'),
  ('10000000-0000-4000-8000-00000000f922', 'payment_paid', 'Analytics fixture partially refunded', '{}', now() - interval '2 days'),
  ('10000000-0000-4000-8000-00000000f923', 'payment_failed', 'Analytics fixture declined', '{}', now() - interval '3 days'),
  ('10000000-0000-4000-8000-00000000f927', 'payment_paid', 'Analytics fixture at exclusive end', '{}', (select end_exclusive from analytics_qa_period));

insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
select warehouse.id, variant.id, stock.on_hand, stock.reserved
from (values
  ('10000000-0000-4000-8000-00000000f911'::uuid, 'NOD-FS-02', 10, 3),
  ('10000000-0000-4000-8000-00000000f911'::uuid, 'NOD-LM27-4K', 2, 2),
  ('10000000-0000-4000-8000-00000000f912'::uuid, 'NOD-FS-02', 6, 1)
) as stock(warehouse_id, sku, on_hand, reserved)
join public.warehouses warehouse on warehouse.id = stock.warehouse_id
join public.product_variants variant on variant.sku = stock.sku;

insert into public.quote_inquiries (
  id, contact_name, email, company, message, consent_to_contact, status, source, created_at
)
values
  ('10000000-0000-4000-8000-00000000f931', 'Analytics Converted', 'analytics-converted@nodria.test', 'Analytics QA', 'Converted analytics fixture request.', true, 'converted', 'analytics-fixture', now() - interval '1 day'),
  ('10000000-0000-4000-8000-00000000f932', 'Analytics Open', 'analytics-open@nodria.test', 'Analytics QA', 'Open analytics fixture request.', true, 'new', 'analytics-fixture', (select start_inclusive from analytics_qa_period)),
  ('10000000-0000-4000-8000-00000000f933', 'Analytics Outside', 'analytics-outside@nodria.test', 'Analytics QA', 'Older converted analytics fixture.', true, 'converted', 'analytics-fixture', (select start_inclusive from analytics_qa_period) - interval '1 millisecond'),
  ('10000000-0000-4000-8000-00000000f934', 'Analytics End', 'analytics-end@nodria.test', 'Analytics QA', 'At end boundary analytics fixture.', true, 'converted', 'analytics-fixture', (select end_exclusive from analytics_qa_period));

create temporary table analytics_qa_result on commit drop as
with report_period as (
  select start_inclusive, end_exclusive from analytics_qa_period
),
orders_in_period as (
  select count(distinct orders.id)::integer as order_count
  from public.orders orders, report_period period
  where orders.id in (
    '10000000-0000-4000-8000-00000000f921',
    '10000000-0000-4000-8000-00000000f922',
    '10000000-0000-4000-8000-00000000f923',
    '10000000-0000-4000-8000-00000000f924',
    '10000000-0000-4000-8000-00000000f925',
    '10000000-0000-4000-8000-00000000f926',
    '10000000-0000-4000-8000-00000000f927'
  )
    and orders.placed_at >= period.start_inclusive
    and orders.placed_at < period.end_exclusive
    and orders.status in ('paid', 'processing', 'shipped', 'delivered')
),
latest_events as (
  select distinct on (events.order_id)
    events.order_id, events.event_key, events.occurred_at, events.id
  from public.order_events events, report_period period
  where events.order_id in (
    '10000000-0000-4000-8000-00000000f921',
    '10000000-0000-4000-8000-00000000f922',
    '10000000-0000-4000-8000-00000000f923',
    '10000000-0000-4000-8000-00000000f927'
  )
    and events.event_key in ('payment_paid', 'payment_failed')
    and events.occurred_at >= period.start_inclusive
    and events.occurred_at < period.end_exclusive
  order by events.order_id, events.occurred_at desc, events.id desc
),
latest_payments as (
  select distinct on (payments.order_id)
    payments.order_id, payments.status, payments.amount, payments.currency,
    payments.processed_at, orders.status as order_status, orders.grand_total, orders.currency as order_currency,
    payments.id
  from public.payment_transactions payments
  join public.orders orders on orders.id = payments.order_id
  cross join report_period period
  where payments.order_id in (
    '10000000-0000-4000-8000-00000000f921',
    '10000000-0000-4000-8000-00000000f922',
    '10000000-0000-4000-8000-00000000f923',
    '10000000-0000-4000-8000-00000000f927'
  )
    and payments.status in ('paid', 'partially_refunded', 'refunded', 'failed')
    and payments.processed_at >= period.start_inclusive
    and payments.processed_at < period.end_exclusive
  order by payments.order_id, payments.processed_at desc, payments.id::text desc
),
resolved as (
  select events.order_id, events.event_key, payments.status, payments.amount, payments.currency,
    payments.order_status, payments.grand_total, payments.order_currency
  from latest_events events
  join latest_payments payments using (order_id)
  where (events.event_key = 'payment_paid' and payments.status in ('paid', 'partially_refunded', 'refunded'))
     or (events.event_key = 'payment_failed' and payments.status = 'failed')
),
payment_totals as (
  select
    count(distinct order_id)::integer as resolved_count,
    count(distinct order_id) filter (where event_key = 'payment_paid')::integer as approved_count,
    coalesce(sum(grand_total) filter (
      where event_key = 'payment_paid' and currency = 'EUR'
        and amount = grand_total and currency = order_currency
        and order_status in ('paid', 'processing', 'shipped', 'delivered', 'refunded')
    ), 0)::numeric(12,2) as gross_sales
  from resolved
),
inventory_totals as (
  select count(*)::integer as row_count,
    coalesce(sum(on_hand - reserved), 0)::integer as available_units,
    coalesce(sum(reserved), 0)::integer as reserved_units
  from public.inventory
  where warehouse_id in (
    '10000000-0000-4000-8000-00000000f911',
    '10000000-0000-4000-8000-00000000f912'
  )
),
crm_totals as (
  select count(*)::integer as request_count,
    count(*) filter (where status = 'converted')::integer as converted_count
  from public.quote_inquiries inquiries, report_period period
  where inquiries.id in (
    '10000000-0000-4000-8000-00000000f931',
    '10000000-0000-4000-8000-00000000f932',
    '10000000-0000-4000-8000-00000000f933',
    '10000000-0000-4000-8000-00000000f934'
  )
    and inquiries.created_at >= period.start_inclusive
    and inquiries.created_at < period.end_exclusive
)
select orders_in_period.order_count, payment_totals.gross_sales,
  payment_totals.approved_count, payment_totals.resolved_count,
  round(payment_totals.approved_count::numeric / nullif(payment_totals.resolved_count, 0), 6) as approval_rate,
  inventory_totals.row_count, inventory_totals.available_units, inventory_totals.reserved_units,
  crm_totals.converted_count, crm_totals.request_count,
  round(crm_totals.converted_count::numeric / nullif(crm_totals.request_count, 0), 6) as crm_rate
from orders_in_period cross join payment_totals cross join inventory_totals cross join crm_totals;

select is((select order_count from analytics_qa_result), 3, 'valid orders deduplicate ids and include the start boundary, excluding cancelled, pending, refunded and end-boundary rows');
select is((select gross_sales from analytics_qa_result), 201.50::numeric, 'gross sales sum one EUR order snapshot per paid event, including partially refunded status');
select is((select approved_count from analytics_qa_result), 2, 'approved payment numerator counts unique paid orders');
select is((select resolved_count from analytics_qa_result), 3, 'payment denominator includes only matched paid and failed terminal outcomes');
select is((select approval_rate from analytics_qa_result), 0.666667::numeric, 'payment approval rate is approved divided by resolved terminal orders');
select is((select available_units from analytics_qa_result), 12, 'available inventory sums on_hand minus reserved by warehouse and variant');
select is((select reserved_units from analytics_qa_result), 6, 'reserved inventory sums current reserved quantities');
select is((select row_count from analytics_qa_result), 3, 'inventory row count represents warehouse and variant locations');
select is((select converted_count from analytics_qa_result), 1, 'CRM numerator counts current converted quote inquiries');
select is((select request_count from analytics_qa_result), 2, 'CRM denominator includes all quote inquiry states created inside the half-open period');
select is((select crm_rate from analytics_qa_result), 0.500000::numeric, 'CRM conversion rate is converted quote inquiries divided by in-period inquiries');

select * from finish();
rollback;
