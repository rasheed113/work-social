import { useEffect, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

type Report={id:string;work_entry_id:string;reported_at:string;read_at:string|null};
function teamNumber(){const m=window.location.pathname.match(/^\/work\/team-work\/(\d+)(?:\/|$)/);return m?.[1]??null}
export function WorkerTeamReportNotice(){
 const [reports,setReports]=useState<Report[]>([]);
 const load=async()=>{const number=teamNumber();if(!number)return;const r=await supabase.from('contractor_team_work_reports').select('id,work_entry_id,reported_at,read_at').is('read_at',null).order('reported_at',{ascending:false}).limit(20);if(!r.error)setReports((r.data??[]) as Report[])};
 useEffect(()=>{void load();const i=window.setInterval(()=>void load(),5000);return()=>window.clearInterval(i)},[]);
 if(!reports.length)return null;
 const first=reports[0];
 return <button type="button" className="worker-team-report-notice" onClick={()=>navigate(`/work/team-work/${teamNumber()}?report_entry=${encodeURIComponent(first.work_entry_id)}&report_id=${encodeURIComponent(first.id)}`)}><span className="worker-team-report-badge">{reports.length}</span><span><strong>{reports.length===1?'1 Report':'Reports'}</strong><small>Contractor ne Team Work entry report ki hai · Tap to open</small></span><span className="worker-team-report-arrow">›</span><style>{`.worker-team-report-notice{width:100%;box-sizing:border-box;margin:0 0 10px;padding:10px 12px;display:flex;align-items:center;gap:9px;text-align:left;border:1px solid rgba(239,68,68,.28);border-radius:14px;background:linear-gradient(145deg,#fff,#fff1f2);box-shadow:0 10px 22px rgba(220,38,38,.11),inset 0 1px 0 #fff;color:#172033;cursor:pointer}.worker-team-report-badge{min-width:28px;height:28px;padding:0 7px;box-sizing:border-box;display:grid;place-items:center;border-radius:999px;background:#dc2626;color:#fff;font-size:10px;font-weight:950}.worker-team-report-notice strong{display:block;font-size:10px}.worker-team-report-notice small{display:block;margin-top:2px;color:#64748b;font-size:8px;line-height:1.35}.worker-team-report-arrow{margin-left:auto;color:#b91c1c;font-size:22px;font-weight:950}`}</style></button>
}
