-- Reviews are tied to delivered order lines and remain private until authorized moderation.
create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(23);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-4000-8000-00000000e101', 'authenticated', 'authenticated', 'review-buyer-a@nodria.test', '', '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-00000000e102', 'authenticated', 'authenticated', 'review-buyer-b@nodria.test', '', '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-00000000e103', 'authenticated', 'authenticated', 'review-moderator@nodria.test', '', '{}', '{}', now(), now());

insert into public.user_role_grants (user_id, role)
values ('10000000-0000-4000-8000-00000000e103', 'super_admin');

insert into public.products (id, slug, sku, name, brand, is_published, published_at)
values
  ('review-product-qa', 'review-product-qa', 'REVIEW-QA-1', 'Producto de reseñas QA', 'NODRIA QA', true, now()),
  ('review-other-qa', 'review-other-qa', 'REVIEW-QA-2', 'Otro producto QA', 'NODRIA QA', true, now());

insert into public.orders (
  id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency,
  subtotal, tax_total, shipping_total, discount_total, grand_total,
  shipping_address, billing_address, delivered_at
)
values
  ('10000000-0000-4000-8000-00000000b201', 'NDR-REV-0001', '10000000-0000-4000-8000-00000000e101', 'review-order-a1', repeat(md5('review-order-a1'), 2), 'delivered', 'EUR', 100, 0, 0, 0, 100, '{}', '{}', now()),
  ('10000000-0000-4000-8000-00000000b202', 'NDR-REV-0002', '10000000-0000-4000-8000-00000000e101', 'review-order-a2', repeat(md5('review-order-a2'), 2), 'shipped', 'EUR', 100, 0, 0, 0, 100, '{}', '{}', null),
  ('10000000-0000-4000-8000-00000000b203', 'NDR-REV-0003', '10000000-0000-4000-8000-00000000e102', 'review-order-b1', repeat(md5('review-order-b1'), 2), 'delivered', 'EUR', 100, 0, 0, 0, 100, '{}', '{}', now());

insert into public.order_items (id, order_id, product_id, product_name, product_sku, quantity, unit_price, currency)
values
  ('10000000-0000-4000-8000-00000000c201', '10000000-0000-4000-8000-00000000b201', 'review-product-qa', 'Producto de reseñas QA', 'REVIEW-QA-1', 1, 100, 'EUR'),
  ('10000000-0000-4000-8000-00000000c204', '10000000-0000-4000-8000-00000000b201', 'review-product-qa', 'Producto de reseñas QA', 'REVIEW-QA-1', 1, 100, 'EUR'),
  ('10000000-0000-4000-8000-00000000c202', '10000000-0000-4000-8000-00000000b202', 'review-product-qa', 'Producto de reseñas QA', 'REVIEW-QA-1', 1, 100, 'EUR'),
  ('10000000-0000-4000-8000-00000000c203', '10000000-0000-4000-8000-00000000b203', 'review-product-qa', 'Producto de reseñas QA', 'REVIEW-QA-1', 1, 100, 'EUR');

select ok(
  has_column_privilege('anon', 'public.product_reviews', 'status', 'SELECT')
  and not has_column_privilege('anon', 'public.product_reviews', 'author_id', 'SELECT')
  and not has_column_privilege('anon', 'public.product_reviews', 'order_item_id', 'SELECT')
  and has_column_privilege('authenticated', 'public.product_reviews', 'order_item_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.product_reviews', 'author_id', 'INSERT'),
  'Data API grants expose public content but keep reviewer and purchase identifiers private'
);
select ok(
  has_function_privilege('authenticated', 'public.my_reviewed_order_items(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.my_reviewed_order_items(text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.my_reviewed_order_items(text)', 'EXECUTE'),
  'reviewed purchase-line RPC is only executable by authenticated customers'
);

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000e101';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000e101","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$insert into public.product_reviews (product_id, order_item_id, rating, title, body)
    values ('review-product-qa', '10000000-0000-4000-8000-00000000c201', 4, 'Funciona como esperaba', 'La compra llegó bien y el producto responde según sus especificaciones.')$$,
  'customer can submit a review for their delivered product'
);
reset role;
select is(
  (select author_id::text from public.product_reviews where order_item_id = '10000000-0000-4000-8000-00000000c201'),
  '10000000-0000-4000-8000-00000000e101',
  'database binds the review to the authenticated customer'
);

set local role authenticated;
select throws_ok(
  $$insert into public.product_reviews (product_id, order_item_id, rating, title, body)
    values ('review-product-qa', '10000000-0000-4000-8000-00000000c201', 5, 'Otra opinión válida', 'Este contenido intenta duplicar la reseña de compra.')$$,
  '23505', null, 'one delivered order line cannot receive duplicate reviews'
);
select throws_ok(
  $$insert into public.product_reviews (product_id, order_item_id, rating, title, body)
    values ('review-product-qa', '10000000-0000-4000-8000-00000000c204', 5, 'Otro pedido', 'Una segunda línea comprada tampoco permite reseñar dos veces el producto.')$$,
  '23505', null, 'customer cannot submit a second review for the same product from another purchase line'
);
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000e102';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000e102","role":"authenticated"}';
select throws_ok(
  $$insert into public.product_reviews (product_id, order_item_id, rating, title, body)
    values ('review-product-qa', '10000000-0000-4000-8000-00000000c201', 4, 'Compra ajena', 'El usuario B intenta reseñar la compra del usuario A.')$$,
  '42501', null, 'a customer cannot review another customer’s purchase'
);
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000e101';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000e101","role":"authenticated"}';
select throws_ok(
  $$insert into public.product_reviews (product_id, order_item_id, rating, title, body)
    values ('review-product-qa', '10000000-0000-4000-8000-00000000c202', 4, 'Compra no entregada', 'Solo se aceptan pedidos con estado de entrega confirmada.')$$,
  '42501', null, 'a customer cannot review an undelivered order'
);
select throws_ok(
  $$insert into public.product_reviews (product_id, order_item_id, rating, title, body)
    values ('review-other-qa', '10000000-0000-4000-8000-00000000c201', 4, 'Producto incorrecto', 'El producto de la opinión debe coincidir con la línea comprada.')$$,
  '42501', null, 'review product must match the purchased order line'
);
select throws_ok(
  $$insert into public.product_reviews (product_id, order_item_id, author_id, rating, title, body)
    values ('review-product-qa', '10000000-0000-4000-8000-00000000c203', '10000000-0000-4000-8000-00000000e101', 4, 'Identidad falsificada', 'No se permite elegir el usuario propietario de la reseña.')$$,
  '42501', null, 'customer cannot choose the review author'
);
select is(
  (select count(*)::integer from public.product_reviews where product_id = 'review-product-qa'),
  1,
  'author can read their own pending review'
);
select is(
  (select order_item_id::text from public.my_reviewed_order_items('review-product-qa') limit 1),
  '10000000-0000-4000-8000-00000000c201',
  'reviewer can discover only their reviewed order line'
);
select lives_ok(
  $$update public.product_reviews set status = 'published' where product_id = 'review-product-qa' and status = 'pending'$$,
  'customer moderation attempt is rejected by row security without changing the row'
);
reset role;
select is(
  (select status::text from public.product_reviews where order_item_id = '10000000-0000-4000-8000-00000000c201'),
  'pending',
  'customer cannot publish their own review'
);

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000e102';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000e102","role":"authenticated"}';
set local role authenticated;
select is(
  (select count(*)::integer from public.product_reviews where product_id = 'review-product-qa'),
  0,
  'another customer cannot read a pending review'
);
select is(
  (select count(*)::integer from public.my_reviewed_order_items('review-product-qa')),
  0,
  'reviewed purchase-line RPC does not disclose another customer’s purchases'
);
reset role;

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000e103';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000e103","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$update public.product_reviews set status = 'published', moderation_note = 'Aprobada tras revisión.' where product_id = 'review-product-qa' and status = 'pending'$$,
  'super admin can publish a pending review'
);
reset role;
select is(
  (select moderated_by::text from public.product_reviews where order_item_id = '10000000-0000-4000-8000-00000000c201'),
  '10000000-0000-4000-8000-00000000e103',
  'moderation actor is written from the authenticated role grant'
);
select ok(
  (select moderated_at is not null from public.product_reviews where order_item_id = '10000000-0000-4000-8000-00000000c201'),
  'moderation timestamp is set by the database'
);

set local role anon;
select is(
  (select count(*)::integer from public.product_reviews where product_id = 'review-product-qa' and status = 'published'),
  1,
  'anonymous storefront can read a published review'
);
select throws_ok(
  $$select order_item_id from public.product_reviews$$,
  '42501', null, 'anonymous users cannot read purchase-line identifiers'
);
select throws_ok(
  $$select moderation_note from public.product_reviews$$,
  '42501', null, 'anonymous users cannot read moderation notes'
);
reset role;

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000e103';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000e103","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$update public.product_reviews set status = 'rejected' where product_id = 'review-product-qa' and status = 'published'$$,
  '23514', null, 'a completed moderation decision cannot be silently changed'
);
reset role;

select * from finish();
rollback;
