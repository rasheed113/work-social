import { useEffect, useRef, useState } from 'react';
import { createPost, type PostAttachmentInput, type PostLocationInput } from '../api/createPost';

interface CreatePostFormProps { profileId: string; onCreated: () => void; }
type SelectedFile = PostAttachmentInput & { preview: string };

const cardStyle: React.CSSProperties = { position: 'relative', overflow: 'hidden', padding: 10, border: '1px solid rgba(99,102,241,.14)', borderRadius: 16, background: 'linear-gradient(145deg, rgba(255,255,255,.99), rgba(247,248,255,.97))', boxShadow: '0 7px 18px rgba(15,23,42,.065), inset 0 1px 0 rgba(255,255,255,.98)' };
const actionStyle: React.CSSProperties = { minHeight: 30, padding: '0 9px', border: '1px solid rgba(99,102,241,.12)', borderRadius: 10, background: 'linear-gradient(145deg, #fff, #f1f4ff)', color: '#475569', fontWeight: 800, fontSize: 12, boxShadow: '0 3px 8px rgba(15,23,42,.055), inset 0 1px 1px rgba(255,255,255,.98)', cursor: 'pointer' };

export function CreatePostForm({ profileId, onCreated }: CreatePostFormProps) {
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [location, setLocation] = useState<PostLocationInput | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => selectedFiles.forEach((item) => URL.revokeObjectURL(item.preview)), [selectedFiles]);

  function chooseMedia() { mediaInputRef.current?.click(); }
  function chooseFile() { fileInputRef.current?.click(); }
  function addFiles(event: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'video' | 'file') {
    const next = Array.from(event.target.files ?? []).map((file) => ({ file, kind, preview: URL.createObjectURL(file) }));
    setSelectedFiles((current) => [...current, ...next]); event.target.value = '';
  }
  function onMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? []).map((file) => ({ file, kind: file.type.startsWith('video/') ? 'video' as const : 'image' as const, preview: URL.createObjectURL(file) }));
    setSelectedFiles((current) => [...current, ...next]); event.target.value = '';
  }
  function getLocation() {
    if (!navigator.geolocation) return setError('Location is not supported by this browser.');
    setLocationLoading(true); setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationLoading(false); },
      (geoError) => { setError(geoError.message || 'Unable to get your location.'); setLocationLoading(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  async function submit() {
    setSaving(true); setError(null);
    const { error: createError } = await createPost(profileId, content, selectedFiles.map(({ file, kind }) => ({ file, kind })), location);
    if (createError) { setError(createError.message); setSaving(false); return; }
    selectedFiles.forEach((item) => URL.revokeObjectURL(item.preview));
    setSelectedFiles([]); setLocation(null); setContent(''); setSaving(false); onCreated();
  }
  const canPost = Boolean(content.trim() || selectedFiles.length || location);
  return <section style={cardStyle}>
    <div aria-hidden="true" style={{ position: 'absolute', top: -75, right: -65, width: 155, height: 155, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,.11), rgba(34,211,238,0))', pointerEvents: 'none' }} />
    <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
      <div style={{ minWidth: 0 }}><h2 style={{ margin: 0, fontSize: 15, lineHeight: 1.1, fontWeight: 900, color: '#17202a', letterSpacing: '-.015em', textShadow: '0 1px 0 rgba(255,255,255,.95), 0 2px 6px rgba(23,32,42,.07)' }}>Create post</h2><small style={{ display: 'block', marginTop: 2, color: '#64748b', fontWeight: 650, fontSize: 10.5, lineHeight: 1.2 }}>Share something with your community</small></div>
      <span aria-hidden="true" style={{ width: 27, height: 27, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.45)', borderRadius: 9, color: '#fff', fontSize: 13, background: 'linear-gradient(145deg, #67e8f9, #6366f1 58%, #8b5cf6)', boxShadow: 'inset 0 2px 2px rgba(255,255,255,.5), inset 0 -3px 6px rgba(49,46,129,.2), 0 5px 11px rgba(99,102,241,.18)' }}>✦</span>
    </header>
    <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="What's happening?" disabled={saving} style={{ width: '100%', minHeight: 46, height: 50, boxSizing: 'border-box', resize: 'vertical', padding: '7px 9px', border: '1px solid rgba(100,116,139,.15)', borderRadius: 11, outline: 'none', background: 'rgba(255,255,255,.9)', color: '#17202a', fontSize: 13, lineHeight: 1.3, boxShadow: 'inset 0 1px 6px rgba(15,23,42,.025), 0 2px 7px rgba(15,23,42,.025)' }} />
    <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={onMedia} />
    <input ref={fileInputRef} type="file" hidden onChange={(event) => addFiles(event, 'file')} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', margin: '6px 0 0' }}>
      <button type="button" onClick={chooseMedia} disabled={saving} style={actionStyle}>📷 Photo / Video</button>
      <button type="button" onClick={chooseFile} disabled={saving} style={actionStyle}>📎 File</button>
      <button type="button" onClick={getLocation} disabled={saving || locationLoading} style={actionStyle}>📍 {locationLoading ? 'Getting location…' : 'Location'}</button>
      <button type="button" onClick={() => void submit()} disabled={saving || !canPost} style={{ marginLeft: 'auto', minHeight: 30, padding: '0 13px', border: '1px solid rgba(255,255,255,.36)', borderRadius: 10, color: '#fff', fontWeight: 900, fontSize: 12, background: saving || !canPost ? 'linear-gradient(145deg, #94a3b8, #64748b)' : 'linear-gradient(145deg, #06b6d4, #2563eb 52%, #7c3aed)', boxShadow: saving || !canPost ? 'none' : 'inset 0 1px 2px rgba(255,255,255,.3), inset 0 -3px 6px rgba(30,64,175,.22), 0 5px 11px rgba(37,99,235,.18)', cursor: saving || !canPost ? 'not-allowed' : 'pointer' }}>{saving ? 'Posting…' : 'Post'}</button>
    </div>
    {selectedFiles.length > 0 && <div style={{ display: 'grid', gap: 6, marginTop: 7, marginBottom: 7 }}>
      {selectedFiles.map((item, index) => <div key={`${item.file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, padding: 6, borderRadius: 11, background: 'rgba(241,245,249,.8)' }}>
        {item.kind === 'image' ? <img src={item.preview} alt={item.file.name} width={64} height={64} style={{ objectFit: 'cover', borderRadius: 9, flexShrink: 0 }} /> : item.kind === 'video' ? <video src={item.preview} width={110} height={64} controls style={{ maxWidth: '100%', borderRadius: 9, flexShrink: 0 }} /> : <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>📎 {item.file.name}</span>}
        <button type="button" onClick={() => setSelectedFiles((current) => current.filter((_, i) => i !== index))} disabled={saving} style={{ ...actionStyle, marginLeft: 'auto', minHeight: 28, padding: '0 8px', flexShrink: 0 }}>Remove</button>
      </div>)}
    </div>}
    {location && <p style={{ margin: '6px 0 0', padding: '7px 9px', borderRadius: 10, background: 'rgba(16,185,129,.08)', color: '#047857', fontSize: 11, fontWeight: 700 }}>📍 Location attached ({location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}) <button type="button" onClick={() => setLocation(null)} disabled={saving} style={{ ...actionStyle, minHeight: 27, marginLeft: 5, padding: '0 8px', color: '#047857' }}>Remove</button></p>}
    {error && <p role="alert" style={{ margin: '6px 0 0', padding: '7px 9px', borderRadius: 10, background: 'rgba(239,68,68,.08)', color: '#b91c1c', fontSize: 11, fontWeight: 700 }}>{error}</p>}
  </section>;
}
