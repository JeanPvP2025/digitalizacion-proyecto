# Reviews contract

## Persisted review

- Each customer can submit only one review per product; the purchase-line key is also unique.
- Insert eligibility is enforced by RLS: the authenticated actor owns the order, the order is delivered, the product matches the order line, and the product is published.
- The database fills author_id from auth.uid() and always creates reviews as pending.
- Pending can transition once to published or rejected. Only super_admin can perform that transition; the database records the actor and time.
- The Data API exposes public review content and status only. Reviewer IDs, order-line IDs, and moderation notes are not selectable. my_reviewed_order_items(text) returns only the caller's own reviewed line IDs.

## Routes in this slice

- /producto/[slug]/opiniones lists published reviews and accepts a review only when the signed-in customer has an unreviewed delivered order line for that product.
- /api/reviews accepts validated submissions. It does not accept a caller-supplied author or moderation status.
- /backoffice/reviews and /api/reviews/[reviewId] provide the super_admin moderation queue and its publish/reject actions.

## Integration handoff

The shared product page and backoffice layout/navigation were outside this workstream's ownership. The Tech Lead should wire a visible link from app/(store)/producto/[slug]/page.tsx to the opinions route and replace its demo testimonial/rating presentation when the product is connected. Connected storefront aggregates must derive only from published reviews; the seeded products.rating_average and products.rating_count fields are not evidence of real reviews. Add /backoffice/reviews to internal navigation if one is introduced.

Moderation is limited to super_admin to match the existing backoffice role gate without changing shared RBAC surfaces. If catalog_manager should moderate, update the shared role policy/layout and the database policy together, then add role-isolation tests.
