begin;
select plan(56);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-00000000e001', 'authenticated', 'authenticated', 'crm-owner-a@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000e002', 'authenticated', 'authenticated', 'crm-admin-a@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000e003', 'authenticated', 'authenticated', 'crm-buyer-a@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000e004', 'authenticated', 'authenticated', 'crm-viewer-a@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000e005', 'authenticated', 'authenticated', 'crm-owner-b@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000e006', 'authenticated', 'authenticated', 'crm-sales-a@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000e007', 'authenticated', 'authenticated', 'crm-sales-b@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000e008', 'authenticated', 'authenticated', 'crm-new-member@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000e009', 'authenticated', 'authenticated', 'crm-superadmin@nodria.test', '', '{}', '{}');

insert into public.user_role_grants (user_id, role)
values
  ('00000000-0000-4000-8000-00000000e006', 'sales_manager'),
  ('00000000-0000-4000-8000-00000000e007', 'sales_manager'),
  ('00000000-0000-4000-8000-00000000e009', 'super_admin');

insert into public.organizations (id, slug, legal_name, display_name, created_by)
values
  ('00000000-0000-4000-8000-00000000f001', 'crm-org-a', 'CRM Organización A SL', 'CRM Org A', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000f002', 'crm-org-b', 'CRM Organización B SL', 'CRM Org B', '00000000-0000-4000-8000-00000000e005');

insert into public.organization_memberships (organization_id, user_id, role, added_by)
values
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000e001', 'owner', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000e002', 'admin', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000e003', 'buyer', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000e004', 'viewer', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000e005', 'owner', '00000000-0000-4000-8000-00000000e005');

insert into public.quote_inquiries (contact_name, email, company, message, consent_to_contact, source)
values ('CRM Test Contact', 'crm-inquiry@nodria.test', 'CRM Inquiry SL', 'Necesitamos una propuesta para puestos de trabajo.', true, 'crm-b2b-test');

create temporary table crm_b2b_test_state (
  quote_id uuid not null,
  quote_item_id uuid
);
grant select, insert, update on crm_b2b_test_state to authenticated;

select ok(not has_table_privilege('authenticated', 'public.organizations', 'INSERT'), 'Tenant organization creation has no direct table grant');
select ok(not has_table_privilege('authenticated', 'public.organization_memberships', 'UPDATE'), 'Tenant roles cannot be updated through direct SQL');
select ok(not has_table_privilege('authenticated', 'public.quotes', 'INSERT'), 'Quotes are only created through the request RPC');
select ok(not has_table_privilege('authenticated', 'public.quote_items', 'UPDATE'), 'Quote lines cannot be edited through direct SQL');
select ok(not has_table_privilege('authenticated', 'public.crm_activities', 'INSERT'), 'CRM history is append-only through trusted operations');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e001","role":"authenticated"}', true);
select lives_ok($$select public.create_organization('crm-created-org', 'CRM Created SL', 'CRM Created', null, 'owner@created.test')$$, 'Authenticated member can onboard an organization');
select is((select count(*)::int from public.organizations where slug = 'crm-created-org'), 1, 'New organization is visible to its creator');
select is((select role::text from public.organization_memberships m join public.organizations o on o.id = m.organization_id where o.slug = 'crm-created-org' and m.user_id = (select auth.uid())), 'owner', 'Organization creator receives the only owner role');
select is((select count(*)::int from public.crm_activities where organization_id = (select id from public.organizations where slug = 'crm-created-org') and event_key = 'organization_created'), 1, 'Organization onboarding creates a persistent CRM history event');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e003","role":"authenticated"}', true);
select lives_ok($$insert into pg_temp.crm_b2b_test_state (quote_id)
  select public.create_business_quote(
    '00000000-0000-4000-8000-00000000f001',
    'Renovación de equipos para el equipo técnico.',
    jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'NOD-FS-02'), 'quantity', 2))
  )$$, 'An organization buyer can submit a product quote request');
update pg_temp.crm_b2b_test_state s set quote_item_id = qi.id
from public.quote_items qi where qi.quote_id = s.quote_id;
select is((select status::text from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), 'requested', 'New business quote starts in requested state');
select is((select currency from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), 'EUR', 'Quote currency is copied from the requested catalog product');
select is((select product_name from public.quote_items where quote_id = (select quote_id from pg_temp.crm_b2b_test_state)), (select p.name from public.products p join public.product_variants v on v.product_id = p.id where v.sku = 'NOD-FS-02'), 'Quote stores the product name snapshot');
select is((select product_sku from public.quote_items where quote_id = (select quote_id from pg_temp.crm_b2b_test_state)), 'NOD-FS-02', 'Quote stores the variant SKU snapshot');
select is((select requested_unit_price from public.quote_items where quote_id = (select quote_id from pg_temp.crm_b2b_test_state)), (select current_price from public.product_variants where sku = 'NOD-FS-02'), 'Quote stores the catalog price snapshot');
select is((select currency from public.quote_items where quote_id = (select quote_id from pg_temp.crm_b2b_test_state)), 'EUR', 'Quote line currency matches the header');
select is((select grand_total from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), (select sum(line_total) from public.quote_items where quote_id = (select quote_id from pg_temp.crm_b2b_test_state)), 'Requested quote totals reconcile with immutable line snapshots');
select is((select count(*)::int from public.crm_activities where quote_id = (select quote_id from pg_temp.crm_b2b_test_state) and event_key = 'quote_requested'), 1, 'Quote creation is written to CRM activity history');
select throws_ok($$select public.create_business_quote('00000000-0000-4000-8000-00000000f002', '', jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'NOD-FS-02'), 'quantity', 1)))$$, '42501', null, 'A member from another tenant cannot create a quote for this organization');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e004","role":"authenticated"}', true);
select throws_ok($$select public.create_business_quote('00000000-0000-4000-8000-00000000f001', '', jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'NOD-FS-02'), 'quantity', 1)))$$, '42501', null, 'A viewer cannot request quotes');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e003","role":"authenticated"}', true);
select throws_ok($$update public.organization_memberships set role = 'owner' where organization_id = '00000000-0000-4000-8000-00000000f001' and user_id = '00000000-0000-4000-8000-00000000e003'$$, '42501', null, 'A buyer cannot promote themselves through table access');
select throws_ok($$insert into public.crm_activities (organization_id, event_key, title) values ('00000000-0000-4000-8000-00000000f001', 'forged', 'Forged event')$$, '42501', null, 'A tenant cannot forge CRM activity history');
select is((select count(*)::int from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), 1, 'Quote is visible inside its organization');
select is((select count(*)::int from public.crm_activities where quote_id = (select quote_id from pg_temp.crm_b2b_test_state) and visibility = 'organization'), 1, 'Organization sees the customer-facing quote activity');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e002","role":"authenticated"}', true);
select lives_ok($$select public.add_organization_member('00000000-0000-4000-8000-00000000f001', 'crm-new-member@nodria.test', 'buyer')$$, 'Organization admin can add a buyer');
select is((select role::text from public.organization_memberships where organization_id = '00000000-0000-4000-8000-00000000f001' and user_id = '00000000-0000-4000-8000-00000000e008'), 'buyer', 'Member role is stored by the server RPC');
select throws_ok($$select public.add_organization_member('00000000-0000-4000-8000-00000000f001', 'crm-new-member@nodria.test', 'admin')$$, '42501', null, 'An organization admin cannot grant the admin role');
select throws_ok($$select public.add_organization_member('00000000-0000-4000-8000-00000000f001', 'crm-new-member@nodria.test', 'owner')$$, '22023', null, 'No member can assign a second owner');
select throws_ok($$select public.remove_organization_member('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000e001')$$, '42501', null, 'An organization admin cannot remove the owner');
select is((select count(*)::int from public.quotes where organization_id = '00000000-0000-4000-8000-00000000f002'), 0, 'Tenant A cannot read Tenant B quotes');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e005","role":"authenticated"}', true);
select is((select count(*)::int from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), 0, 'Tenant B cannot read Tenant A quotes');
select is((select count(*)::int from public.quote_items where quote_id = (select quote_id from pg_temp.crm_b2b_test_state)), 0, 'Tenant B cannot read Tenant A quote lines');
select is((select count(*)::int from public.crm_activities where quote_id = (select quote_id from pg_temp.crm_b2b_test_state)), 0, 'Tenant B cannot read Tenant A quote history');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e006', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e006","role":"authenticated"}', true);
select is((select count(*)::int from public.organizations), 0, 'Sales manager cannot enumerate tenant organizations');
select is((select count(*)::int from public.organization_memberships), 0, 'Sales manager cannot enumerate tenant memberships');
select is((select count(*)::int from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), 1, 'Sales manager can work the unassigned quote queue');
select lives_ok($$select public.claim_business_quote((select quote_id from pg_temp.crm_b2b_test_state))$$, 'Sales manager can claim an unassigned quote');
select is((select status::text from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), 'in_review', 'Claim moves quote into review');
select is((select sales_owner_id from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), (select auth.uid()), 'Claim binds the sales owner to the authenticated actor');
select throws_ok($$update public.quotes set status = 'sent' where id = (select quote_id from pg_temp.crm_b2b_test_state)$$, '42501', null, 'Sales cannot bypass quote transition RPCs');
select lives_ok($$select public.send_business_quote(
  (select quote_id from pg_temp.crm_b2b_test_state),
  jsonb_build_array(jsonb_build_object('item_id', (select quote_item_id from pg_temp.crm_b2b_test_state), 'unit_price', 108.25)),
  pg_catalog.now() + interval '14 days'
)$$, 'Assigned salesperson can send a quote with a valid offer');
select is((select status::text from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), 'sent', 'Sales RPC moves a reviewed quote to sent');
select is((select offered_unit_price from public.quote_items where id = (select quote_item_id from pg_temp.crm_b2b_test_state)), 108.25::numeric, 'Offered price is persisted against the line snapshot');
select is((select grand_total from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), (select sum(line_total) from public.quote_items where quote_id = (select quote_id from pg_temp.crm_b2b_test_state)), 'Sent quote totals reconcile with offered prices');
select is((select count(*)::int from public.crm_activities where quote_id = (select quote_id from pg_temp.crm_b2b_test_state) and event_key in ('quote_in_review', 'quote_sent')), 2, 'Claim and send transitions create audit history');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e007', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e007","role":"authenticated"}', true);
select is((select count(*)::int from public.quotes where id = (select quote_id from pg_temp.crm_b2b_test_state)), 0, 'Sales manager cannot read a quote assigned to another salesperson');
select throws_ok($$select public.claim_business_quote((select quote_id from pg_temp.crm_b2b_test_state))$$, '23514', null, 'A second salesperson cannot claim an already assigned quote');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e003","role":"authenticated"}', true);
select throws_ok($$select public.respond_to_business_quote((select quote_id from pg_temp.crm_b2b_test_state), 'accepted')$$, '42501', null, 'A buyer cannot accept the organization quote');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e002","role":"authenticated"}', true);
select is(public.respond_to_business_quote((select quote_id from pg_temp.crm_b2b_test_state), 'accepted')::text, 'accepted', 'Organization admin can accept a sent quote');
select is((select count(*)::int from public.crm_activities where quote_id = (select quote_id from pg_temp.crm_b2b_test_state) and event_key = 'quote_accepted'), 1, 'Customer decision is recorded in the quote history');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e006', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e006","role":"authenticated"}', true);
select lives_ok($$select public.update_quote_inquiry_status((select id from public.quote_inquiries where source = 'crm-b2b-test'), 'qualified')$$, 'Sales manager can advance an inquiry through the CRM RPC');
select is((select status::text from public.quote_inquiries where source = 'crm-b2b-test'), 'qualified', 'Inquiry stage persists');
select is((select count(*)::int from public.crm_activities where quote_inquiry_id = (select id from public.quote_inquiries where source = 'crm-b2b-test') and event_key = 'inquiry_status_changed'), 1, 'Inquiry status change is written to CRM history');
select throws_ok($$select public.update_quote_inquiry_status((select id from public.quote_inquiries where source = 'crm-b2b-test'), 'new')$$, '23514', null, 'CRM inquiry transitions cannot move backward arbitrarily');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e009', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e009","role":"authenticated"}', true);
select is((select count(*)::int from public.organizations), 3, 'Super admin retains support visibility across all organizations');
select is((select count(*)::int from public.organization_memberships), 7, 'Super admin can audit all organization memberships');

select * from finish();
rollback;
