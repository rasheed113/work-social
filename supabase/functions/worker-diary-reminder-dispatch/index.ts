import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';
const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}') as Record<string,string>;
const serviceKey=secretKeys.default??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!serviceKey) throw new Error('Supabase server secret is unavailable.');
const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
Deno.serve(async req=>{
if(req.method!=='POST')return json({error:'Method not allowed.'},405);
const {data:secrets,error:secretError}=await admin.rpc('get_worker_diary_runtime_secrets');
if(secretError||!secrets)return json({error:'Reminder runtime configuration is unavailable.'},503);
const runtime=secrets as Record<string,string>;
if(req.headers.get('x-worker-diary-cron-secret')!==runtime.worker_diary_cron_secret)return json({error:'Unauthorized.'},401);
if(!runtime.worker_diary_vapid_private_key||!runtime.worker_diary_vapid_subject)return json({error:'Web Push configuration is unavailable.'},503);
webpush.setVapidDetails(runtime.worker_diary_vapid_subject,'BOQVmOlZERK3UNbyn11QFWnA0LW3pVbBe9I45iKAp9WqBsCBCsHsDd3oThVhj9D_9blgjsNGmccx3KNeQRqSqPQ',runtime.worker_diary_vapid_private_key);
const {data:reminders,error:claimError}=await admin.rpc('claim_worker_diary_reminders',{p_limit:50});
if(claimError)return json({error:claimError.message},500);
let sent=0,failed=0,cancelled=0; const results:Array<{id:string,status:string}>=[];
for(const reminder of reminders??[]){
const {data:liveReminder}=await admin.from('worker_diary_reminders').select('id,diary_entry_id,worker_profile_id,reminder_kind,enabled,status').eq('id',reminder.id).maybeSingle();
const {data:liveEntry}=liveReminder?.diary_entry_id?await admin.from('worker_diary_entries').select('id,entry_type,title,content,completed,event_start_at').eq('id',liveReminder.diary_entry_id).maybeSingle():{data:null};
if(!liveReminder||!liveEntry||!liveReminder.enabled||liveReminder.status!=='processing'||(liveReminder.reminder_kind==='todo'&&liveEntry.completed)){await admin.from('worker_diary_reminders').update({enabled:false,status:'cancelled',claimed_at:null,updated_at:new Date().toISOString()}).eq('id',reminder.id);cancelled++;results.push({id:reminder.id,status:'cancelled'});continue;}
const {data:prefs}=await admin.from('worker_diary_preferences').select('notifications_enabled,todo_reminders_enabled,event_reminders_enabled').eq('worker_profile_id',reminder.worker_profile_id).maybeSingle();
const allowed=Boolean(prefs?.notifications_enabled)&&(reminder.reminder_kind==='todo'?Boolean(prefs?.todo_reminders_enabled):Boolean(prefs?.event_reminders_enabled));
if(!allowed){await admin.from('worker_diary_reminders').update({status:'pending',claimed_at:null,updated_at:new Date().toISOString()}).eq('id',reminder.id);results.push({id:reminder.id,status:'deferred'});continue;}
const {data:subscriptions,error:subscriptionError}=await admin.from('worker_diary_push_subscriptions').select('id,endpoint,p256dh,auth').eq('worker_profile_id',reminder.worker_profile_id);
if(subscriptionError||!subscriptions?.length){await admin.from('worker_diary_reminders').update({status:'failed',claimed_at:null,last_error:'No active device notification subscription is registered.',updated_at:new Date().toISOString()}).eq('id',reminder.id);failed++;results.push({id:reminder.id,status:'failed_no_subscription'});continue;}
const title=liveEntry.title||(reminder.reminder_kind==='event'?'Personal Diary Event':'Personal Diary To-do');let delivered=false,lastError='';
for(const subscription of subscriptions){try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify({title,body:`Reminder: ${title}`,tag:`diary-${reminder.id}`,reminderId:reminder.id,url:'/work/diary'}),{TTL:300,urgency:'high',topic:reminder.id.replace(/-/g,'').slice(0,32)});delivered=true;}catch(error){lastError=error instanceof Error?error.message:'Web Push delivery failed.';const statusCode=(error as {statusCode?:number}).statusCode;if(statusCode===404||statusCode===410)await admin.from('worker_diary_push_subscriptions').delete().eq('id',subscription.id);}}
if(delivered){await admin.from('worker_diary_reminders').update({status:'sent',sent_at:new Date().toISOString(),claimed_at:null,last_error:null,updated_at:new Date().toISOString()}).eq('id',reminder.id);sent++;results.push({id:reminder.id,status:'sent'});}else{await admin.from('worker_diary_reminders').update({status:'failed',claimed_at:null,last_error:lastError||'Web Push delivery failed.',updated_at:new Date().toISOString()}).eq('id',reminder.id);failed++;results.push({id:reminder.id,status:'failed'});}}
return json({ok:true,claimed:reminders?.length??0,sent,failed,cancelled,results});
});
