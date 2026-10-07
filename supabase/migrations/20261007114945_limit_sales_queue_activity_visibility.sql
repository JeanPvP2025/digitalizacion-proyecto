-- Sales may process unassigned formal quote requests, but an organization-only
-- note must stay with that organization's members until the quote is claimed.
drop policy if exists crm_activities_read_staff_or_tenant on public.crm_activities;
create policy crm_activities_read_staff_or_tenant on public.crm_activities for select to authenticated
  using (
    (select private.has_any_staff_role(array['super_admin']::public.app_role[]))
    or (crm_lead_id is not null and
      (select private.has_any_staff_role(array['sales_manager']::public.app_role[])))
    or (quote_inquiry_id is not null and
      (select private.has_any_staff_role(array['sales_manager']::public.app_role[])))
    or (quote_id is not null and exists (
      select 1 from public.quotes q where q.id = quote_id and (
        (visibility = 'organization' and (select private.is_org_member(q.organization_id)))
        or (q.sales_owner_id = (select auth.uid()) and
          (select private.has_any_staff_role(array['sales_manager']::public.app_role[])))
        or (visibility = 'internal' and q.sales_owner_id is null and q.status = 'requested' and
          (select private.has_any_staff_role(array['sales_manager']::public.app_role[])))
      )
    ))
    or (organization_id is not null and visibility = 'organization' and
      (select private.is_org_member(organization_id)))
  );

-- Payment provider references and amounts belong to the customer and the
-- fulfillment/super-admin roles; the sales role has no payment use case.
drop policy if exists payments_read_owner_or_staff on public.payment_transactions;
create policy payments_read_owner_or_staff on public.payment_transactions for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and
      (o.customer_id = (select auth.uid()) or
       (select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])))
  ));
