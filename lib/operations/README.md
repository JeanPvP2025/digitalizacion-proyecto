# Operations data boundary

The operations center reads `orders`, `order_items`, and `order_events` through the authenticated Supabase session, so the current staff role and RLS policies constrain the rows it can see. The queue includes orders with a confirmed payment in `paid` or `processing` status and shipped orders; a pending payment is never treated as ready for fulfillment. Picking, packing, dispatch, and delivery use the service-role-only `start_order_picking`, `pack_order`, `dispatch_order`, and `confirm_order_delivery` RPCs. Server Actions check the current staff session, and PostgreSQL checks the supplied actor's persisted `fulfillment_manager` or `super_admin` grant again.

The queue is limited to the 24 oldest actionable orders. KPI counts use exact-count queries under RLS; the timeline shows up to 12 events from the last seven days. Picking and packing persist as order events; dispatch delegates stock consumption to the existing `fulfill_order` transaction, which verifies paid status and reservation quantities. No inventory or payment rules are implemented in this module.

## Out of scope

- Carrier booking, tracking numbers, label printing, and delivery-provider webhooks. The current schema has no shipment/carrier contract.
- Per-item picking scans, staff assignment, packing checklists, warehouse selection, split shipments, cancellation, or refunds. The current stages record the order-level workflow only.
- Inventory edits or reservation arithmetic. `fulfill_order` remains the only transition that consumes active reservations.
- Timeline events store the authorized staff actor. The UI shows event names and notes without exposing personal staff details.
- A paginated queue beyond the first 24 oldest actionable orders; the exact KPI counts still cover all rows visible under RLS.
