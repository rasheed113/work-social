export type ExpenseCategoryType = 'expense' | 'income';

export interface ExpenseCategoryRecord { id:string; user_id:string; name:string; type:ExpenseCategoryType; icon:string|null; color:string|null; is_default:boolean; is_archived:boolean; default_key:string|null; created_at:string; updated_at:string; }
export interface ExpenseSubcategoryRecord { id:string; user_id:string; category_id:string; name:string; icon:string|null; color:string|null; is_default:boolean; is_archived:boolean; default_key:string|null; created_at:string; updated_at:string; }

export const EXPENSE_CATEGORY_TYPES = [{value:'expense' as const,label:'Expense',icon:'↘'},{value:'income' as const,label:'Income',icon:'↗'}];
const E=(key:string,name:string,subs:string[],icon:string,color:string)=>({key,name,type:'expense' as const,icon,color,subcategories:subs});
const I=(key:string,name:string,subs:string[],icon:string,color:string)=>({key,name,type:'income' as const,icon,color,subcategories:subs});
export const DEFAULT_CATEGORY_TAXONOMY = [
E('housing_rent','Housing & Rent',['House Rent','Apartment Rent','Mortgage','Maintenance','Repairs','Furniture','Appliances','Home Supplies','Security','Other Housing'],'🏠','#2563eb'),
E('utilities','Utilities',['Electricity','Gas','Water','Internet','Mobile','Cable / TV','Other Utilities'],'💡','#0f766e'),
E('groceries','Groceries',['Food Groceries','Household Supplies','Cleaning Supplies','Personal Household Items','Other Groceries'],'🛒','#16a34a'),
E('dining_restaurants','Dining & Restaurants',['Restaurant','Fast Food','Cafe','Tea / Coffee','Snacks','Food Delivery','Takeaway','Other Dining'],'🍔','#ea580c'),
E('transportation','Transportation',['Office Transport','Home Transport','Car','Motorcycle','Bus','Train','Taxi / Ride-hailing','Parking','Toll','Other Transportation'],'🚗','#7c3aed'),
E('fuel','Fuel',['Petrol','Diesel','CNG','Charging / EV','Other Fuel'],'⛽','#ca8a04'),
E('shopping','Shopping',['Clothing','Shoes','Electronics','Accessories','Household Shopping','Online Shopping','Other Shopping'],'🛍️','#db2777'),
E('health_medical','Health & Medical',['Doctor','Hospital','Medicine','Pharmacy','Dental','Laboratory / Tests','Therapy','Other Health'],'❤️','#dc2626'),
E('education','Education',['Tuition','School','University','Books','Courses','Training','Stationery','Other Education'],'🎓','#2563eb'),
E('travel','Travel',['Flights','Hotel','Transport','Visa','Travel Food','Travel Shopping','Activities','Other Travel'],'✈️','#0f766e'),
E('entertainment','Entertainment',['Movies','Games','Events','Music','Sports','Hobbies','Other Entertainment'],'🎬','#7c3aed'),
E('subscriptions','Subscriptions',['Streaming','Software','Cloud Storage','Memberships','News','Other Subscriptions'],'🔁','#db2777'),
E('personal_care','Personal Care',['Haircut','Salon','Cosmetics','Skincare','Grooming','Other Personal Care'],'✨','#ea580c'),
E('family_children','Family & Children',['Children','School Fees','Childcare','Family Support','Household Family Expense','Other Family'],'👨‍👩‍👧','#ca8a04'),
E('work_business','Work & Business',['Office Supplies','Business Travel','Client Expense','Equipment','Software','Professional Services','Other Business'],'💼','#475569'),
E('gifts_donations','Gifts & Donations',['Gifts','Charity','Donations','Religious Giving','Other Giving'],'🎁','#db2777'),
E('taxes_fees','Taxes & Fees',['Income Tax','Government Fees','Bank Fees','Service Charges','Fines','Other Taxes & Fees'],'🧾','#475569'),
E('insurance','Insurance',['Health Insurance','Vehicle Insurance','Life Insurance','Home Insurance','Other Insurance'],'🛡️','#0f766e'),
E('other_expense','Other Expense',['Miscellaneous','Other Expense'],'◈','#475569'),
I('salary','Salary',['Monthly Salary','Contract Salary','Overtime','Commission','Other Salary'],'💼','#16a34a'),
I('freelance_business','Freelance & Business',['Freelance','Consulting','Business Sales','Client Payment','Project Income','Other Business Income'],'📈','#2563eb'),
I('bonus','Bonus',['Performance Bonus','Annual Bonus','Commission Bonus','Other Bonus'],'🎁','#ca8a04'),
I('interest_dividends','Interest & Dividends',['Bank Interest','Investment Interest','Dividends','Other Investment Income'],'💰','#0f766e'),
I('refunds','Refunds',['Purchase Refund','Tax Refund','Service Refund','Other Refund'],'↩️','#7c3aed'),
I('gifts_received','Gifts Received',['Family Gift','Friend Gift','Other Gift'],'🎁','#db2777'),
I('other_income','Other Income',['Miscellaneous Income','Other Income'],'✨','#475569'),
] as const;
export const DEFAULT_EXPENSE_CATEGORIES = DEFAULT_CATEGORY_TAXONOMY.map(({subcategories:_,...c})=>c);
export const CATEGORY_ICON_OPTIONS=['🍔','🚗','🛍️','🧾','🎬','❤️','🎓','🏠','✈️','👤','🔁','💼','💰','🎁','📈','✨','🛒','💡','⛽','🛡️','◈','↩️','👨‍👩‍👧'];
export const CATEGORY_COLOR_OPTIONS=['#2563eb','#0f766e','#7c3aed','#db2777','#ea580c','#ca8a04','#16a34a','#475569','#dc2626'];
export function validateCategoryInput(input:{name:string;type:ExpenseCategoryType}){if(!input.name.trim())return'Category name is required.';if(input.name.trim().length>80)return'Category name must be 80 characters or fewer.';if(input.type!=='expense'&&input.type!=='income')return'Choose a valid category type.';return'';}
export function validateSubcategoryInput(name:string){const n=name.trim();if(!n)return'Subcategory name is required.';if(n.length>80)return'Subcategory name must be 80 characters or fewer.';return'';}
export function categoryTypeLabel(type:ExpenseCategoryType){return type==='income'?'Income':'Expense';}
