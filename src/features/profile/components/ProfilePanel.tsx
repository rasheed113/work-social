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

 if(loading)return <section className="foundation-card"><p>Loading profile…</p></section>;
 if(blockedByMe)return <section className="foundation-card"><h2>User blocked</h2><p>You have blocked this user. Their profile and content are hidden from you.</p><button type="button" onClick={()=>void unblockProfile()} disabled={busyAction}>{busyAction?'Unblocking…':'Unblock user'}</button></section>;
 if(blockedMe)return <section className="foundation-card"><h2>Profile unavailable</h2><p>This profile is not available.</p></section>;
 if(error&&!profile)return <section className="foundation-card"><p role="alert">{error}</p></section>;
 if(!profile)return <section className="foundation-card"><p>Profile not found.</p></section>;
 if(editing&&isOwner)return <section className="foundation-card edit-profile-card">
   <style>{`
     .edit-profile-card { min-width: 0; box-sizing: border-box; padding: 18px; border: 1px solid rgba(99,102,241,.16); border-radius: 18px; background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(242,245,255,.95)); box-shadow: 0 10px 28px rgba(15,23,42,.075), inset 0 1px 0 rgba(255,255,255,.96); }
     .edit-profile-card .edit-profile-heading { margin: 0 0 14px; font-size: 21px; font-weight: 900; letter-spacing: -.025em; color: #17202a; text-shadow: 0 2px 7px rgba(23,32,42,.09); }
     .edit-profile-card .edit-profile-avatar { padding: 13px; margin-bottom: 13px; border: 1px solid rgba(99,102,241,.12); border-radius: 15px; background: rgba(255,255,255,.72); box-shadow: 0 6px 16px rgba(15,23,42,.045); }
     .edit-profile-card .edit-profile-fields { display: grid; gap: 10px; }
     .edit-profile-card .edit-profile-field { display: grid; gap: 5px; min-width: 0; }
     .edit-profile-card .edit-profile-field > span { font-size: 12px; font-weight: 800; letter-spacing: .01em; opacity: .72; }
     .edit-profile-card input, .edit-profile-card textarea, .edit-profile-card select { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid rgba(71,85,105,.16); border-radius: 11px; background: rgba(255,255,255,.94); color: #17202a; padding: 9px 11px; font: inherit; outline: none; box-shadow: inset 0 1px 2px rgba(15,23,42,.035); }
     .edit-profile-card textarea { min-height: 62px; resize: vertical; }
     .edit-profile-card input:focus, .edit-profile-card textarea:focus, .edit-profile-card select:focus { border-color: rgba(99,102,241,.48); box-shadow: 0 0 0 3px rgba(99,102,241,.10), inset 0 1px 2px rgba(15,23,42,.035); }
     .edit-profile-card .edit-profile-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 13px; }
     .edit-profile-card .edit-profile-actions button { border: 0; border-radius: 999px; padding: 8px 14px; font-weight: 800; cursor: pointer; box-shadow: 0 5px 14px rgba(15,23,42,.08); }
     .edit-profile-card .edit-save { background: linear-gradient(135deg,#6d5dfc,#3b82f6,#22c1dc); color: white; }
     .edit-profile-card .edit-cancel { background: rgba(15,23,42,.07); color: #17202a; }
     .edit-profile-card button:disabled { opacity: .55; cursor: default; }
     .edit-profile-card .edit-status { margin: 9px 0 0; font-size: 13px; }
     @media (max-width: 767px) { .edit-profile-card { padding: 15px; } .edit-profile-card .edit-profile-heading { font-size: 20px; } }
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

 return <section><section className="foundation-card" style={{textAlign:'center'}}>{profile.avatar_url?<img src={profile.avatar_url} alt={`${profile.display_name} profile`} width={112} height={112} style={{borderRadius:'50%',objectFit:'cover'}}/>:<div aria-hidden="true">👤</div>}<h2>{profile.display_name}</h2>{isOwner&&<p>@{profile.username}</p>}{profile.bio&&<p>{profile.bio}</p>} {profile.location&&<p>📍 {profile.location}</p>}
 <div style={{display:'flex',justifyContent:'center',flexWrap:'wrap',gap:8}}>{isOwner?<><button type="button" onClick={()=>window.location.assign('/friends')}>Friends</button><button type="button" onClick={openEditor}>Edit</button><button type="button" onClick={()=>window.location.assign('/blocked-users')}>🚫 Blocked Users</button></>:<><button type="button" onClick={()=>void chatWithProfile()} disabled={busyAction}>💬 Chat with {profile.display_name}</button><button type="button" onClick={()=>void toggleFollow()} disabled={busyAction}>{following?'Following':'Follow'}</button><button type="button" onClick={()=>void sendFriendRequest()} disabled={busyAction||friend}>{friend?'Friends':friendPending?'Request sent':'Add as Friend'}</button><button type="button" onClick={()=>void blockProfile()} disabled={busyAction}>🚫 Block</button></>}</div>{error&&<p role="alert">{error}</p>}{saved&&<p role="status">Profile saved.</p>}</section>
 <section style={{marginTop:20}}><PostFeed refreshKey={0} profileId={profileId} feedProfileId={profileId} scope="profile"/></section><footer className="foundation-card" style={{marginTop:20,textAlign:'center'}}><p>Joined {formatJoinedDate(profile.created_at)}</p></footer></section>;
}
