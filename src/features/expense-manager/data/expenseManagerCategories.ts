import { supabase } from '../../../lib/supabase/client';
import type { ExpenseCategoryRecord, ExpenseCategoryType, ExpenseSubcategoryRecord } from '../domain/categories';
import { DEFAULT_CATEGORY_TAXONOMY } from '../domain/categories';
const CATEGORY_SELECT='id,user_id,name,type,icon,color,is_default,is_archived,default_key,created_at,updated_at';
const SUBCATEGORY_SELECT='id,user_id,category_id,name,icon,color,is_default,is_archived,default_key,created_at,updated_at';

export async function restoreDefaultExpenseTaxonomy(userId:string){
 if(!userId) throw new Error('User session is required.');
 const {data:cats,error:catError}=await supabase.from('expense_categories').select(CATEGORY_SELECT).eq('user_id',userId); if(catError)throw catError;
 const categoryMap=new Map((cats??[]).map(c=>[`${c.type}:${c.default_key}`,c as ExpenseCategoryRecord]));
 const existingByName=new Map((cats??[]).map(c=>[`${c.type}:${c.name.trim().toLowerCase()}`,c as ExpenseCategoryRecord]));
 const categoryIds=new Map<string,string>();
 const missing=DEFAULT_CATEGORY_TAXONOMY.filter(d=>!categoryMap.has(`${d.type}:${d.key}`));
 await Promise.all(missing.map(async d=>{
  const legacy=existingByName.get(`${d.type}:${d.name.trim().toLowerCase()}`);
  if(legacy){const {data,error}=await supabase.from('expense_categories').update({default_key:d.key,is_default:true,is_archived:false}).eq('id',legacy.id).eq('user_id',userId).select(CATEGORY_SELECT).single();if(error)throw error;categoryIds.set(`${d.type}:${d.key}`,data.id);}
  else {const {data,error}=await supabase.from('expense_categories').insert({user_id:userId,name:d.name,type:d.type,icon:d.icon,color:d.color,is_default:true,is_archived:false,default_key:d.key}).select(CATEGORY_SELECT).single();if(error)throw error;categoryIds.set(`${d.type}:${d.key}`,data.id);}
 }));
 for(const c of cats??[]){if(c.default_key)categoryIds.set(`${c.type}:${c.default_key}`,c.id);}
 const {data:subs,error:subError}=await supabase.from('expense_subcategories').select(SUBCATEGORY_SELECT).eq('user_id',userId); if(subError)throw subError;
 const subMap=new Map((subs??[]).map(s=>[`${s.category_id}:${s.default_key}`,s as ExpenseSubcategoryRecord]));
 const writes:Promise<void>[]=[];
 for(const d of DEFAULT_CATEGORY_TAXONOMY){const categoryId=categoryIds.get(`${d.type}:${d.key}`);if(!categoryId)continue;for(const name of d.subcategories){const key=name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');const existing=subMap.get(`${categoryId}:${key}`);if(existing){if(existing.is_archived)writes.push((async()=>{const {error}=await supabase.from('expense_subcategories').update({is_archived:false,is_default:true}).eq('id',existing.id).eq('user_id',userId);if(error)throw error;})());}else writes.push((async()=>{const {error}=await supabase.from('expense_subcategories').insert({user_id:userId,category_id:categoryId,name,icon:null,color:null,is_default:true,is_archived:false,default_key:key});if(error)throw error;})());}}
 await Promise.all(writes);
}
export async function loadExpenseCategories(userId:string,includeArchived=false):Promise<ExpenseCategoryRecord[]>{await restoreDefaultExpenseTaxonomy(userId);let q=supabase.from('expense_categories').select(CATEGORY_SELECT).eq('user_id',userId).order('type').order('is_default',{ascending:false}).order('name');if(!includeArchived)q=q.eq('is_archived',false);const {data,error}=await q;if(error)throw error;return (data??[]) as ExpenseCategoryRecord[];}
export async function loadExpenseSubcategories(userId:string,categoryId?:string,includeArchived=false):Promise<ExpenseSubcategoryRecord[]>{let q=supabase.from('expense_subcategories').select(SUBCATEGORY_SELECT).eq('user_id',userId).order('name');if(categoryId)q=q.eq('category_id',categoryId);if(!includeArchived)q=q.eq('is_archived',false);const {data,error}=await q;if(error)throw error;return (data??[]) as ExpenseSubcategoryRecord[];}
export async function createExpenseCategoryRecord(userId:string,input:{name:string;type:ExpenseCategoryType;icon:string;color:string}){const {data,error}=await supabase.from('expense_categories').insert({user_id:userId,name:input.name.trim(),type:input.type,icon:input.icon||null,color:input.color||null,is_default:false,is_archived:false}).select(CATEGORY_SELECT).single();if(error)throw error;return data as ExpenseCategoryRecord;}
export async function updateExpenseCategoryRecord(userId:string,id:string,input:{name:string;type:ExpenseCategoryType;icon:string;color:string}){const {data,error}=await supabase.from('expense_categories').update({name:input.name.trim(),type:input.type,icon:input.icon||null,color:input.color||null}).eq('id',id).eq('user_id',userId).select(CATEGORY_SELECT).single();if(error)throw error;return data as ExpenseCategoryRecord;}
export async function archiveExpenseCategory(userId:string,id:string){const {error}=await supabase.from('expense_categories').update({is_archived:true}).eq('id',id).eq('user_id',userId);if(error)throw error;}
export async function createExpenseSubcategory(userId:string,input:{categoryId:string;name:string;icon?:string;color?:string}){const {data,error}=await supabase.from('expense_subcategories').insert({user_id:userId,category_id:input.categoryId,name:input.name.trim(),icon:input.icon||null,color:input.color||null,is_default:false,is_archived:false}).select(SUBCATEGORY_SELECT).single();if(error)throw error;return data as ExpenseSubcategoryRecord;}
export async function updateExpenseSubcategory(userId:string,id:string,input:{name:string;icon?:string;color?:string}){const {data,error}=await supabase.from('expense_subcategories').update({name:input.name.trim(),icon:input.icon||null,color:input.color||null}).eq('id',id).eq('user_id',userId).select(SUBCATEGORY_SELECT).single();if(error)throw error;return data as ExpenseSubcategoryRecord;}
export async function archiveExpenseSubcategory(userId:string,id:string){const {error}=await supabase.from('expense_subcategories').update({is_archived:true}).eq('id',id).eq('user_id',userId);if(error)throw error;}
export async function restoreExpenseSubcategory(userId:string,id:string){const {data,error}=await supabase.from('expense_subcategories').update({is_archived:false}).eq('id',id).eq('user_id',userId).select(SUBCATEGORY_SELECT).single();if(error)throw error;return data as ExpenseSubcategoryRecord;}
export async function loadExpenseCategoryUsage(userId:string){const {data,error}=await supabase.from('expense_transactions').select('category_id,amount').eq('user_id',userId).not('category_id','is',null);if(error)throw error;return (data??[]).reduce<Record<string,{transactionCount:number;totalAmount:number}>>((r,row)=>{const id=String(row.category_id);const x=r[id]??{transactionCount:0,totalAmount:0};x.transactionCount++;x.totalAmount+=Number(row.amount)||0;r[id]=x;return r;},{});}
export async function getExpenseCategoryUsage(userId:string,id:string){const {count,error}=await supabase.from('expense_transactions').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('category_id',id);if(error)throw error;return count??0;}
