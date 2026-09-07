import { createClient } from "npm:@supabase/supabase-js@2";

const HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const MODEL = "gemini-3.5-flash-lite";
const DEFAULT_TIME_ZONE = "Asia/Karachi";
const MAX_HISTORY = 10;
const MAX_ROUNDS = 5;
const ACTION_TTL_MS = 10 * 60 * 1000;

type AnyRecord = Record<string, any>;
class AiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, "Content-Type": "application/json" } });
const text = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown) => Number(value);

function supabaseForRequest(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new AiError(401, "AUTHORIZATION_MISSING", "Missing user authorization.");
  const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const key = keys.default;
  if (!key) throw new AiError(500, "SUPABASE_CONFIG_ERROR", "Supabase configuration is unavailable.");
  return createClient(Deno.env.get("SUPABASE_URL")!, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticate(req: Request) {
  const authorization = req.headers.get("Authorization");
  const client = supabaseForRequest(req);
  const { data, error } = await client.auth.getUser(authorization!.slice(7));
  if (error || !data.user) throw new AiError(401, "AUTHENTICATION_FAILED", "Your Work Social session is not valid.");
  return { client, userId: data.user.id };
}

async function workerProfileId(client: any, userId: string) {
  const { data, error } = await client.from("worker_profiles").select("id").eq("profile_id", userId).maybeSingle();
  if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
  if (!data) throw new AiError(404, "WORK_IDENTITY_UNAVAILABLE", "Your Work Identity is not set up.");
  return data.id as string;
}

function timeContext(body: AnyRecord) {
  const tz = text(body.client_timezone) || DEFAULT_TIME_ZONE;
  const now = text(body.client_now_iso) || new Date().toISOString();
  return { tz, now };
}

const SYSTEM = `You are Work Social AI — the operating intelligence layer for Work Social, not a generic answer bot.

Work Social has exactly four product domains:
1) Social Media: Home/feed, posts, videos, profile, friends, friend requests, Inbox/private messaging, Activity and Notifications.
2) Work Platform: Work Entries with item, size, pieces/quantity, rate, total and notes; Work reports; Work Finance for payments/advances received.
3) Personal Diary: notes, journal, todo, ideas and events.
4) Finance Manager / Expense Manager: Overview, Transactions, Accounts, Categories/Subcategories, Budgets and Reports, including expenses, income and transfers.

Your job is to understand natural language, infer the user's intended destination, inspect real authenticated data when needed, and prepare or execute real actions only through the available tools.

ROUTING RULES:
- Do not force the user to know module names.
- “work entry”, item/pieces/rate/size, work completed, shirt S 10 pieces etc. means Work Platform.
- “boss gave me 10,000”, payment received or advance received for work means Work Finance.
- “I spent 500 on lunch”, household spending, income into a personal account, or moving money between accounts means Finance Manager.
- “diary mein likh do”, remember this, journal, todo, idea or event means Personal Diary.
- Social questions about profile, posts, notifications, friends or messaging belong to Social Media.
- If a write could reasonably mean two destinations, ask which destination instead of guessing. Example: “5000 add kar do” is ambiguous.

ACTION RULES:
- A persistent write must always become a confirmation-gated pending action first.
- Never claim that a write is saved until confirmation execution succeeds.
- Ask one focused missing question at a time and never ask for information already provided.
- Work Entry required fields: item name, quantity/pieces and rate. Size/note/date are optional. Total is quantity × rate.
- Work Finance received required fields: payment vs advance, amount and date/time.
- Finance Manager expense/income: type, amount, account, category and date; note optional. Transfer: amount, from account, to account and date.
- Personal Diary: content required; title/type/date optional.
- Use read tools before asking for IDs when the user gives account/category names.
- Resolve account/category names against real data. Never invent IDs, balances or categories.
- If a requested account/category does not exist, say so and ask the user what to do; do not silently create one.

INTELLIGENCE RULES:
- For “how much”, “what did I spend”, “earnings”, “balance”, “this month”, “last week”, “today”, “report”, “trend”, “remaining”, etc., inspect real data rather than answering from memory.
- Distinguish recorded work value from received cash. Do not call unpaid work income.
- For Finance Manager, distinguish expense, income and transfer. Transfers are not income or expense.
- Prefer concise, decision-useful answers with exact dates and PKR amounts when relevant.
- Use Roman Urdu/Hinglish naturally when the user does.
- Current user time zone and clock are supplied in the request. Resolve relative dates from that context.
- Never fabricate data or pretend a tool succeeded when it failed.`;

const tools = [
  { name: "get_my_profile", description: "Read the authenticated user's real social profile.", parametersJsonSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_my_posts", description: "Read the authenticated user's recent real posts.", parametersJsonSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 } }, required: ["limit"], additionalProperties: false } },
  { name: "get_notifications", description: "Read the user's recent real notifications.", parametersJsonSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20 } }, required: ["limit"], additionalProperties: false } },
  { name: "get_work_entries", description: "Read real active Work Entries, optionally filtered by item or size.", parametersJsonSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 }, item_name: { type: ["string", "null"] }, size: { type: ["string", "null"] } }, required: ["limit", "item_name", "size"], additionalProperties: false } },
  { name: "get_work_report", description: "Calculate real Work Entry totals for an inclusive date range. from_date and to_date are YYYY-MM-DD.", parametersJsonSchema: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" } }, required: ["from_date", "to_date"], additionalProperties: false } },
  { name: "get_work_finance", description: "Read real Work Finance payment/advance received records and totals, optionally for a date range.", parametersJsonSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 }, from_date: { type: ["string", "null"] }, to_date: { type: ["string", "null"] } }, required: ["limit", "from_date", "to_date"], additionalProperties: false } },
  { name: "get_diary_entries", description: "Read real Personal Diary entries, optionally searching their content/title.", parametersJsonSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 30 }, query: { type: ["string", "null"] } }, required: ["limit", "query"], additionalProperties: false } },
  { name: "get_finance_overview", description: "Read real Finance Manager accounts, categories, computed balances and recent transactions. Use this to resolve account/category names to IDs.", parametersJsonSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["limit"], additionalProperties: false } },
  { name: "get_finance_report", description: "Calculate real Finance Manager income, expenses, transfers and net cash flow for a date range.", parametersJsonSchema: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" } }, required: ["from_date", "to_date"], additionalProperties: false } },
  { name: "get_account_balance", description: "Calculate a real Finance Manager account balance from its opening balance and recorded transactions.", parametersJsonSchema: { type: "object", properties: { account_id: { type: "string" } }, required: ["account_id"], additionalProperties: false } },
  { name: "create_work_entry", description: "Prepare a real Work Entry confirmation. Required item_name, quantity and rate.", parametersJsonSchema: { type: "object", properties: { item_name: { type: "string" }, size: { type: ["string", "null"] }, quantity: { type: "number", exclusiveMinimum: 0 }, rate: { type: "number", minimum: 0 }, special_note: { type: ["string", "null"] }, occurred_at_iso: { type: ["string", "null"] } }, required: ["item_name", "size", "quantity", "rate", "special_note", "occurred_at_iso"], additionalProperties: false } },
  { name: "create_diary_entry", description: "Prepare a real Personal Diary confirmation. Content is required.", parametersJsonSchema: { type: "object", properties: { entry_type: { type: "string", enum: ["note", "todo", "idea", "journal", "anything", "event"] }, title: { type: ["string", "null"] }, content: { type: "string", minLength: 1 }, date_iso: { type: ["string", "null"] } }, required: ["entry_type", "title", "content", "date_iso"], additionalProperties: false } },
  { name: "create_work_finance_received", description: "Prepare a real Work Finance payment/advance received confirmation.", parametersJsonSchema: { type: "object", properties: { entry_type: { type: "string", enum: ["payment", "advance"] }, amount: { type: "number", exclusiveMinimum: 0 }, received_at_iso: { type: ["string", "null"] } }, required: ["entry_type", "amount", "received_at_iso"], additionalProperties: false } },
  { name: "create_finance_transaction", description: "Prepare a real Finance Manager expense, income or transfer confirmation. Resolve names to IDs with get_finance_overview first.", parametersJsonSchema: { type: "object", properties: { type: { type: "string", enum: ["expense", "income", "transfer"] }, amount: { type: "number", exclusiveMinimum: 0 }, account_id: { type: ["string", "null"] }, category_id: { type: ["string", "null"] }, from_account_id: { type: ["string", "null"] }, to_account_id: { type: ["string", "null"] }, date: { type: "string" }, note: { type: ["string", "null"] } }, required: ["type", "amount", "account_id", "category_id", "from_account_id", "to_account_id", "date", "note"], additionalProperties: false } }
];

async function createConversation(client: any, userId: string, conversationId: string | null, title: string) {
  if (conversationId) {
    const { data, error } = await client.from("ai_conversations").select("id").eq("id", conversationId).eq("user_id", userId).single();
    if (error || !data) throw new AiError(404, "CONVERSATION_NOT_FOUND", "That AI conversation could not be found.");
    return conversationId;
  }
  const { data, error } = await client.from("ai_conversations").insert({ user_id: userId, title: title.slice(0, 80), status: "active" }).select("id").single();
  if (error || !data) throw new AiError(500, "DATABASE_ERROR", error?.message || "Could not create AI conversation.");
  return data.id as string;
}

async function history(client: any, userId: string, conversationId: string) {
  const { data, error } = await client.from("ai_messages").select("role,content,tool_name,tool_call_id,metadata,created_at").eq("conversation_id", conversationId).eq("user_id", userId).in("role", ["user", "assistant", "tool"]).order("created_at", { ascending: false }).limit(MAX_HISTORY);
  if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
  return (data ?? []).reverse();
}

async function saveMessage(client: any, userId: string, conversationId: string, role: string, content: string, metadata: AnyRecord = {}, toolName: string | null = null, toolCallId: string | null = null) {
  const { data, error } = await client.from("ai_messages").insert({ user_id: userId, conversation_id: conversationId, role, content, metadata, tool_name: toolName, tool_call_id: toolCallId }).select("id").single();
  if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
  return data?.id as string | undefined;
}

async function saveToolCall(client: any, userId: string, conversationId: string, messageId: string | null, name: string, args: AnyRecord, result: unknown, status: string, errorMessage: string | null = null) {
  await client.from("ai_tool_calls").insert({ user_id: userId, conversation_id: conversationId, message_id: messageId, tool_name: name, arguments: args, result, status, error_message: errorMessage, completed_at: new Date().toISOString() });
}

async function pendingAction(client: any, userId: string, conversationId: string, toolName: string, args: AnyRecord, displaySummary: string, module: string, actionKind: string) {
  const { data, error } = await client.from("ai_pending_actions").insert({ user_id: userId, conversation_id: conversationId, tool_name: toolName, arguments: { ...args, __module: module, __action_kind: actionKind }, display_summary: displaySummary, status: "pending", expires_at: new Date(Date.now() + ACTION_TTL_MS).toISOString() }).select("id,display_summary,expires_at").single();
  if (error || !data) throw new AiError(500, "DATABASE_ERROR", error?.message || "Could not prepare the action.");
  return { confirmation_required: true, id: data.id, action_id: data.id, confirmation_id: data.id, display_summary: data.display_summary, expires_at: data.expires_at, module, action_kind: actionKind };
}

async function financeOverview(client: any, userId: string, limit: number) {
  const safeLimit = Math.min(Math.max(limit || 20, 1), 30);
  const [accounts, categories, transactions] = await Promise.all([
    client.from("expense_accounts").select("id,name,type,currency,opening_balance,created_at").eq("user_id", userId).order("created_at"),
    client.from("expense_categories").select("id,name,type,is_archived").eq("user_id", userId).eq("is_archived", false).order("name"),
    client.from("expense_transactions").select("id,type,amount,account_id,category_id,from_account_id,to_account_id,date,note").eq("user_id", userId).order("date", { ascending: false }).limit(Math.max(500, safeLimit * 20))
  ]);
  if (accounts.error) throw new AiError(500, "DATABASE_ERROR", accounts.error.message);
  if (categories.error) throw new AiError(500, "DATABASE_ERROR", categories.error.message);
  if (transactions.error) throw new AiError(500, "DATABASE_ERROR", transactions.error.message);
  const tx = transactions.data ?? [];
  const balances = (accounts.data ?? []).map((account: AnyRecord) => {
    let balance = number(account.opening_balance) || 0;
    for (const item of tx) {
      const amount = number(item.amount) || 0;
      if (item.type === "expense" && item.account_id === account.id) balance -= amount;
      if (item.type === "income" && item.account_id === account.id) balance += amount;
      if (item.type === "transfer" && item.from_account_id === account.id) balance -= amount;
      if (item.type === "transfer" && item.to_account_id === account.id) balance += amount;
    }
    return { ...account, computed_balance: balance };
  });
  return { accounts: balances, categories: categories.data ?? [], recent_transactions: tx.slice(0, safeLimit) };
}

async function runTool(client: any, userId: string, conversationId: string, name: string, args: AnyRecord, clientNow: string, clientTz: string) {
  if (name === "get_my_profile") {
    const { data, error } = await client.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id", userId).single();
    if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
    return data;
  }
  if (name === "get_my_posts") {
    const { data, error } = await client.from("posts").select("id,content,privacy,created_at,location_name").eq("profile_id", userId).order("created_at", { ascending: false }).limit(Math.min(Math.max(number(args.limit) || 10, 1), 10));
    if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
    return data ?? [];
  }
  if (name === "get_notifications") {
    const { data, error } = await client.from("notifications").select("id,type,sender_id,post_id,comment_id,is_read,created_at,metadata").eq("receiver_id", userId).order("created_at", { ascending: false }).limit(Math.min(Math.max(number(args.limit) || 10, 1), 20));
    if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
    return data ?? [];
  }
  const workerId = await workerProfileId(client, userId);
  if (name === "get_work_entries") {
    let query = client.from("work_entries").select("id,item_name,size,quantity,rate,total,special_note,occurred_at").eq("worker_profile_id", workerId).eq("work_context", "my_work").eq("lifecycle_state", "active").order("occurred_at", { ascending: false }).limit(Math.min(Math.max(number(args.limit) || 20, 1), 50));
    if (text(args.item_name)) query = query.ilike("item_name", `%${text(args.item_name)}%`);
    if (text(args.size)) query = query.ilike("size", `%${text(args.size)}%`);
    const { data, error } = await query;
    if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
    return data ?? [];
  }
  if (name === "get_work_report") {
    const from = text(args.from_date), to = text(args.to_date);
    const { data, error } = await client.from("work_entries").select("id,item_name,size,quantity,rate,total,special_note,occurred_at").eq("worker_profile_id", workerId).eq("work_context", "my_work").eq("lifecycle_state", "active").gte("occurred_at", `${from}T00:00:00+05:00`).lt("occurred_at", `${to}T00:00:00+05:00`).limit(5000);
    if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
    let pieces = 0, value = 0;
    for (const row of data ?? []) { pieces += number(row.quantity) || 0; value += number(row.total) || 0; }
    return { from_date: from, to_date: to, entry_count: (data ?? []).length, total_pieces: pieces, recorded_work_value: value, entries: data ?? [], timezone: clientTz, requested_at: clientNow };
  }
  if (name === "get_work_finance") {
    let query = client.from("worker_finance_received").select("id,entry_type,amount,received_at,created_at").eq("worker_profile_id", workerId).is("deleted_at", null).order("received_at", { ascending: false }).limit(Math.min(Math.max(number(args.limit) || 30, 1), 50));
    if (text(args.from_date)) query = query.gte("received_at", `${text(args.from_date)}T00:00:00+05:00`);
    if (text(args.to_date)) query = query.lt("received_at", `${text(args.to_date)}T00:00:00+05:00`);
    const { data, error } = await query;
    if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
    let total = 0, payments = 0, advances = 0;
    for (const row of data ?? []) { const amount = number(row.amount) || 0; total += amount; if (row.entry_type === "payment") payments += amount; if (row.entry_type === "advance") advances += amount; }
    return { total_received: total, payments, advances, records: data ?? [] };
  }
  if (name === "get_diary_entries") {
    let query = client.from("worker_diary_entries").select("id,entry_type,title,content,completed,created_at,updated_at,event_start_at,event_end_at,event_timezone").eq("worker_profile_id", workerId).order("updated_at", { ascending: false }).limit(Math.min(Math.max(number(args.limit) || 20, 1), 30));
    const q = text(args.query);
    if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
    return data ?? [];
  }
  if (name === "get_finance_overview") return financeOverview(client, userId, number(args.limit) || 20);
  if (name === "get_finance_report") {
    const from = text(args.from_date), to = text(args.to_date);
    const { data, error } = await client.from("expense_transactions").select("id,type,amount,account_id,category_id,from_account_id,to_account_id,date,note").eq("user_id", userId).gte("date", from).lt("date", to).order("date", { ascending: true }).limit(5000);
    if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
    let income = 0, expense = 0, transfer = 0;
    for (const row of data ?? []) { const amount = number(row.amount) || 0; if (row.type === "income") income += amount; else if (row.type === "expense") expense += amount; else if (row.type === "transfer") transfer += amount; }
    return { from_date: from, to_date: to, transaction_count: (data ?? []).length, income, expense, transfer, net_cash_flow: income - expense, transactions: data ?? [] };
  }
  if (name === "get_account_balance") {
    const overview = await financeOverview(client, userId, 30);
    const account = overview.accounts.find((item: AnyRecord) => item.id === text(args.account_id));
    if (!account) throw new AiError(404, "ACCOUNT_NOT_FOUND", "That Finance Manager account was not found.");
    return { id: account.id, name: account.name, currency: account.currency, opening_balance: account.opening_balance, balance: account.computed_balance };
  }
  if (name === "create_work_entry") {
    if (!text(args.item_name)) throw new AiError(400, "WORK_ITEM_REQUIRED", "Work item name is required.");
    if (!(number(args.quantity) > 0)) throw new AiError(400, "WORK_QUANTITY_REQUIRED", "Work quantity/pieces is required.");
    if (!(number(args.rate) >= 0)) throw new AiError(400, "WORK_RATE_REQUIRED", "Work rate is required.");
    const q = number(args.quantity), rate = number(args.rate);
    return pendingAction(client, userId, conversationId, name, { worker_profile_id: workerId, item_name: text(args.item_name), size: args.size ? text(args.size) : null, quantity: q, rate, special_note: args.special_note ? text(args.special_note) : null, occurred_at_iso: text(args.occurred_at_iso) || clientNow }, `Work Entry\n${text(args.item_name)}${args.size ? ` · Size ${text(args.size)}` : ""}\n${q} pieces × PKR ${rate.toLocaleString()} = PKR ${(q * rate).toLocaleString()}`, "work", "create_work_entry");
  }
  if (name === "create_diary_entry") {
    if (!text(args.content)) throw new AiError(400, "DIARY_CONTENT_REQUIRED", "Diary content is required.");
    return pendingAction(client, userId, conversationId, name, { worker_profile_id: workerId, entry_type: text(args.entry_type) || "note", title: args.title ? text(args.title) : null, content: text(args.content), date_iso: text(args.date_iso) || null }, `Personal Diary\n${args.title ? `${text(args.title)}\n` : ""}${text(args.content)}`, "personal_diary", "create_diary_entry");
  }
  if (name === "create_work_finance_received") {
    if (!(number(args.amount) > 0)) throw new AiError(400, "WORK_FINANCE_AMOUNT_REQUIRED", "Received amount is required.");
    return pendingAction(client, userId, conversationId, name, { worker_profile_id: workerId, entry_type: text(args.entry_type), amount: number(args.amount), received_at_iso: text(args.received_at_iso) || clientNow }, `Work Finance · ${text(args.entry_type)}\nReceived: PKR ${number(args.amount).toLocaleString()}`, "work_finance", "create_received");
  }
  if (name === "create_finance_transaction") {
    const type = text(args.type), amount = number(args.amount);
    if (!(amount > 0)) throw new AiError(400, "FINANCE_AMOUNT_REQUIRED", "Transaction amount is required.");
    if (type !== "transfer" && (!text(args.account_id) || !text(args.category_id))) throw new AiError(400, "FINANCE_ACCOUNT_CATEGORY_REQUIRED", "Account and category are required.");
    if (type === "transfer" && (!text(args.from_account_id) || !text(args.to_account_id) || text(args.from_account_id) === text(args.to_account_id))) throw new AiError(400, "TRANSFER_ACCOUNTS_REQUIRED", "From and to accounts are required and must be different.");
    const overview = await financeOverview(client, userId, 30);
    const accountMap = new Map(overview.accounts.map((item: AnyRecord) => [item.id, item]));
    const categoryMap = new Map(overview.categories.map((item: AnyRecord) => [item.id, item]));
    if (type !== "transfer" && !accountMap.has(text(args.account_id))) throw new AiError(404, "ACCOUNT_NOT_FOUND", "The selected Finance Manager account does not exist.");
    if (type !== "transfer" && !categoryMap.has(text(args.category_id))) throw new AiError(404, "CATEGORY_NOT_FOUND", "The selected Finance Manager category does not exist.");
    if (type === "transfer" && (!accountMap.has(text(args.from_account_id)) || !accountMap.has(text(args.to_account_id)))) throw new AiError(404, "ACCOUNT_NOT_FOUND", "One of the selected transfer accounts does not exist.");
    const accountName = type === "transfer" ? `${accountMap.get(text(args.from_account_id)).name} → ${accountMap.get(text(args.to_account_id)).name}` : accountMap.get(text(args.account_id)).name;
    const categoryName = type === "transfer" ? "Transfer" : categoryMap.get(text(args.category_id)).name;
    return pendingAction(client, userId, conversationId, name, { user_id: userId, type, amount, account_id: text(args.account_id) || null, category_id: text(args.category_id) || null, from_account_id: text(args.from_account_id) || null, to_account_id: text(args.to_account_id) || null, date: text(args.date), note: args.note ? text(args.note) : null }, `Finance Manager · ${type}\nPKR ${amount.toLocaleString()} · ${categoryName}\n${accountName} · ${text(args.date)}`, "finance_manager", "create_transaction");
  }
  throw new AiError(400, "UNREGISTERED_TOOL", "That AI tool is not registered.");
}

async function executePending(client: any, userId: string, actionId: string) {
  const { data: action, error } = await client.from("ai_pending_actions").select("id,tool_name,arguments,status,expires_at,conversation_id").eq("id", actionId).eq("user_id", userId).single();
  if (error || !action) throw new AiError(404, "PENDING_ACTION_NOT_FOUND", "The requested action no longer exists.");
  if (action.status !== "pending") throw new AiError(409, "ACTION_NOT_PENDING", `This action is already ${action.status}.`);
  if (new Date(action.expires_at).getTime() <= Date.now()) { await client.from("ai_pending_actions").update({ status: "expired" }).eq("id", actionId).eq("user_id", userId).eq("status", "pending"); throw new AiError(409, "CONFIRMATION_EXPIRED", "The confirmation expired. Please ask Work Social AI again."); }
  const x = action.arguments as AnyRecord;
  const workerId = await workerProfileId(client, userId);
  if (x.worker_profile_id && x.worker_profile_id !== workerId) throw new AiError(403, "ACTION_IDENTITY_MISMATCH", "The pending action does not belong to the current Work Identity.");

  let result: AnyRecord;
  if (action.tool_name === "create_work_entry") {
    const { data, error: insertError } = await client.from("work_entries").insert({ worker_profile_id: workerId, work_context: "my_work", item_name: text(x.item_name), size: x.size || null, quantity: number(x.quantity), rate: number(x.rate), special_note: x.special_note || null, occurred_at: text(x.occurred_at_iso) || new Date().toISOString() }).select("id,item_name,size,quantity,rate,total,special_note,occurred_at").single();
    if (insertError) throw new AiError(500, "DATABASE_ERROR", insertError.message);
    result = { success: true, work_entry: data };
  } else if (action.tool_name === "create_diary_entry") {
    const { data, error: insertError } = await client.from("worker_diary_entries").insert({ worker_profile_id: workerId, entry_type: text(x.entry_type) || "note", title: x.title || null, content: text(x.content), completed: text(x.entry_type) === "todo" ? false : null, event_timezone: DEFAULT_TIME_ZONE }).select("id,entry_type,title,content,completed,created_at,updated_at,event_start_at,event_end_at,event_timezone").single();
    if (insertError) throw new AiError(500, "DATABASE_ERROR", insertError.message);
    result = { success: true, entry: data };
  } else if (action.tool_name === "create_work_finance_received") {
    const { data, error: insertError } = await client.from("worker_finance_received").insert({ worker_profile_id: workerId, entry_type: text(x.entry_type), amount: number(x.amount), received_at: text(x.received_at_iso) || new Date().toISOString() }).select("id,entry_type,amount,received_at,created_at").single();
    if (insertError) throw new AiError(500, "DATABASE_ERROR", insertError.message);
    result = { success: true, work_finance: data };
  } else if (action.tool_name === "create_finance_transaction") {
    const overview = await financeOverview(client, userId, 30);
    const accounts = new Set(overview.accounts.map((item: AnyRecord) => item.id));
    const categories = new Set(overview.categories.map((item: AnyRecord) => item.id));
    if (x.type === "transfer") {
      if (!accounts.has(text(x.from_account_id)) || !accounts.has(text(x.to_account_id)) || text(x.from_account_id) === text(x.to_account_id)) throw new AiError(400, "TRANSFER_ACCOUNTS_INVALID", "The transfer accounts are no longer valid.");
    } else if (!accounts.has(text(x.account_id)) || !categories.has(text(x.category_id))) throw new AiError(400, "FINANCE_REFERENCES_INVALID", "The account or category is no longer valid.");
    const { data, error: insertError } = await client.from("expense_transactions").insert({ user_id: userId, type: text(x.type), amount: number(x.amount), account_id: x.account_id || null, category_id: x.category_id || null, from_account_id: x.from_account_id || null, to_account_id: x.to_account_id || null, date: text(x.date), note: x.note || null }).select("id,type,amount,account_id,category_id,from_account_id,to_account_id,date,note").single();
    if (insertError) throw new AiError(500, "DATABASE_ERROR", insertError.message);
    result = { success: true, entry: data };
  } else throw new AiError(400, "UNSUPPORTED_PENDING_ACTION", "Unsupported pending action.");

  const { error: updateError } = await client.from("ai_pending_actions").update({ status: "confirmed" }).eq("id", actionId).eq("user_id", userId).eq("status", "pending");
  if (updateError) throw new AiError(500, "DATABASE_ERROR", updateError.message);
  return result;
}

async function callGemini(contents: AnyRecord[]) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new AiError(500, "GEMINI_CONFIG_ERROR", "Gemini configuration is unavailable.");
  const body = { contents, systemInstruction: { parts: [{ text: SYSTEM }] }, tools: [{ functionDeclarations: tools }], generationConfig: { thinkingConfig: { thinkingLevel: "MINIMAL" }, maxOutputTokens: 768 } };
  let raw: Response;
  try { raw = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch (error) { throw new AiError(502, "GEMINI_NETWORK_ERROR", error instanceof Error ? error.message : "Gemini network request failed."); }
  let payload: AnyRecord = {};
  try { payload = await raw.json(); } catch { throw new AiError(502, "GEMINI_INVALID_RESPONSE", "Gemini returned an invalid response."); }
  if (!raw.ok) throw new AiError(502, "GEMINI_HTTP_ERROR", text(payload?.error?.message) || `Gemini HTTP ${raw.status}.`);
  return payload;
}

function parts(result: AnyRecord) { return result?.candidates?.[0]?.content?.parts ?? []; }
function functionCalls(result: AnyRecord) { return parts(result).filter((part: AnyRecord) => part.functionCall); }
function answerText(result: AnyRecord) { return parts(result).filter((part: AnyRecord) => typeof part.text === "string" && !part.thought).map((part: AnyRecord) => part.text).join("").trim(); }

async function handleChat(client: any, userId: string, body: AnyRecord) {
  const userMessage = text(body.message).replace(/\u0000/g, "");
  if (!userMessage) throw new AiError(400, "MESSAGE_EMPTY", "Message cannot be empty.");
  if (userMessage.length > 12000) throw new AiError(400, "MESSAGE_TOO_LONG", "Message must be 12,000 characters or fewer.");
  const { tz, now } = timeContext(body);
  const conversationId = await createConversation(client, userId, text(body.conversation_id) || null, userMessage);
  const previous = await history(client, userId, conversationId);
  const userMessageId = await saveMessage(client, userId, conversationId, "user", userMessage, { provider: "gemini", mode: "online", client_timezone: tz, client_now_iso: now });
  const contents: AnyRecord[] = previous.map((item: AnyRecord) => item.role === "user" ? { role: "user", parts: [{ text: item.content }] } : { role: item.role === "tool" ? "user" : "model", parts: [{ text: item.content }] });
  contents.push({ role: "user", parts: [{ text: `${userMessage}\n\n[Current client context]\ntimezone=${tz}\nnow=${now}` }] });

  let latest: AnyRecord = null;
  let pending: AnyRecord[] = [];
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    latest = await callGemini(contents);
    const calls = functionCalls(latest);
    if (!calls.length) break;
    const modelParts = parts(latest);
    contents.push({ role: "model", parts: modelParts });
    const responses: AnyRecord[] = [];
    for (const part of calls) {
      const name = text(part.functionCall.name);
      const args = (part.functionCall.args ?? {}) as AnyRecord;
      let result: unknown;
      let status = "executed";
      try {
        result = await runTool(client, userId, conversationId, name, args, now, tz);
        if ((result as AnyRecord)?.confirmation_required) { pending.push(result as AnyRecord); status = "awaiting_confirmation"; }
      } catch (error) {
        status = "failed";
        result = { error: error instanceof AiError ? error.message : error instanceof Error ? error.message : "Tool failed." };
      }
      await saveToolCall(client, userId, conversationId, userMessageId ?? null, name, args, result, status, status === "failed" ? text((result as AnyRecord)?.error) : null);
      responses.push({ functionResponse: { name, response: result } });
    }
    contents.push({ role: "user", parts: responses });
  }

  let message = answerText(latest);
  if (!message) message = pending.length ? "Action ready for your confirmation." : "I could not produce a complete answer from the available Work Social data.";
  if (pending.length) {
    const summaries = pending.map((item) => `• ${item.display_summary}`).join("\n");
    message = `${message}\n\n${summaries}\n\nConfirm karne par hi save hoga.`;
  }
  const assistantId = await saveMessage(client, userId, conversationId, "assistant", message, { provider: "gemini", mode: "online", pending_action_count: pending.length });
  await client.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", userId);
  return { conversation_id: conversationId, message, pending_actions: pending, provider: "gemini", mode: "online", assistant_message_id: assistantId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  try {
    const { client, userId } = await authenticate(req);
    const body = await req.json();
    if (body?.action === "confirm") return response(200, await executePending(client, userId, text(body.action_id)));
    if (body?.action === "cancel") {
      const actionId = text(body.action_id);
      const { data, error } = await client.from("ai_pending_actions").update({ status: "cancelled" }).eq("id", actionId).eq("user_id", userId).eq("status", "pending").select("id,status").maybeSingle();
      if (error) throw new AiError(500, "DATABASE_ERROR", error.message);
      if (!data) throw new AiError(404, "PENDING_ACTION_NOT_FOUND", "The requested action no longer exists or is already completed.");
      return response(200, { success: true, cancelled: true, id: data.id });
    }
    return response(200, await handleChat(client, userId, body));
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError(500, "AI_INTERNAL_ERROR", error instanceof Error ? error.message : "Work Social AI could not complete the request.");
    return response(e.status, { error: e.message, code: e.code });
  }
});
