import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { updateAvatar } from '../api/updateAvatar';

const BUCKET = 'avatars';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CROP_SIZE = 512;

interface AvatarUploaderProps { userId: string; avatarUrl: string | null; onUploaded: (publicUrl: string) => void; }

export function AvatarUploader({ userId, avatarUrl, onUploaded }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null); const previewRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl); const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1); const [offsetX, setOffsetX] = useState(0); const [offsetY, setOffsetY] = useState(0);
  const [uploading, setUploading] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => setPreviewUrl(avatarUrl), [avatarUrl]);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  function chooseFile() { inputRef.current?.click(); }
  function resetAdjustment() { setZoom(1); setOffsetX(0); setOffsetY(0); }
  function cancelSelection() { if (previewRef.current) URL.revokeObjectURL(previewRef.current); previewRef.current = null; setSelectedFile(null); setPreviewUrl(avatarUrl); setError(null); resetAdjustment(); }
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; setError(null); if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > MAX_FILE_SIZE) { setError('Avatar must be 10 MB or smaller.'); return; }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current); const localPreview = URL.createObjectURL(file); previewRef.current = localPreview;
    setSelectedFile(file); setPreviewUrl(localPreview); resetAdjustment();
  }
  async function createAdjustedImage(file: File): Promise<Blob> {
    const image = new Image(); const sourceUrl = URL.createObjectURL(file);
    try {
      image.src = sourceUrl; await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to read selected image.')); });
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight); const scale = (CROP_SIZE / sourceSize) / zoom;
      const drawWidth = image.naturalWidth * scale; const drawHeight = image.naturalHeight * scale; const canvas = document.createElement('canvas'); canvas.width = CROP_SIZE; canvas.height = CROP_SIZE;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Image adjustment is not supported by this browser.');
      const maxX = Math.max(0, (drawWidth - CROP_SIZE) / 2); const maxY = Math.max(0, (drawHeight - CROP_SIZE) / 2);
      const x = (CROP_SIZE - drawWidth) / 2 + (offsetX / 100) * maxX; const y = (CROP_SIZE - drawHeight) / 2 + (offsetY / 100) * maxY; context.drawImage(image, x, y, drawWidth, drawHeight);
      return await new Promise<Blob>((resolve, reject) => { canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create adjusted avatar.')), 'image/jpeg', 0.9); });
    } finally { URL.revokeObjectURL(sourceUrl); }
  }
  async function saveAdjustedAvatar() {
    if (!selectedFile) return; setUploading(true); setError(null);
    try {
      const adjustedBlob = await createAdjustedImage(selectedFile); const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, adjustedBlob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }); if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path); const { error: profileError } = await updateAvatar(userId, data.publicUrl);
      if (profileError) { await supabase.storage.from(BUCKET).remove([path]); throw profileError; }
      onUploaded(data.publicUrl); if (previewRef.current) URL.revokeObjectURL(previewRef.current); previewRef.current = null; setSelectedFile(null); setPreviewUrl(data.publicUrl); resetAdjustment();
    } catch (uploadError) { setPreviewUrl(avatarUrl); setSelectedFile(null); setError(uploadError instanceof Error ? uploadError.message : 'Avatar upload failed.'); }
    finally { setUploading(false); }
  }

  return <div className="profile-avatar-editor premium-avatar-editor">
    <style>{`
      .premium-avatar-editor { width:100%; max-width:320px; min-width:0; box-sizing:border-box; display:grid; justify-items:center; gap:10px; padding:14px; border:1px solid rgba(99,102,241,.14); border-radius:16px; background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(244,247,255,.92)); box-shadow:0 7px 20px rgba(15,23,42,.055),inset 0 1px 0 rgba(255,255,255,.98); overflow:hidden; }
      .premium-avatar-editor .profile-avatar-preview { position:relative; width:160px; height:160px; max-width:100%; overflow:hidden; border:4px solid white; border-radius:50%; display:grid; place-items:center; background:linear-gradient(135deg,#eef2ff,#ecfeff); box-shadow:0 9px 25px rgba(79,70,229,.18),0 0 0 5px rgba(109,93,252,.07); }
      .premium-avatar-editor .profile-avatar-preview::after { content:''; position:absolute; inset:0; border-radius:50%; box-shadow:inset 0 0 22px rgba(109,93,252,.10); pointer-events:none; }
      .premium-avatar-editor > button { border:0; border-radius:999px; padding:9px 16px; font-weight:850; color:white; background:linear-gradient(135deg,#6d5dfc,#3b82f6,#22c1dc); box-shadow:0 7px 17px rgba(79,70,229,.20); cursor:pointer; }
      .premium-avatar-editor > button:disabled { opacity:.55; cursor:default; }
      .premium-avatar-editor > div:not(.profile-avatar-preview) { width:100%; min-width:0; display:grid; gap:8px; padding:10px; box-sizing:border-box; border:1px solid rgba(99,102,241,.11); border-radius:12px; background:rgba(255,255,255,.72); }
      .premium-avatar-editor label { display:grid; gap:4px; font-size:12px; font-weight:800; color:#334155; }
      .premium-avatar-editor input[type=range] { width:100%; accent-color:#6d5dfc; }
      .premium-avatar-editor > div:not(.profile-avatar-preview) button { border:0; border-radius:999px; padding:8px 12px; font-weight:800; cursor:pointer; background:rgba(15,23,42,.07); color:#17202a; }
      .premium-avatar-editor > div:not(.profile-avatar-preview) button:first-of-type { background:linear-gradient(135deg,#6d5dfc,#22c1dc); color:white; box-shadow:0 5px 13px rgba(79,70,229,.16); }
      .premium-avatar-editor > p { margin:0; text-align:center; font-size:12px; line-height:1.35; opacity:.58; }
      .premium-avatar-editor > p[role=alert] { color:#b4232d; opacity:1; font-weight:700; }
    `}</style>
    <div className="profile-avatar-preview">
      {previewUrl ? <img src={previewUrl} alt="Profile avatar preview" style={selectedFile ? { width:`${Math.max(100,zoom*100)}%`, height:`${Math.max(100,zoom*100)}%`, maxWidth:'none', maxHeight:'none', transform:`translate(${offsetX/5}%, ${offsetY/5}%)`, objectFit:'cover', display:'block' } : { width:'100%', height:'100%', objectFit:'cover', display:'block' }} /> : <span aria-hidden="true">👤</span>}
    </div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={handleFileChange}/>
    <button type="button" onClick={chooseFile} disabled={uploading}>📷 Choose profile photo</button>
    {selectedFile && !uploading && <div>
      <label>Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event)=>setZoom(Number(event.target.value))}/></label>
      <label>Horizontal<input type="range" min="-100" max="100" value={offsetX} onChange={(event)=>setOffsetX(Number(event.target.value))}/></label>
      <label>Vertical<input type="range" min="-100" max="100" value={offsetY} onChange={(event)=>setOffsetY(Number(event.target.value))}/></label>
      <button type="button" onClick={saveAdjustedAvatar}>✓ Use this photo</button><button type="button" onClick={cancelSelection}>Cancel</button>
    </div>}
    {uploading && <p>Saving profile photo…</p>}
    <p>JPG, PNG, WebP or GIF · max 10 MB</p>
    {error && <p role="alert">{error}</p>}
  </div>;
}
