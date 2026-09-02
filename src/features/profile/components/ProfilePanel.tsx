import { useEffect, useState } from 'react';
import type { ProfileUpdateInput } from '../api/updateProfile';
import { getProfile } from '../api/getProfile';
import { updateProfile } from '../api/updateProfile';
import { AvatarUploader } from './AvatarUploader';
import { PostFeed } from '../../posts/components/PostFeed';
import { supabase } from '../../../lib/supabase/client';

type Profile = { id:string; username:string; display_name:string; bio:string|null; avatar_url:string|null; date_of_birth:string|null; gender:string|null; location:string|null; website:string|null; created_at:string; updated_at:string; };
interface ProfilePanelProps { profileId:string; viewerId?:string; }
function formatJoinedDate(v:string){const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{year:'numeric',month:'long'});}

const profilePremiumStyles = `
  .premium-profile-panel { min-width: 0; color: #17202a; }
  .premium-profile-panel .profile-state-card,
  .premium-profile-panel .profile-hero-card,
  .premium-profile-panel .profile-joined-card {
    min-width: 0; box-sizing: border-box; overflow: hidden; position: relative;
    border: 1px solid rgba(99,102,241,.15); border-radius: 22px;
    background: linear-gradient(145deg,rgba(255,255,255,.985),rgba(242,245,255,.94) 58%,rgba(248,250,252,.96));
    box-shadow: 0 14px 34px rgba(15,23,42,.075),0 2px 8px rgba(79,70,229,.045),inset 0 1px 0 rgba(255,255,255,.98);
  }
  .premium-profile-panel .profile-state-card { padding: 22px; }
  .premium-profile-panel .profile-state-card h2 { margin:0 0 7px; font-size:20px; font-weight:900; letter-spacing:-.025em; }
  .premium-profile-panel .profile-state-card p { margin:6px 0; color:#64748b; line-height:1.55; }
  .premium-profile-panel .profile-state-card button,
  .premium-profile-panel .profile-action-button {
    border:1px solid rgba(99,102,241,.14); border-radius:999px; padding:9px 14px; min-height:38px;
    background:rgba(255,255,255,.86); color:#334155; font:inherit; font-size:13px; font-weight:850;
    box-shadow:0 7px 17px rgba(15,23,42,.065),inset 0 1px 0 rgba(255,255,255,.98);
    transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease; cursor:pointer;
  }
  .premium-profile-panel .profile-state-card button:hover:not(:disabled),
  .premium-profile-panel .profile-action-button:hover:not(:disabled) { transform:translateY(-1px); border-color:rgba(109,93,252,.3); box-shadow:0 10px 21px rgba(79,70,229,.12),inset 0 1px 0 rgba(255,255,255,.98); }
  .premium-profile-panel button:disabled { opacity:.58; cursor:default; }
  .premium-profile-panel .profile-hero-card { padding:27px 20px 22px; text-align:center; isolation:isolate; }
  .premium-profile-panel .profile-hero-card::before { content:''; position:absolute; z-index:-1; width:320px; height:210px; top:-112px; left:50%; transform:translateX(-50%); border-radius:50%; background:radial-gradient(circle,rgba(109,93,252,.18),rgba(34,193,220,.08) 43%,rgba(255,92,168,0) 72%); pointer-events:none; }
  .premium-profile-panel .profile-hero-card::after { content:''; position:absolute; inset:0; border-radius:inherit; background:linear-gradient(180deg,rgba(255,255,255,.25),transparent 34%); pointer-events:none; }
  .premium-profile-panel .profile-avatar { position:relative; z-index:1; display:inline-block; border:4px solid rgba(255,255,255,.98); outline:1px solid rgba(109,93,252,.16); border-radius:50%; object-fit:cover; box-shadow:0 12px 30px rgba(79,70,229,.23),0 0 0 7px rgba(109,93,252,.055); }
  .premium-profile-panel .profile-fallback-avatar { position:relative; z-index:1; display:inline-grid; place-items:center; width:112px; height:112px; border-radius:50%; background:linear-gradient(135deg,#ede9fe,#cffafe); border:4px solid white; box-shadow:0 12px 30px rgba(79,70,229,.18),0 0 0 7px rgba(109,93,252,.055); font-size:38px; }
  .premium-profile-panel .profile-name { position:relative; z-index:1; margin:16px 0 5px; font-size:clamp(23px,5vw,31px); line-height:1.1; font-weight:950; letter-spacing:-.03em; color:#111827; text-shadow:0 2px 8px rgba(15,23,42,.09); }
  .premium-profile-panel .profile-handle { position:relative; z-index:1; margin:4px 0; color:#64748b; font-size:13px; font-weight:750; }
  .premium-profile-panel .profile-bio { position:relative; z-index:1; margin:7px auto; max-width:680px; color:#475569; line-height:1.55; }
  .premium-profile-panel .profile-location { position:relative; z-index:1; margin:7px 0; color:#64748b; font-size:13px; }
  .premium-profile-panel .profile-actions { position:relative; z-index:2; display:flex; justify-content:center; flex-wrap:wrap; gap:8px; margin-top:17px; }
  .premium-profile-panel .profile-action-button.primary { background:linear-gradient(135deg,#6d5dfc,#3b82f6,#22c1dc); border-color:transparent; color:#fff; box-shadow:0 9px 21px rgba(79,70,229,.2),inset 0 1px 0 rgba(255,255,255,.24); }
  .premium-profile-panel .profile-action-button.danger { color:#b4232d; background:linear-gradient(135deg,rgba(254,242,242,.98),rgba(255,247,247,.96)); border-color:rgba(220,38,38,.14); }
  .premium-profile-panel .profile-feedback { position:relative; z-index:2; margin:10px 0 0; padding:8px 11px; border-radius:11px; background:rgba(248,250,252,.78); color:#64748b; font-size:12px; }
  .premium-profile-panel .profile-feed-wrap { min-width:0; margin-top:20px; }
  .premium-profile-panel .profile-joined-card { margin-top:20px; padding:13px 16px; text-align:center; border-radius:17px; }
  .premium-profile-panel .profile-joined-card p { margin:0; color:#64748b; font-size:13px; font-weight:700; }
  .premium-profile-panel .profile-joined-card p::before { content:'✦'; margin-right:7px; color:#6d5dfc; }
  @media (max-width:767px) {
    .premium-profile-panel .profile-hero-card { padding:23px 14px 19px; border-radius:19px; }
    .premium-profile-panel .profile-name { font-size:23px; }
    .premium-profile-panel .profile-action-button,.premium-profile-panel .profile-state-card button { min-height:36px; padding:8px 11px; font-size:12.5px; }
    .premium-profile-panel .profile-state-card { padding:17px; border-radius:19px; }
  }
`;

export function ProfilePanel({profileId,viewerId}:ProfilePanelProps){
 const isOwner=!viewerId||viewerId===profileId;
 const [profile,setProfile]=useState<Profile|null>(null);
 const [form,setForm]=useState<ProfileUpdateInput>({display_name:'',bio:'',date_of_birth:'',gender:'',location:'',website:''});
 const [editing,setEditing]=useState(false); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null); const [saved,setSaved]=useState(false);
 const [following,setFollowing]=useState(false); const [friend,setFriend]=useState(false); const [friendPending,setFriendPending]=useState(false); const [busyAction,setBusyAction]=useState(false); const [blockedByMe,setBlockedByMe]=useState(false); const [blockedMe,setBlockedMe]=useState(false);

 useEffect(()=>{let active=true;(async()=>{
   setLoading(true);setError(null);
   if(!isOwner&&viewerId){
     const {data:status,error:statusError}=await supabase.rpc('get_block_status',{p_other_id:profileId});
     if(!active)return;
     if(statusError){setError(statusError.message);setLoading(false);return;}
     const row=(status?.[0]??null) as {blocked_by_me?:boolean;blocked_me?:boolean;blocked?:boolean}|null;
     if(row?.blocked_by_me){setBlockedByMe(true);setBlockedMe(false);setLoading(false);return;}
     if(row?.blocked_me){setBlockedMe(true);setLoading(false);return;}
   }
   const {data,error:e}=await getProfile(profileId);if(!active)return;
   if(e||!data){setProfile(null);setError(e?.message??'Profile could not be loaded.');setLoading(false);return;}
   const p=data as Profile;setProfile(p);setForm({display_name:p.display_name??'',bio:p.bio??'',date_of_birth:p.date_of_birth??'',gender:p.gender??'',location:p.location??'',website:p.website??''});setLoading(false);
 })();return()=>{active=false};},[profileId,isOwner,viewerId]);

 useEffect(()=>{if(isOwner||!viewerId||blockedByMe||blockedMe)return;let active=true;(async()=>{
   const [{data:follows,error:fe},{data:friends,error:fre},{data:req,error:re}]=await Promise.all([
     supabase.from('follows').select('following_id').eq('follower_id',viewerId).eq('following_id',profileId).maybeSingle(),
     supabase.from('friends').select('profile_a_id, profile_b_id').or(`and(profile_a_id.eq.${viewerId},profile_b_id.eq.${profileId}),and(profile_a_id.eq.${profileId},profile_b_id.eq.${viewerId})`).maybeSingle(),
     supabase.from('friend_requests').select('id').eq('sender_id',viewerId).eq('receiver_id',profileId).eq('status','pending').maybeSingle()
   ]);if(!active)return;const e=fe??fre??re;if(e){setError(e.message);return;}setFollowing(Boolean(follows));setFriend(Boolean(friends));setFriendPending(Boolean(req));})();return()=>{active=false};},[isOwner,viewerId,profileId,blockedByMe,blockedMe]);

 const openEditor=()=>{if(!profile||!isOwner)return;setForm({display_name:profile.display_name??'',bio:profile.bio??'',date_of_birth:profile.date_of_birth??'',gender:profile.gender??'',location:profile.location??'',website:profile.website??''});setError(null);setSaved(false);setEditing(true);};
 const handleSave=async()=>{if(!profile||!isOwner)return;const normalized={display_name:form.display_name.trim(),bio:form.bio.trim(),date_of_birth:form.date_of_birth,gender:form.gender,location:form.location.trim(),website:form.website.trim()};if(!normalized.display_name){setError('Display name is required.');return;}setSaving(true);setError(null);const {data,error:e}=await updateProfile(profileId,normalized);if(e||!data){setError(e?.message??'Profile could not be saved.');setSaving(false);return;}setProfile(data as Profile);setEditing(false);setSaved(true);setSaving(false);};
 const toggleFollow=async()=>{if(!viewerId||isOwner||busyAction)return;setBusyAction(true);setError(null);const r=following?await supabase.from('follows').delete().eq('follower_id',viewerId).eq('following_id',profileId):await supabase.from('follows').insert({follower_id:viewerId,following_id:profileId});if(r.error)setError(r.error.message);else setFollowing(!following);setBusyAction(false);};
 const sendFriendRequest=async()=>{if(!viewerId||isOwner||friend||friendPending||busyAction)return;setBusyAction(true);setError(null);const {error:e}=await supabase.from('friend_requests').insert({sender_id:viewerId,receiver_id:profileId,status:'pending'});if(e)setError(e.message);else setFriendPending(true);setBusyAction(false);};
 const chatWithProfile=async()=>{if(!viewerId||isOwner||busyAction)return;setBusyAction(true);setError(null);const {data:conversation,error:e}=await supabase.rpc('create_direct_conversation',{target_profile:profileId});if(e||!conversation){setError(e?.message??'Could not open chat.');setBusyAction(false);return;}window.location.assign(`/inbox?conversation=${encodeURIComponent(conversation)}`);};
 const blockProfile=async()=>{if(!viewerId||isOwner||busyAction)return;if(!window.confirm(`Block ${profile?.display_name??'this user'}? They will no longer be able to view or interact with you.`))return;setBusyAction(true);setError(null);const {error:e}=await supabase.rpc('block_user',{p_blocked_id:profileId});if(e){setError(e.message);setBusyAction(false);return;}window.location.assign('/');};
 const unblockProfile=async()=>{if(!viewerId||isOwner||busyAction)return;setBusyAction(true);setError(null);const {error:e}=await supabase.rpc('unblock_user',{p_blocked_id:profileId});if(e){setError(e.message);setBusyAction(false);return;}setBlockedByMe(false);window.location.assign(`/profile/${encodeURIComponent(profileId)}`);};

 if(loading)return <section className="premium-profile-panel"><style>{profilePremiumStyles}</style><section className="profile-state-card"><p>Loading profile…</p></section></section>;
 if(blockedByMe)return <section className="premium-profile-panel"><style>{profilePremiumStyles}</style><section className="profile-state-card"><h2>User blocked</h2><p>You have blocked this user. Their profile and content are hidden from you.</p><button type="button" onClick={()=>void unblockProfile()} disabled={busyAction}>{busyAction?'Unblocking…':'Unblock user'}</button></section></section>;
 if(blockedMe)return <section className="premium-profile-panel"><style>{profilePremiumStyles}</style><section className="profile-state-card"><h2>Profile unavailable</h2><p>This profile is not available.</p></section></section>;
 if(error&&!profile)return <section className="premium-profile-panel"><style>{profilePremiumStyles}</style><section className="profile-state-card"><p role="alert">{error}</p></section></section>;
 if(!profile)return <section className="premium-profile-panel"><style>{profilePremiumStyles}</style><section className="profile-state-card"><p>Profile not found.</p></section></section>;
 if(editing&&isOwner)return <section className="foundation-card edit-profile-card premium-profile-panel">
   <style>{`${profilePremiumStyles}
     .edit-profile-card { min-width: 0; box-sizing: border-box; padding: 18px; border: 1px solid rgba(99,102,241,.16); border-radius: 20px; background: linear-gradient(145deg,rgba(255,255,255,.98),rgba(242,245,255,.95)); box-shadow:0 14px 34px rgba(15,23,42,.075),inset 0 1px 0 rgba(255,255,255,.96); }
     .edit-profile-card .edit-profile-heading { margin:0 0 14px; font-size:21px; font-weight:900; letter-spacing:-.025em; color:#17202a; }
     .edit-profile-card .edit-profile-avatar { padding:13px; margin-bottom:13px; border:1px solid rgba(99,102,241,.12); border-radius:15px; background:rgba(255,255,255,.72); box-shadow:0 6px 16px rgba(15,23,42,.045); }
     .edit-profile-card .edit-profile-fields { display:grid; gap:10px; }
     .edit-profile-card .edit-profile-field { display:grid; gap:5px; min-width:0; }
     .edit-profile-card .edit-profile-field>span { font-size:12px; font-weight:800; opacity:.72; }
     .edit-profile-card input,.edit-profile-card textarea,.edit-profile-card select { width:100%; min-width:0; box-sizing:border-box; border:1px solid rgba(71,85,105,.16); border-radius:11px; background:rgba(255,255,255,.94); color:#17202a; padding:9px 11px; font:inherit; outline:none; box-shadow:inset 0 1px 2px rgba(15,23,42,.035); }
     .edit-profile-card textarea { min-height:62px; resize:vertical; }
     .edit-profile-card input:focus,.edit-profile-card textarea:focus,.edit-profile-card select:focus { border-color:rgba(99,102,241,.48); box-shadow:0 0 0 3px rgba(99,102,241,.10),inset 0 1px 2px rgba(15,23,42,.035); }
     .edit-profile-card .edit-profile-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:13px; }
     .edit-profile-card .edit-profile-actions button { border:0; border-radius:999px; padding:8px 14px; font-weight:800; cursor:pointer; box-shadow:0 6px 16px rgba(15,23,42,.08); }
     .edit-profile-card .edit-save { background:linear-gradient(135deg,#6d5dfc,#3b82f6,#22c1dc); color:white; }
     .edit-profile-card .edit-cancel { background:rgba(15,23,42,.07); color:#17202a; }
     .edit-profile-card button:disabled { opacity:.55; cursor:default; }
     .edit-profile-card .edit-status { margin:9px 0 0; font-size:13px; }
     @media(max-width:767px){.edit-profile-card{padding:15px}.edit-profile-card .edit-profile-heading{font-size:20px}}
   `}</style>
   <h2 className="edit-profile-heading">Edit your profile</h2>
   <div className="edit-profile-avatar"><AvatarUploader userId={profileId} avatarUrl={profile.avatar_url} onUploaded={(url)=>setProfile(p=>p?{...p,avatar_url:url}:p)}/></div>
   <div className="edit-profile-fields">
     <label className="edit-profile-field"><span>Display name</span><input value={form.display_name} onChange={e=>setForm(v=>({...v,display_name:e.target.value}))}/></label>
     <label className="edit-profile-field"><span>Bio</span><textarea value={form.bio} onChange={e=>setForm(v=>({...v,bio:e.target.value}))}/></label>
     <label className="edit-profile-field"><span>Date of birth</span><input type="date" value={form.date_of_birth} onChange={e=>setForm(v=>({...v,date_of_birth:e.target.value}))}/></label>
     <label className="edit-profile-field"><span>Gender</span><select value={form.gender} onChange={e=>setForm(v=>({...v,gender:e.target.value}))}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="other">Other</option></select></label>
     <label className="edit-profile-field"><span>Location</span><input value={form.location} onChange={e=>setForm(v=>({...v,location:e.target.value}))}/></label>
     <label className="edit-profile-field"><span>Website</span><input type="url" value={form.website} onChange={e=>setForm(v=>({...v,website:e.target.value}))}/></label>
   </div>
   {error&&<p className="edit-status" role="alert">{error}</p>}
   <div className="edit-profile-actions"><button className="edit-save" type="button" onClick={()=>void handleSave()} disabled={saving}>{saving?'Saving…':'Save profile'}</button><button className="edit-cancel" type="button" onClick={()=>setEditing(false)} disabled={saving}>Cancel</button></div>
 </section>;

 return <section className="premium-profile-panel"><style>{profilePremiumStyles}</style><section className="profile-hero-card">{profile.avatar_url?<img className="profile-avatar" src={profile.avatar_url} alt={`${profile.display_name} profile`} width={112} height={112} style={{borderRadius:'50%',objectFit:'cover'}}/>:<div className="profile-fallback-avatar" aria-hidden="true">👤</div>}<h2 className="profile-name">{profile.display_name}</h2>{isOwner&&<p className="profile-handle">@{profile.username}</p>}{profile.bio&&<p className="profile-bio">{profile.bio}</p>} {profile.location&&<p className="profile-location">📍 {profile.location}</p>}
 <div className="profile-actions">{isOwner?<><button className="profile-action-button" type="button" onClick={()=>window.location.assign('/friends')}>Friends</button><button className="profile-action-button primary" type="button" onClick={openEditor}>Edit</button><button className="profile-action-button danger" type="button" onClick={()=>window.location.assign('/blocked-users')}>🚫 Blocked Users</button></>:<><button className="profile-action-button primary" type="button" onClick={()=>void chatWithProfile()} disabled={busyAction}>💬 Chat with {profile.display_name}</button><button className="profile-action-button" type="button" onClick={()=>void toggleFollow()} disabled={busyAction}>{following?'Following':'Follow'}</button><button className="profile-action-button" type="button" onClick={()=>void sendFriendRequest()} disabled={busyAction||friend}>{friend?'Friends':friendPending?'Request sent':'Add as Friend'}</button><button className="profile-action-button danger" type="button" onClick={()=>void blockProfile()} disabled={busyAction}>🚫 Block</button></>}</div>{error&&<p className="profile-feedback" role="alert">{error}</p>}{saved&&<p className="profile-feedback" role="status">Profile saved.</p>}</section>
 <section className="profile-feed-wrap"><PostFeed refreshKey={0} profileId={profileId} feedProfileId={profileId} scope="profile"/></section><footer className="profile-joined-card"><p>Joined {formatJoinedDate(profile.created_at)}</p></footer></section>;
}
