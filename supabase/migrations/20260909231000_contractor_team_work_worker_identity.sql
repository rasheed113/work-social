-- Contractor Team Dashboard work history needs the same real worker identity
-- for active and trashed entries. The worker avatar is sourced from profiles.

DROP FUNCTION IF EXISTS public.get_contractor_team_work_entries(bigint);

CREATE FUNCTION public.get_contractor_team_work_entries(p_team_number bigint)
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
    e.item_name,
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

-- Keep the existing owner-authorized trash RPC contract but enrich its result
-- with the same real profile identity used by the active dashboard feed.
DROP FUNCTION IF EXISTS public.get_worker_team_work_trash(bigint);

CREATE FUNCTION public.get_worker_team_work_trash(p_team_number bigint)
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
    e.item_name,
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
    AND e.lifecycle_state = 'trashed'
    AND (
      (
        e.worker_profile_id IN (
          SELECT wp2.id
          FROM public.worker_profiles wp2
          WHERE wp2.profile_id = (SELECT auth.uid())
        )
        AND EXISTS (
          SELECT 1
          FROM public.contractor_team_members m
          WHERE m.team_id = e.team_id
            AND m.profile_id = (SELECT auth.uid())
        )
      )
      OR t.leader_profile_id = (SELECT auth.uid())
    )
  ORDER BY e.updated_at DESC, e.id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_worker_team_work_trash(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_worker_team_work_trash(bigint) TO authenticated;
