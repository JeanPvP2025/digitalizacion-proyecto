# Integration checks

Vitest invokes the search, checkout, B2B quote, and support route handlers with
local-demo storage redirected to a temporary directory. CRM and inventory
reader/action tests use deterministic Supabase query doubles to exercise
authorization, empty results, query failures, and valid updates.

When the local Supabase database is running and already migrated, run the
transactional PostgreSQL/RLS gate without resetting that database:

```powershell
Get-Content tests/integration/postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

The SQL gate creates only synthetic fixtures inside one transaction and rolls
them back. Its final check verifies that no fixture records remain.
