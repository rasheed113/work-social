-- Group conversation permissions.
-- Members may add people to groups; only the creator may rename, change the avatar, or remove another member.
-- Everyone may leave their own group membership.

DROP POLICY IF EXISTS conversation_members_insert_authorized ON public.conversation_members;
CREATE POLICY conversation_members_insert_authorized
ON public.conversation_members
FOR INSERT TO authenticated
WITH CHECK (
  profile_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_id
      AND c.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.conversation_members cm
      ON cm.conversation_id = c.id
    WHERE c.id = conversation_id
      AND c.kind = 'group'
      AND cm.profile_id = (SELECT auth.uid())
  )
);

-- Keep direct-conversation membership private to its participants/creator while allowing
-- every existing group member to add another profile to a group.
DROP POLICY IF EXISTS conversation_members_delete_authorized ON public.conversation_members;
CREATE POLICY conversation_members_delete_authorized
ON public.conversation_members
FOR DELETE TO authenticated
USING (
  profile_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_id
      AND c.created_by = (SELECT auth.uid())
      AND c.kind = 'group'
  )
);

-- Group metadata remains creator-only. The existing conversations_creator_update policy
-- already enforces both USING and WITH CHECK against created_by = auth.uid().
