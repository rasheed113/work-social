import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { updateAvatar } from '../api/updateAvatar';

const BUCKET = 'avatars';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CROP_SIZE = 512;

interface AvatarUploaderProps {
  userId: string;
  avatarUrl: string | null;
  onUploaded: (publicUrl: string) => void;
}

export function AvatarUploader({ userId, avatarUrl, onUploaded }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPreviewUrl(avatarUrl), [avatarUrl]);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function chooseFile() {
    inputRef.current?.click();
  }

  function resetAdjustment() {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }

  function cancelSelection() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setSelectedFile(null);
    setPreviewUrl(avatarUrl);
    setError(null);
    resetAdjustment();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setError(null);

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Avatar must be 10 MB or smaller.');
      return;
    }

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const localPreview = URL.createObjectURL(file);
    previewRef.current = localPreview;
    setSelectedFile(file);
    setPreviewUrl(localPreview);
    resetAdjustment();
  }

  async function createAdjustedImage(file: File): Promise<Blob> {
    const image = new Image();
    const sourceUrl = URL.createObjectURL(file);
    try {
      image.src = sourceUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to read selected image.'));
      });

      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const scale = (CROP_SIZE / sourceSize) / zoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const canvas = document.createElement('canvas');
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image adjustment is not supported by this browser.');

      const maxX = Math.max(0, (drawWidth - CROP_SIZE) / 2);
      const maxY = Math.max(0, (drawHeight - CROP_SIZE) / 2);
      const x = (CROP_SIZE - drawWidth) / 2 + (offsetX / 100) * maxX;
      const y = (CROP_SIZE - drawHeight) / 2 + (offsetY / 100) * maxY;
      context.drawImage(image, x, y, drawWidth, drawHeight);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create adjusted avatar.')), 'image/jpeg', 0.9);
      });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function saveAdjustedAvatar() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      const adjustedBlob = await createAdjustedImage(selectedFile);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, adjustedBlob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: profileError } = await updateAvatar(userId, data.publicUrl);
      if (profileError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw profileError;
      }

      onUploaded(data.publicUrl);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      setSelectedFile(null);
      setPreviewUrl(data.publicUrl);
      resetAdjustment();
    } catch (uploadError) {
      setPreviewUrl(avatarUrl);
      setSelectedFile(null);
      setError(uploadError instanceof Error ? uploadError.message : 'Avatar upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profile-avatar-editor" style={{ width: '100%', maxWidth: 320, overflow: 'hidden' }}>
      <div
        className="profile-avatar-preview"
        style={{
          width: 160,
          height: 160,
          maxWidth: '100%',
          overflow: 'hidden',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: '#eee',
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Profile avatar preview"
            style={selectedFile ? {
              width: `${Math.max(100, zoom * 100)}%`,
              height: `${Math.max(100, zoom * 100)}%`,
              maxWidth: 'none',
              maxHeight: 'none',
              transform: `translate(${offsetX / 5}%, ${offsetY / 5}%)`,
              objectFit: 'cover',
              display: 'block',
            } : {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <span aria-hidden="true">👤</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={handleFileChange}
      />

      <button type="button" onClick={chooseFile} disabled={uploading}>
        Choose profile photo
      </button>

      {selectedFile && !uploading && (
        <div>
          <label>
            Zoom
            <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          </label>
          <label>
            Horizontal
            <input type="range" min="-100" max="100" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} />
          </label>
          <label>
            Vertical
            <input type="range" min="-100" max="100" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} />
          </label>
          <button type="button" onClick={saveAdjustedAvatar}>Use this photo</button>
          <button type="button" onClick={cancelSelection}>Cancel</button>
        </div>
      )}

      {uploading && <p>Saving profile photo…</p>}
      <p>JPG, PNG, WebP or GIF · max 10 MB</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
