# Operations data boundary

The operations center reads `orders`, `order_items`, and `order_events` through the authenticated Supabase session, so the current staff role and RLS policies constrain the rows it can see. Fulfillment transitions use only the existing `fulfill_order` and `mark_order_delivered` RPCs. The server verifies `fulfillment_manager` or `super_admin` before invoking either service-role-only RPC.

The queue is limited to the 24 oldest actionable orders. KPI counts use exact-count queries under RLS; the timeline shows up to 12 events from the last seven days. No inventory or payment rules are implemented in this module.

## Out of scope

- Carrier booking, tracking numbers, label printing, and delivery-provider webhooks. The current schema has no shipment/carrier contract.
- Picking assignments, packing checklists, warehouse selection, split shipments, cancellation, or refunds. No matching operations RPC exists in this slice.
- Inventory edits or reservation arithmetic. `fulfill_order` remains the only transition that consumes active reservations.
- Actor attribution for these fulfillment timeline rows. The existing RPCs write their events with a null actor, so this UI does not infer or display a staff identity.
- A paginated queue beyond the first 24 oldest actionable orders; the exact KPI counts still cover all rows visible under RLS.
