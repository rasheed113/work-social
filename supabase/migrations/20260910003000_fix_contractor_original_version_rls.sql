-- Allow contractor Team Work to read original revisions without depending on RLS visibility of the base entry.
-- The SECURITY DEFINER helper performs the ownership check safely; the versions table policy then delegates to it.

CREATE OR REPLACE FUNCTION private.contractor_can_view_team_work_versions(p_work_entry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.worker_team_work_entries e
    JOIN public.contractor_teams t ON t.id = e.team_id
    WHERE e.id = p_work_entry_id
      AND t.leader_profile_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.contractor_can_view_team_work_versions(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.contractor_can_view_team_work_versions(uuid) TO authenticated;

DROP POLICY IF EXISTS "Contractor team leaders can view team work versions" ON public.worker_team_work_entry_versions;
DROP POLICY IF EXISTS "Team owners can view all team work versions" ON public.worker_team_work_entry_versions;

CREATE POLICY "Contractor team leaders can view team work versions"
ON public.worker_team_work_entry_versions
FOR SELECT TO authenticated
USING (private.contractor_can_view_team_work_versions(work_entry_id));
