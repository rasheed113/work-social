import { UniversalEyesSecurityError, createSupabaseUniversalEyesRepository, searchUniversalEyes, selectUniversalEyesModules } from './universalEyes';

type Row = Record<string, unknown>;
function mockClient(rows: Record<string, Row[]>) {
  const calls: Array<{ table: string; filters: Array<[string, string, unknown]>; ranges: Array<[string, unknown, unknown]> }> = [];
  const client = { from(table: string) { const call={table,filters:[],ranges:[]} as {table:string;filters:Array<[string,string,unknown]>;ranges:Array<[string,unknown,unknown]>}; calls.push(call); const builder:any={select(){return builder;},eq(column:string,value:unknown){call.filters.push(['eq',column,value]);return builder;},neq(column:string,value:unknown){call.filters.push(['neq',column,value]);return builder;},is(column:string,value:unknown){call.filters.push(['is',column,value]);return builder;},gte(column:string,value:unknown){call.ranges.push([column,'gte',value]);return builder;},lt(column:string,value:unknown){call.ranges.push([column,'lt',value]);return builder;},ilike(column:string,value:unknown){call.filters.push(['ilike',column,value]);return builder;},or(value:unknown){call.filters.push(['or','or',value]);return builder;},order(){return builder;},limit(){return builder;},maybeSingle(){return Promise.resolve({data:rows[table]?.[0]??null,error:null});},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:rows[table]??[],error:null}).then(resolve);}}; return builder; } };
  return {client,calls};
}

const repository={
  searchSocial:async()=>[{module:'social' as const,record_id:'s1',title:'Post',snippet:'launch',occurred_at:'2026-09-07T08:00:00Z',metadata:{}}],
  searchWork:async()=>[{module:'work' as const,record_id:'w1',title:'Work Entry',snippet:'10 × 50',occurred_at:'2026-09-06T08:00:00Z',metadata:{quantity:10,rate:50}}],
  searchWorkFinance:async()=>[{module:'work_finance' as const,record_id:'wf1',title:'Payment received',snippet:'500',occurred_at:'2026-09-05T08:00:00Z',metadata:{amount:500}}],
  searchDiary:async()=>[{module:'diary' as const,record_id:'d1',title:'Idea',snippet:'launch',occurred_at:'2026-09-04T08:00:00Z',metadata:{}}],
  searchFinance:async()=>[{module:'finance' as const,record_id:'f1',title:'expense',snippet:'500 · Work · Groceries · Food',occurred_at:'2026-09-03',metadata:{amount:500}}],
};

async function main(){
  const all=await searchUniversalEyes(repository,'user-a','launch',{limit:10});
  if(all.results.length!==5)throw new Error(`expected five normalized results, got ${all.results.length}`);
  if(!all.results.every(r=>r.module&&r.record_id&&r.title&&'metadata' in r))throw new Error('normalized result shape is incomplete');
  const multi=await searchUniversalEyes(repository,'user-a','work payment diary',{limit:10});
  if(!multi.modules.includes('work')||!multi.modules.includes('work_finance')||!multi.modules.includes('diary'))throw new Error('multi-module selection failed');
  if(!multi.ambiguous)throw new Error('multi-module search should be marked ambiguous');
  const filtered=await searchUniversalEyes(repository,'user-a','launch',{modules:['finance'],from:'2026-09-01',to:'2026-09-08',limit:5});
  if(filtered.modules.length!==1||filtered.modules[0]!=='finance')throw new Error('explicit module selection failed');
  if(!selectUniversalEyesModules('payment received').includes('work_finance'))throw new Error('work finance routing failed');
  if(!selectUniversalEyesModules('expense account balance').includes('finance'))throw new Error('finance routing failed');
  if(!selectUniversalEyesModules('diary idea').includes('diary'))throw new Error('diary routing failed');
  if(!selectUniversalEyesModules('post notification').includes('social'))throw new Error('social routing failed');
  if(!selectUniversalEyesModules('pieces rate item').includes('work'))throw new Error('work routing failed');
  let rejected=false;try{selectUniversalEyesModules('api_key=super-secret');}catch(error){rejected=error instanceof UniversalEyesSecurityError;}if(!rejected)throw new Error('credential-like search text was not rejected');
  let longRejected=false;try{selectUniversalEyesModules('x'.repeat(501));}catch(error){longRejected=error instanceof UniversalEyesSecurityError;}if(!longRejected)throw new Error('oversized search text was not rejected');

  const {client,calls}=mockClient({worker_profiles:[{id:'worker-a'}],posts:[{id:'s1',content:'hello',created_at:'2026-09-07T08:00:00Z',privacy:'public',location_name:null}],work_entries:[{id:'w1',item_name:'shirt',size:['S'],quantity:2,rate:100,total:200,occurred_at:'2026-09-07T07:00:00Z'}],worker_finance_received:[{id:'wf1',entry_type:'payment',amount:500,received_at:'2026-09-07T06:00:00Z'}],worker_diary_entries:[{id:'d1',entry_type:'event',title:'Launch',content:'hello',event_start_at:'2026-09-07T05:00:00Z',created_at:'2026-09-01T05:00:00Z',updated_at:'2026-09-07T05:00:00Z'}],expense_accounts:[{id:'a1',name:'Work',type:'cash',currency:'PKR'}],expense_categories:[{id:'c1',name:'Groceries',type:'expense',is_archived:false}],expense_subcategories:[{id:'s1',name:'Food',category_id:'c1',is_archived:false}],expense_transactions:[{id:'f1',type:'expense',amount:50,account_id:'a1',category_id:'c1',subcategory_id:'s1',date:'2026-09-07',note:'tea'}]});
  const adapter=createSupabaseUniversalEyesRepository(client);
  const social=await adapter.searchSocial('user-a','hello',{from:'2026-09-01',to:'2026-09-08'});if(social[0]?.snippet!=='hello')throw new Error('social result mismatch');
  const work=await adapter.searchWork('user-a','shirt',{from:'2026-09-01',to:'2026-09-08'});if(work[0]?.metadata?.size===undefined)throw new Error('work metadata missing');
  await adapter.searchWorkFinance('user-a','payment',{from:'2026-09-01',to:'2026-09-08'});
  const diary=await adapter.searchDiary('user-a','hello',{from:'2026-09-07',to:'2026-09-08'});if(!diary[0]||diary[0].occurred_at!=='2026-09-07T05:00:00Z')throw new Error('diary event date semantics failed');
  const financeByAccount=await adapter.searchFinance('user-a','work',{from:'2026-09-01',to:'2026-09-08'});if(!financeByAccount.length||financeByAccount[0].metadata.account_name!=='Work')throw new Error('finance account-name search failed');
  const financeByCategory=await adapter.searchFinance('user-a','groceries',{from:'2026-09-01',to:'2026-09-08'});if(!financeByCategory.length||financeByCategory[0].metadata.category_name!=='Groceries')throw new Error('finance category-name search failed');
  const financeBySubcategory=await adapter.searchFinance('user-a','food',{from:'2026-09-01',to:'2026-09-08'});if(!financeBySubcategory.length||financeBySubcategory[0].metadata.subcategory_name!=='Food')throw new Error('finance subcategory-name search failed');
  const financeByNote=await adapter.searchFinance('user-a','tea',{from:'2026-09-01',to:'2026-09-08'});if(!financeByNote.length)throw new Error('finance note search failed');

  const scoped=calls.filter(c=>['posts','expense_transactions','expense_accounts','expense_categories','expense_subcategories'].includes(c.table));
  for(const call of scoped){if(['expense_accounts','expense_categories','expense_subcategories'].includes(call.table)){if(!call.filters.some(([op,column,value])=>op==='eq'&&column==='user_id'&&value==='user-a'))throw new Error(`${call.table} lost user ownership filter`);}else if(call.table==='posts'){if(!call.filters.some(([op,column,value])=>op==='eq'&&column==='profile_id'&&value==='user-a'))throw new Error('social adapter lost user ownership filter');}else if(!call.filters.some(([op,column,value])=>op==='eq'&&column==='user_id'&&value==='user-a'))throw new Error('finance adapter lost user ownership filter');}
  const workerCalls=calls.filter(c=>['work_entries','worker_finance_received','worker_diary_entries'].includes(c.table));
  for(const call of workerCalls){if(!call.filters.some(([op,column,value])=>op==='eq'&&column==='worker_profile_id'&&value==='worker-a'))throw new Error(`${call.table} lost worker ownership filter`);if(!call.ranges.length)throw new Error(`${call.table} lost date range filtering`);}
  if(!calls.find(c=>c.table==='posts')?.ranges.length)throw new Error('social date filtering missing');
  if(!calls.find(c=>c.table==='expense_transactions')?.ranges.length)throw new Error('finance date filtering missing');
  console.log('Universal Eyes tests passed');
}
main().catch(error=>{console.error(error);process.exit(1);});
