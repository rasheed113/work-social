-- Team Finance display semantics:
-- paid = actual cash/payment amount.
-- payable-applied amount remains the settlement basis for due/coverage.
-- advance_paid = portion of actual payments beyond payable.
-- total_paid remains the same actual payment total for compatibility.

DROP FUNCTION IF EXISTS public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz);
CREATE FUNCTION public.get_contractor_team_finance_summary(p_team_number bigint,p_start timestamptz,p_end timestamptz)
RETURNS TABLE(payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=''
AS $$
WITH scope AS (
  SELECT t.id AS team_id FROM public.contractor_teams t
  WHERE t.team_number=p_team_number AND t.leader_profile_id=(SELECT auth.uid()) LIMIT 1
), p AS (
  SELECT COALESCE(SUM(wp.payable_amount),0)::numeric(24,4) payable
  FROM public.contractor_team_worker_payables wp JOIN scope s ON s.team_id=wp.team_id
  WHERE wp.created_at>=p_start AND wp.created_at<p_end
), m AS (
  SELECT
    COALESCE(SUM(pm.payable_applied_amount),0)::numeric(24,4) applied,
    COALESCE(SUM(pm.advance_amount),0)::numeric(24,4) advance_paid,
    COALESCE(SUM(pm.amount),0)::numeric(24,4) total_paid
  FROM public.contractor_team_worker_payments pm JOIN scope s ON s.team_id=pm.team_id
  WHERE pm.paid_at>=p_start AND pm.paid_at<p_end AND pm.deleted_at IS NULL
)
SELECT p.payable,m.total_paid,m.advance_paid,m.total_paid,
       GREATEST(p.payable-m.applied,0)::numeric(24,4),
       CASE WHEN p.payable=0 THEN 0::numeric ELSE ROUND((LEAST(m.applied,p.payable)/p.payable)*100,2) END
FROM p,m;
$$;

DROP FUNCTION IF EXISTS public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz);
CREATE FUNCTION public.get_contractor_team_finance_workers(p_team_number bigint,p_start timestamptz,p_end timestamptz)
RETURNS TABLE(worker_profile_id uuid,work_id uuid,display_name text,username text,avatar_url text,payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=''
AS $$
SELECT wp.id,wp.work_id,pr.display_name,pr.username,pr.avatar_url,
COALESCE((SELECT SUM(py.payable_amount) FROM public.contractor_team_worker_payables py WHERE py.team_id=t.id AND py.worker_profile_id=wp.id AND py.created_at>=p_start AND py.created_at<p_end),0)::numeric(24,4),
COALESCE((SELECT SUM(pm.amount) FROM public.contractor_team_worker_payments pm WHERE pm.team_id=t.id AND pm.worker_profile_id=wp.id AND pm.paid_at>=p_start AND pm.paid_at<p_end AND pm.deleted_at IS NULL),0)::numeric(24,4),
COALESCE((SELECT SUM(pm.advance_amount) FROM public.contractor_team_worker_payments pm WHERE pm.team_id=t.id AND pm.worker_profile_id=wp.id AND pm.paid_at>=p_start AND pm.paid_at<p_end AND pm.deleted_at IS NULL),0)::numeric(24,4),
COALESCE((SELECT SUM(pm.amount) FROM public.contractor_team_worker_payments pm WHERE pm.team_id=t.id AND pm.worker_profile_id=wp.id AND pm.paid_at>=p_start AND pm.paid_at<p_end AND pm.deleted_at IS NULL),0)::numeric(24,4),
GREATEST(COALESCE((SELECT SUM(py.payable_amount) FROM public.contractor_team_worker_payables py WHERE py.team_id=t.id AND py.worker_profile_id=wp.id AND py.created_at>=p_start AND py.created_at<p_end),0)-COALESCE((SELECT SUM(pm.payable_applied_amount) FROM public.contractor_team_worker_payments pm WHERE pm.team_id=t.id AND pm.worker_profile_id=wp.id AND pm.paid_at>=p_start AND pm.paid_at<p_end AND pm.deleted_at IS NULL),0),0)::numeric(24,4),
CASE WHEN COALESCE((SELECT SUM(py.payable_amount) FROM public.contractor_team_worker_payables py WHERE py.team_id=t.id AND py.worker_profile_id=wp.id AND py.created_at>=p_start AND py.created_at<p_end),0)=0 THEN 0::numeric ELSE ROUND((LEAST(COALESCE((SELECT SUM(pm.payable_applied_amount) FROM public.contractor_team_worker_payments pm WHERE pm.team_id=t.id AND pm.worker_profile_id=wp.id AND pm.paid_at>=p_start AND pm.paid_at<p_end AND pm.deleted_at IS NULL),0),COALESCE((SELECT SUM(py.payable_amount) FROM public.contractor_team_worker_payables py WHERE py.team_id=t.id AND py.worker_profile_id=wp.id AND py.created_at>=p_start AND py.created_at<p_end),0))/NULLIF(COALESCE((SELECT SUM(py.payable_amount) FROM public.contractor_team_worker_payables py WHERE py.team_id=t.id AND py.worker_profile_id=wp.id AND py.created_at>=p_start AND py.created_at<p_end),0),0))*100,2) END
FROM public.contractor_team_members m JOIN public.contractor_teams t ON t.id=m.team_id AND t.team_number=p_team_number AND t.leader_profile_id=(SELECT auth.uid()) JOIN public.worker_profiles wp ON wp.profile_id=m.profile_id LEFT JOIN public.profiles pr ON pr.id=wp.profile_id
GROUP BY wp.id,wp.work_id,pr.display_name,pr.username,pr.avatar_url,m.joined_at,t.id ORDER BY COALESCE(pr.display_name,pr.username,''),m.joined_at;
$$;

DROP FUNCTION IF EXISTS public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz);
CREATE FUNCTION public.get_contractor_team_worker_finance(p_team_number bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS TABLE(payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=''
AS $$
WITH scope AS (
  SELECT t.id AS team_id FROM public.contractor_teams t
  WHERE t.team_number=p_team_number AND t.leader_profile_id=(SELECT auth.uid()) LIMIT 1
), p AS (
  SELECT COALESCE(SUM(x.payable_amount),0)::numeric(24,4) payable
  FROM public.contractor_team_worker_payables x JOIN scope s ON s.team_id=x.team_id
  WHERE x.worker_profile_id=p_worker_profile_id AND x.created_at>=p_start AND x.created_at<p_end
), m AS (
  SELECT COALESCE(SUM(x.payable_applied_amount),0)::numeric(24,4) applied,
         COALESCE(SUM(x.advance_amount),0)::numeric(24,4) advance_paid,
         COALESCE(SUM(x.amount),0)::numeric(24,4) total_paid
  FROM public.contractor_team_worker_payments x JOIN scope s ON s.team_id=x.team_id
  WHERE x.worker_profile_id=p_worker_profile_id AND x.paid_at>=p_start AND x.paid_at<p_end AND x.deleted_at IS NULL
)
SELECT p.payable,m.total_paid,m.advance_paid,m.total_paid,
       GREATEST(p.payable-m.applied,0)::numeric(24,4),
       CASE WHEN p.payable=0 THEN 0::numeric ELSE ROUND((LEAST(m.applied,p.payable)/p.payable)*100,2) END
FROM p,m;
$$;
