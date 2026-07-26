# Archived migration drafts

These SQL files reused versions already assigned to canonical migrations, so
the Supabase CLI could not treat the directory as a deterministic migration
chain. They are retained here for historical context and use the `.disabled`
suffix so they are never executed automatically.

Required live schema from these drafts is represented by uniquely versioned,
idempotent migrations in `../migrations`.
