alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'like'::text,
    'comment'::text,
    'comment_reply'::text,
    'mention_post'::text,
    'mention_comment'::text,
    'follow'::text,
    'message'::text,
    'friend_request'::text,
    'friend_accept'::text,
    'attendance_reminder'::text,
    'team_invitation'::text,
    'contractor_work_entry_report'::text
  ])
);
