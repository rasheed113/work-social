import { ContractorTeamPageV2 } from './ContractorTeamPageV2';

interface Props { profileId: string; teamNumber: string; }

export function ContractorTeamPage({ profileId, teamNumber }: Props) {
  return <div className="contractor-team-page"><div style={{display:'flex',justifyContent:'flex-end',gap:7,padding:'8px 12px 0',position:'relative',zIndex:2}}><button type="button" className="ctd-add" aria-label="Add team members">＋ Add Members</button><button type="button" className="ctd-action" aria-label="Open team members">⋮</button></div><ContractorTeamPageV2 profileId={profileId} teamNumber={teamNumber}/></div>;
}
