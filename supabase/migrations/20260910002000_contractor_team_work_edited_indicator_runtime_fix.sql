-- Ensure the contractor Team Work Edited indicator is actually applied to the live database.
-- Revision 1 is original; revision 2+ means the worker edited the same entry.

CREATE OR REPLACE FUNCTION public.get_contractor_team_work_entries(p_team_number bigint)
RETURNS TABLE(
  id uuid,
  item_name text,
  size text[],
  quantity numeric,
  rate numeric,
  total numeric,
  special_note text,
  occurred_at timestamptz,
  updated_at timestamptz,
  worker_profile_id uuid,
  worker_display_name text,
  worker_username text,
  worker_avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    e.id,
    CASE WHEN EXISTS (
      SELECT 1
      FROM public.worker_team_work_entry_versions v
      WHERE v.work_entry_id = e.id
        AND v.revision_no > 1
    ) THEN e.item_name || ' · Edited' ELSE e.item_name END,
    e.size,
    e.quantity,
    e.rate,
    e.total,
    e.special_note,
    e.occurred_at,
    e.updated_at,
    e.worker_profile_id,
    p.display_name,
    p.username,
    p.avatar_url
  FROM public.worker_team_work_entries e
  JOIN public.contractor_teams t ON t.id = e.team_id
  JOIN public.worker_profiles wp ON wp.id = e.worker_profile_id
  LEFT JOIN public.profiles p ON p.id = wp.profile_id
  WHERE t.team_number = p_team_number
    AND t.leader_profile_id = (SELECT auth.uid())
    AND e.lifecycle_state = 'active'
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_contractor_team_work_entries(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_contractor_team_work_entries(bigint) TO authenticated;

-- The contractor's View Original control reads revision 1 directly.
CREATE POLICY "Contractor team leaders can view team work versions"
ON public.worker_team_work_entry_versions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.worker_team_work_entries e
    JOIN public.contractor_teams t ON t.id = e.team_id
    WHERE e.id = worker_team_work_entry_versions.work_entry_id
      AND t.leader_profile_id = (SELECT auth.uid())
  )
);