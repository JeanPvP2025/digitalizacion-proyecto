-- Verified product reviews: one review per delivered order line, published only after moderation.
do $$ begin
  create type public.product_review_status as enum ('pending', 'published', 'rejected');
exception when duplicate_object then null; end $$;

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 20 and 2000),
  status public.product_review_status not null default 'pending',
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 1000),
  moderated_by uuid references auth.users(id) on delete restrict,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_item_id),
  unique (author_id, product_id),
  check (
    (status = 'pending' and moderated_by is null and moderated_at is null)
    or (status in ('published', 'rejected') and moderated_by is not null and moderated_at is not null)
  )
);

create index product_reviews_public_product_idx
  on public.product_reviews (product_id, created_at desc)
  where status = 'published';
create index product_reviews_pending_idx
  on public.product_reviews (created_at desc)
  where status = 'pending';
create index product_reviews_author_idx on public.product_reviews (author_id, product_id);

create or replace function private.set_product_review_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := (select auth.uid());
    new.status := 'pending';
    new.moderation_note := null;
    new.moderated_by := null;
    new.moderated_at := null;
    return new;
  end if;

  if old.status <> 'pending' or new.status not in ('published', 'rejected') then
    raise exception using errcode = '23514', message = 'A product review can only be moderated once from pending';
  end if;

  new.product_id := old.product_id;
  new.order_item_id := old.order_item_id;
  new.author_id := old.author_id;
  new.rating := old.rating;
  new.title := old.title;
  new.body := old.body;
  new.created_at := old.created_at;
  new.moderated_by := (select auth.uid());
  new.moderated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_product_review_actor() from public;

drop trigger if exists product_reviews_set_actor on public.product_reviews;
create trigger product_reviews_set_actor
  before insert or update on public.product_reviews
  for each row execute function private.set_product_review_actor();

-- This narrow SECURITY DEFINER RPC only returns the caller's reviewed purchase-line IDs.
-- Purchase references and reviewer IDs are intentionally not selectable through the Data API.
create or replace function public.my_reviewed_order_items(p_product_id text)
returns table(order_item_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select reviews.order_item_id
  from public.product_reviews as reviews
  where (select auth.uid()) is not null
    and reviews.author_id = (select auth.uid())
    and reviews.product_id = p_product_id;
$$;

revoke all on function public.my_reviewed_order_items(text) from public, anon, service_role;
grant execute on function public.my_reviewed_order_items(text) to authenticated;

alter table public.product_reviews enable row level security;

create policy product_reviews_public_read on public.product_reviews
  for select to anon, authenticated
  using (status = 'published');

create policy product_reviews_author_read on public.product_reviews
  for select to authenticated
  using (author_id = (select auth.uid()));

create policy product_reviews_moderator_read on public.product_reviews
  for select to authenticated
  using ((select private.has_any_staff_role(array['super_admin']::public.app_role[])));

create policy product_reviews_verified_purchase_insert on public.product_reviews
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'pending'
    and moderated_by is null
    and moderated_at is null
    and exists (
      select 1
      from public.order_items as items
      join public.orders as orders on orders.id = items.order_id
      join public.products as products on products.id = items.product_id
      where items.id = order_item_id
        and items.product_id = product_reviews.product_id
        and orders.customer_id = (select auth.uid())
        and orders.status = 'delivered'
        and products.is_published
    )
  );

create policy product_reviews_moderator_update on public.product_reviews
  for update to authenticated
  using ((select private.has_any_staff_role(array['super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['super_admin']::public.app_role[])));

revoke all on public.product_reviews from anon, authenticated, service_role;
grant select (id, product_id, rating, title, body, status, created_at)
  on public.product_reviews to anon;
grant select (id, product_id, rating, title, body, status, created_at)
  on public.product_reviews to authenticated;
grant insert (product_id, order_item_id, rating, title, body)
  on public.product_reviews to authenticated;
grant update (status, moderation_note)
  on public.product_reviews to authenticated;
