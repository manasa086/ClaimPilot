import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = url && key ? createClient(url, key) : null;
export const storageConfigured = !!supabase;

const BUCKET = 'claim-photos';
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 years

export interface StoredPhoto {
  evidenceLabel: string;
  name: string;
  path: string;
  signedUrl: string;
  size: number;
  isImage: boolean;
}

export async function uploadPhoto(
  reportId: string,
  evidenceLabel: string,
  file: File,
): Promise<StoredPhoto | null> {
  if (!supabase) return null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${reportId}/${evidenceLabel}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) {
    console.error('[Storage] Upload failed:', error.message);
    return null;
  }

  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return {
    evidenceLabel,
    name: file.name,
    path,
    signedUrl: data?.signedUrl ?? '',
    size: file.size,
    isImage: file.type.startsWith('image/'),
  };
}

export async function deletePhoto(path: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('[Storage] Delete failed:', error.message);
}

// Fetches a remote image and returns a base64 data URL (needed for PDF export and AI analysis)
export async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
