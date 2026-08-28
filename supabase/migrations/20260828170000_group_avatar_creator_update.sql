-- The client already filters group-avatar updates by creator. This policy makes the same rule explicit at the database boundary.
DROP POLICY IF EXISTS conversations_creator_update ON public.conversations;
CREATE POLICY conversations_creator_update
ON public.conversations
FOR UPDATE TO authenticated
USING (created_by = (SELECT auth.uid()))
WITH CHECK (created_by = (SELECT auth.uid()));
