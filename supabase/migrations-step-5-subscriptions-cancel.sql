-- Run this after step 4 if you want users to cancel their own mock plans.
-- It adds an update policy without changing existing data.

drop policy if exists subscriptions_update_own_or_admin on public.subscriptions;

create policy subscriptions_update_own_or_admin
  on public.subscriptions
  for update
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_super_admin()
  )
  with check (
    profile_id = auth.uid()
    or public.is_super_admin()
  );
