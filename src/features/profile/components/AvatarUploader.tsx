import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { updateAvatar } from '../api/updateAvatar';

const BUCKET = 'avatars';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface AvatarUploaderProps {
  userId: string;
  avatarUrl: string | null;
  onUploaded: (publicUrl: string) => void;
}

export function AvatarUploader({ userId, avatarUrl, onUploaded }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPreviewUrl(avatarUrl), [avatarUrl]);

  function chooseFile() {
    inputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
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

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
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
    } catch (uploadError) {
      setPreviewUrl(avatarUrl);
      setError(uploadError instanceof Error ? uploadError.message : 'Avatar upload failed.');
    } finally {
      URL.revokeObjectURL(localPreview);
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
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Profile avatar"
            style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', objectFit: 'cover', display: 'block' }}
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
        onChange={(event) => void handleFileChange(event)}
      />

      <button type="button" onClick={chooseFile} disabled={uploading}>
        {uploading ? 'Uploading…' : 'Choose profile photo'}
      </button>

      <p>JPG, PNG, WebP or GIF · max 10 MB</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
