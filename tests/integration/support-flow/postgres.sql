\set ON_ERROR_STOP on

-- PostgreSQL runtime gate for agent ticket operations and RMA review.
-- Fixtures and state transitions roll back when the file completes.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-00000000a201', 'authenticated', 'authenticated', 'support-flow-customer-a@nodria.test', '', '{}', '{}'),
  ('10000000-0000-4000-8000-00000000a202', 'authenticated', 'authenticated', 'support-flow-customer-b@nodria.test', '', '{}', '{}'),
  ('10000000-0000-4000-8000-00000000a203', 'authenticated', 'authenticated', 'support-flow-agent@nodria.test', '', '{}', '{}');

insert into public.user_role_grants (user_id, role, granted_by)
values ('10000000-0000-4000-8000-00000000a203', 'support_agent', '10000000-0000-4000-8000-00000000a203');

insert into public.orders (
  id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency,
  subtotal, tax_total, shipping_total, discount_total, grand_total,
  shipping_address, billing_address, delivered_at
)
values (
  '10000000-0000-4000-8000-00000000b201', 'NDR-SF-000001', '10000000-0000-4000-8000-00000000a201',
  'support-flow-order-1', repeat(md5('support-flow-order-1'), 2), 'delivered', 'EUR',
  200, 0, 0, 0, 200, '{}', '{}', now() - interval '5 days'
);

insert into public.order_items (id, order_id, product_name, product_sku, variant_title, quantity, unit_price, currency)
values ('10000000-0000-4000-8000-00000000c201', '10000000-0000-4000-8000-00000000b201', 'Portátil QA', 'QA-SF-1', '16 GB', 2, 100, 'EUR');

do $$
begin
  if has_table_privilege('authenticated', 'public.support_tickets', 'INSERT')
     or has_table_privilege('authenticated', 'public.support_tickets', 'UPDATE')
     or has_table_privilege('authenticated', 'public.support_messages', 'INSERT')
     or has_table_privilege('authenticated', 'public.support_messages', 'UPDATE')
     or has_table_privilege('authenticated', 'public.return_requests', 'INSERT') then
    raise exception 'Support and RMA transitions must not be writable through direct table DML';
  end if;
  if not has_table_privilege('authenticated', 'public.return_requests', 'UPDATE') then
    raise exception 'Existing fulfillment update permission was removed';
  end if;
  if has_function_privilege('anon', 'public.send_support_message(uuid,text,public.ticket_status,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.review_return_request(uuid,public.return_status,text,uuid)', 'EXECUTE') then
    raise exception 'Anonymous users must not invoke support or RMA transitions';
  end if;
end;
$$;

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a201';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a201","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_ticket_id uuid;
  v_retry_ticket_id uuid;
  v_legacy_ticket_id uuid;
  v_legacy_retry_id uuid;
  v_message_id uuid;
  v_retry_id uuid;
  v_return_one uuid;
  v_return_two uuid;
  v_count integer;
begin
  select ticket_id into v_ticket_id
    from public.create_support_ticket(
      'Ayuda con el portátil QA',
      'El portátil se reinicia al abrir la aplicación de diagnóstico.',
      '10000000-0000-4000-8000-00000000b201',
      null,
      '10000000-0000-4000-8000-00000000e200'
    );
  select ticket_id into v_retry_ticket_id
    from public.create_support_ticket(
      'Ayuda con el portátil QA',
      'El portátil se reinicia al abrir la aplicación de diagnóstico.',
      '10000000-0000-4000-8000-00000000b201',
      null,
      '10000000-0000-4000-8000-00000000e200'
    );
  if v_ticket_id <> v_retry_ticket_id then raise exception 'Support intake retry created a different ticket'; end if;
  select ticket_id into v_legacy_ticket_id
    from public.create_support_ticket(
      'Consulta de compatibilidad legacy',
      'Necesito confirmar si este accesorio sirve con mi equipo actual.',
      null,
      null
    );
  select ticket_id into v_legacy_retry_id
    from public.create_support_ticket(
      'Consulta de compatibilidad legacy',
      'Necesito confirmar si este accesorio sirve con mi equipo actual.',
      null,
      null
    );
  if v_legacy_ticket_id <> v_legacy_retry_id then raise exception 'Legacy support intake retry created a duplicate ticket'; end if;
  begin
    perform * from public.create_support_ticket(
      'Ayuda con el portátil QA',
      'El texto cambió con la misma clave de intake.',
      '10000000-0000-4000-8000-00000000b201',
      null,
      '10000000-0000-4000-8000-00000000e200'
    );
    raise exception 'Support intake accepted a different payload for a used key';
  exception when invalid_parameter_value then null;
  end;
  select count(*) into v_count from public.support_messages where ticket_id = v_ticket_id and author_id = auth.uid() and not is_internal;
  if v_count <> 1 then raise exception 'The ticket and initial customer message were not created atomically'; end if;
  select count(*) into v_count from public.support_ticket_events where ticket_id = v_ticket_id and event_type = 'created' and to_status = 'open';
  if v_count <> 1 then raise exception 'The ticket creation event is missing'; end if;

  select message_id into v_message_id from public.send_support_message(
    v_ticket_id, 'He actualizado el sistema y sigue ocurriendo el mismo reinicio.', null::public.ticket_status,
    '10000000-0000-4000-8000-00000000e201'
  );
  select message_id into v_retry_id from public.send_support_message(
    v_ticket_id, 'He actualizado el sistema y sigue ocurriendo el mismo reinicio.', null::public.ticket_status,
    '10000000-0000-4000-8000-00000000e201'
  );
  if v_message_id <> v_retry_id then raise exception 'Retry returned a different support message'; end if;

  begin
    perform * from public.send_support_message(
      v_ticket_id, 'El contenido cambió con la misma clave de idempotencia.', null::public.ticket_status,
      '10000000-0000-4000-8000-00000000e201'
    );
    raise exception 'A reused message key accepted a different payload';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform * from public.send_support_message(
      v_ticket_id, 'El cliente no puede resolver directamente su ticket.', 'resolved',
      '10000000-0000-4000-8000-00000000e202'
    );
    raise exception 'A customer changed ticket status';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.review_return_request(
      '10000000-0000-4000-8000-00000000f201', 'approved', '', '10000000-0000-4000-8000-00000000e203'
    );
    raise exception 'A customer reviewed a return';
  exception when insufficient_privilege then null;
  end;

  select count(*) into v_count from public.support_tickets where id = v_ticket_id;
  if v_count <> 1 then raise exception 'Ticket owner could not read their ticket'; end if;

  v_return_one := public.request_return(
    '10000000-0000-4000-8000-00000000b201',
    'El producto tiene una incidencia de reinicio.',
    jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c201', 'quantity', 1)),
    '10000000-0000-4000-8000-00000000e204'
  );
  v_return_two := public.request_return(
    '10000000-0000-4000-8000-00000000b201',
    'La segunda unidad presenta la misma incidencia.',
    jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c201', 'quantity', 1)),
    '10000000-0000-4000-8000-00000000e205'
  );
  begin
    perform public.request_return(
      '10000000-0000-4000-8000-00000000b201',
      'Una tercera unidad no forma parte de la compra.',
      jsonb_build_array(jsonb_build_object('order_item_id', '10000000-0000-4000-8000-00000000c201', 'quantity', 1)),
      '10000000-0000-4000-8000-00000000e206'
    );
    raise exception 'Return intake exceeded the purchased quantity';
  exception when check_violation then null;
  end;

  select count(*) into v_count from public.return_request_events where return_request_id in (v_return_one, v_return_two) and event_type = 'requested';
  if v_count <> 2 then raise exception 'Return request timeline does not contain both intake events'; end if;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a202';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a202","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_ticket_id uuid;
  v_count integer;
begin
  select id into v_ticket_id from public.support_tickets where subject = 'Ayuda con el portátil QA';
  select count(*) into v_count from public.support_tickets where id = v_ticket_id;
  if v_count <> 0 then raise exception 'A different customer read a private ticket'; end if;

  begin
    perform * from public.send_support_message(
      v_ticket_id, 'Otra cuenta no debe responder a este ticket.', null::public.ticket_status,
      '10000000-0000-4000-8000-00000000e207'
    );
    raise exception 'A different customer replied to another account ticket';
  exception when no_data_found then null;
  end;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a203';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a203","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_ticket_id uuid;
  v_message_id uuid;
  v_retry_id uuid;
  v_return_one uuid;
  v_return_two uuid;
  v_status public.ticket_status;
  v_return_status public.return_status;
  v_count integer;
begin
  select id into v_ticket_id from public.support_tickets where subject = 'Ayuda con el portátil QA';
  select message_id, ticket_status into v_message_id, v_status from public.send_support_message(
    v_ticket_id, 'Vamos a revisar la instalación. Envíanos el resultado del diagnóstico.', 'waiting_customer',
    '10000000-0000-4000-8000-00000000e208'
  );
  select message_id, ticket_status into v_retry_id, v_status from public.send_support_message(
    v_ticket_id, 'Vamos a revisar la instalación. Envíanos el resultado del diagnóstico.', 'waiting_customer',
    '10000000-0000-4000-8000-00000000e208'
  );
  if v_message_id <> v_retry_id or v_status <> 'waiting_customer' then raise exception 'Agent message retry or transition was not idempotent'; end if;
  if not exists (select 1 from public.support_messages where id = v_message_id and author_type = 'agent') then
    raise exception 'Agent response was not identified in the conversation history';
  end if;

  perform * from public.send_support_message(
    v_ticket_id, 'Hemos validado el caso y la solución está aplicada.', 'resolved',
    '10000000-0000-4000-8000-00000000e209'
  );
  perform * from public.send_support_message(
    v_ticket_id, 'Cierro el ticket tras confirmar la resolución.', 'closed',
    '10000000-0000-4000-8000-00000000e210'
  );
  select status into v_status from public.support_tickets where id = v_ticket_id;
  if v_status <> 'closed' then raise exception 'Agent could not resolve and close the ticket'; end if;
  select count(*) into v_count from public.support_ticket_events where ticket_id = v_ticket_id and event_type = 'status_changed';
  if v_count <> 3 then raise exception 'Ticket status timeline did not record each transition exactly once'; end if;

  select id into v_return_one from public.return_requests where idempotency_key = '10000000-0000-4000-8000-00000000e204';
  select id into v_return_two from public.return_requests where idempotency_key = '10000000-0000-4000-8000-00000000e205';
  select return_status into v_return_status from public.review_return_request(
    v_return_one, 'approved', 'Se aprueba tras revisar la incidencia y la cantidad solicitada.',
    '10000000-0000-4000-8000-00000000e211'
  );
  if v_return_status <> 'approved' then raise exception 'Support agent could not approve the requested return'; end if;
  select return_status into v_return_status from public.review_return_request(
    v_return_one, 'approved', 'Se aprueba tras revisar la incidencia y la cantidad solicitada.',
    '10000000-0000-4000-8000-00000000e211'
  );
  if v_return_status <> 'approved' then raise exception 'Return decision retry did not return the original result'; end if;

  begin
    perform * from public.review_return_request(
      v_return_one, 'rejected', 'Cambio de decisión con una clave ya usada.',
      '10000000-0000-4000-8000-00000000e211'
    );
    raise exception 'A reused review key accepted a different decision';
  exception when invalid_parameter_value then null;
  end;

  select return_status into v_return_status from public.review_return_request(
    v_return_two, 'rejected', 'La evidencia aportada no confirma el defecto descrito.',
    '10000000-0000-4000-8000-00000000e212'
  );
  if v_return_status <> 'rejected' then raise exception 'Support agent could not reject a return with a reason'; end if;

  select count(*) into v_count from public.return_request_events
    where return_request_id in (v_return_one, v_return_two) and event_type = 'status_changed';
  if v_count <> 2 then raise exception 'Return decision timeline contains missing or duplicate review events'; end if;
  if not exists (
    select 1 from public.return_requests
    where id = v_return_one and reviewed_by = auth.uid() and reviewed_at is not null
      and decision_reason = 'Se aprueba tras revisar la incidencia y la cantidad solicitada.'
  ) then raise exception 'The approved decision actor, timestamp, and note were not persisted'; end if;
end;
$$;

reset role;
rollback;
