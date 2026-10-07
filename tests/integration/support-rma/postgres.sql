\set ON_ERROR_STOP on

-- PostgreSQL runtime gate for atomic support intake and idempotent RMA.
-- All fixtures and temporary trigger changes roll back at the end.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-00000000a101', 'authenticated', 'authenticated', 'support-rma-a@nodria.test', '', '{}', '{}'),
  ('10000000-0000-4000-8000-00000000a102', 'authenticated', 'authenticated', 'support-rma-b@nodria.test', '', '{}', '{}');

insert into public.organizations (id, slug, legal_name, display_name, created_by)
values
  ('10000000-0000-4000-8000-00000000d101', 'support-rma-org-a', 'Support RMA A SL', 'Support RMA A', '10000000-0000-4000-8000-00000000a101'),
  ('10000000-0000-4000-8000-00000000d102', 'support-rma-org-b', 'Support RMA B SL', 'Support RMA B', '10000000-0000-4000-8000-00000000a102');

insert into public.organization_memberships (organization_id, user_id, role, added_by)
values
  ('10000000-0000-4000-8000-00000000d101', '10000000-0000-4000-8000-00000000a101', 'owner', '10000000-0000-4000-8000-00000000a101'),
  ('10000000-0000-4000-8000-00000000d102', '10000000-0000-4000-8000-00000000a102', 'owner', '10000000-0000-4000-8000-00000000a102');

insert into public.orders (
  id, order_number, customer_id, idempotency_key, checkout_fingerprint, organization_id, status, currency,
  subtotal, tax_total, shipping_total, discount_total, grand_total,
  shipping_address, billing_address, delivered_at
)
values
  ('10000000-0000-4000-8000-00000000b101', 'NDR-SR-000001', '10000000-0000-4000-8000-00000000a101', 'support-rma-order-a1', repeat(md5('NDR-SR-000001'), 2), null, 'delivered', 'EUR', 200, 0, 0, 0, 200, '{}', '{}', now() - interval '10 days'),
  ('10000000-0000-4000-8000-00000000b102', 'NDR-SR-000002', '10000000-0000-4000-8000-00000000a101', 'support-rma-order-a2', repeat(md5('NDR-SR-000002'), 2), null, 'delivered', 'EUR', 100, 0, 0, 0, 100, '{}', '{}', now() - interval '31 days'),
  ('10000000-0000-4000-8000-00000000b103', 'NDR-SR-000003', '10000000-0000-4000-8000-00000000a101', 'support-rma-order-a3', repeat(md5('NDR-SR-000003'), 2), '10000000-0000-4000-8000-00000000d101', 'delivered', 'EUR', 100, 0, 0, 0, 100, '{}', '{}', now() - interval '3 days');

insert into public.order_items (id, order_id, product_name, product_sku, variant_title, quantity, unit_price, currency)
values
  ('10000000-0000-4000-8000-00000000c101', '10000000-0000-4000-8000-00000000b101', 'Portátil de prueba', 'QA-SR-1', '16 GB', 2, 100, 'EUR'),
  ('10000000-0000-4000-8000-00000000c102', '10000000-0000-4000-8000-00000000b102', 'Monitor de prueba', 'QA-SR-2', '27 pulgadas', 1, 100, 'EUR'),
  ('10000000-0000-4000-8000-00000000c103', '10000000-0000-4000-8000-00000000b103', 'Ratón de prueba', 'QA-SR-3', 'Estándar', 1, 100, 'EUR');

do $$
begin
  if has_table_privilege('authenticated', 'public.support_tickets', 'INSERT') then
    raise exception 'Authenticated users must use the atomic support RPC, not direct ticket inserts';
  end if;
  if has_function_privilege('anon', 'public.create_support_ticket(text,text,uuid,uuid)', 'EXECUTE') then
    raise exception 'Anonymous users must not be able to create connected support tickets';
  end if;
end;
$$;

create or replace function private.qa_reject_support_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'QA forced initial-message failure';
end;
$$;

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a101';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a101","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_ticket_id uuid;
  v_count integer;
  v_return_id uuid;
  v_retry_id uuid;
  v_legacy_return_id uuid;
  v_legacy_retry_id uuid;
begin
  select ticket_id into v_ticket_id
    from public.create_support_ticket(
      'Consulta de pedido empresarial',
      'Necesito ayuda con la entrega del equipo que compró nuestra organización.',
      '10000000-0000-4000-8000-00000000b103',
      '10000000-0000-4000-8000-00000000d101'
    );
  select count(*) into v_count from public.support_tickets where id = v_ticket_id;
  if v_count <> 1 then raise exception 'Atomic support RPC did not create its ticket'; end if;
  select count(*) into v_count from public.support_messages where ticket_id = v_ticket_id and author_id = auth.uid() and not is_internal;
  if v_count <> 1 then raise exception 'Atomic support RPC did not create exactly one public first message'; end if;

  begin
    perform * from public.create_support_ticket(
      'Organización de otra cuenta',
      'Esta solicitud no debe asociarse a una organización ajena al usuario.',
      null,
      '10000000-0000-4000-8000-00000000d102'
    );
    raise exception 'Cross-tenant organization ticket was accepted';
  exception when sqlstate 'P0002' then
    null;
  end;

  begin
    perform * from public.create_support_ticket(
      'Pedido de otra empresa',
      'Este pedido no debe asociarse a una organización diferente de su tenant.',
      '10000000-0000-4000-8000-00000000b103',
      null
    );
    raise exception 'Mismatched order organization was accepted';
  exception when sqlstate 'P0002' then
    null;
  end;

  begin
    v_return_id := public.request_return(
      '10000000-0000-4000-8000-00000000b101',
      'No encaja con mi configuración actual.',
      jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c101', 'quantity', 1)),
      '10000000-0000-4000-8000-00000000e101'
    );
    v_retry_id := public.request_return(
      '10000000-0000-4000-8000-00000000b101',
      'No encaja con mi configuración actual.',
      jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c101', 'quantity', 1)),
      '10000000-0000-4000-8000-00000000e101'
    );
    if v_return_id <> v_retry_id then raise exception 'RMA retry did not return the original request'; end if;

    begin
      perform public.request_return(
        '10000000-0000-4000-8000-00000000b101',
        'El motivo cambió para la misma clave.',
        jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c101', 'quantity', 1)),
        '10000000-0000-4000-8000-00000000e101'
      );
      raise exception 'RMA idempotency key accepted a different payload';
    exception when invalid_parameter_value then
      null;
    end;

    perform public.request_return(
      '10000000-0000-4000-8000-00000000b101',
      'Segundo lote de unidades para devolución.',
      jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c101', 'quantity', 1)),
      '10000000-0000-4000-8000-00000000e102'
    );
    begin
      perform public.request_return(
        '10000000-0000-4000-8000-00000000b101',
        'La unidad adicional supera la compra.',
        jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c101', 'quantity', 1)),
        '10000000-0000-4000-8000-00000000e103'
      );
      raise exception 'RMA quantity above the purchased total was accepted';
    exception when check_violation then
      null;
    end;

    select count(*) into v_count from public.return_requests where order_id = '10000000-0000-4000-8000-00000000b101';
    if v_count <> 2 then raise exception 'An RMA retry or failed quantity check left an extra request'; end if;
    select coalesce(sum(ri.quantity), 0)::integer into v_count
      from public.return_items ri
      join public.return_requests rr on rr.id = ri.return_request_id
      where rr.order_id = '10000000-0000-4000-8000-00000000b101';
    if v_count <> 2 then raise exception 'Accumulated RMA units do not match the order quantity'; end if;

    begin
      perform public.request_return(
        '10000000-0000-4000-8000-00000000b102',
        'Este pedido fue entregado hace más de treinta días.',
        jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c102', 'quantity', 1)),
        '10000000-0000-4000-8000-00000000e104'
      );
      raise exception 'RMA outside 30 days from delivery was accepted';
    exception when check_violation then
      null;
    end;

    begin
      v_legacy_return_id := public.request_return(
        '10000000-0000-4000-8000-00000000b103',
        'El ratón de la empresa presenta una incidencia.',
        jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c103', 'quantity', 1))
      );
      v_legacy_retry_id := public.request_return(
        '10000000-0000-4000-8000-00000000b103',
        'El ratón de la empresa presenta una incidencia.',
        jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c103', 'quantity', 1))
      );
      if v_legacy_return_id <> v_legacy_retry_id then raise exception 'Legacy RMA retry did not return the original request'; end if;
    exception when others then
      raise exception 'Current organization member could not return own delivered organization order: %', sqlerrm;
    end;
  end;
end;
$$;

reset role;
create trigger qa_reject_support_message
before insert on public.support_messages
for each row execute function private.qa_reject_support_message();
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a101';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a101","role":"authenticated"}';
set local role authenticated;
do $$
declare
  v_count integer;
begin
  begin
    perform * from public.create_support_ticket(
      'Mensaje inicial fallido',
      'El trigger de prueba debe forzar que falle el mensaje inicial.',
      null,
      null
    );
    raise exception 'Support ticket creation unexpectedly succeeded with a failing message trigger';
  exception when check_violation then
    null;
  end;
  select count(*) into v_count from public.support_tickets where subject = 'Mensaje inicial fallido' and customer_id = auth.uid();
  if v_count <> 0 then raise exception 'Ticket remained after its initial message failed'; end if;
end;
$$;
reset role;
drop trigger qa_reject_support_message on public.support_messages;
drop function private.qa_reject_support_message();

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a102';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a102","role":"authenticated"}';
set local role authenticated;
do $$
begin
  begin
    perform public.request_return(
      '10000000-0000-4000-8000-00000000b101',
      'Otra cuenta no puede devolver este pedido.',
      jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c101', 'quantity', 1)),
      '10000000-0000-4000-8000-00000000e106'
    );
    raise exception 'A different customer requested a return for this order';
  exception when no_data_found then
    null;
  end;
end;
$$;
reset role;

rollback;
