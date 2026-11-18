import { getSupabaseClient } from '../../lib/supabase/client';

export const PUBLIC_MUSIC_BUCKET = 'public-music';
export const MAX_PUBLIC_AUDIO_SIZE = 50 * 1024 * 1024;

export interface PublicMusicTrack {
  id: string;
  admin_id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: string;
  cover_url: string;
  audio_path: string;
  created_at: string;
}

export interface NewPublicMusicTrack {
  title: string;
  artist: string;
  album: string;
  genre: string;
  coverUrl: string;
  file: File;
}

export function getPublicMusicAudioUrl(track: PublicMusicTrack): string {
  return getSupabaseClient().storage.from(PUBLIC_MUSIC_BUCKET).getPublicUrl(track.audio_path).data
    .publicUrl;
}

export async function loadPublicMusic(): Promise<PublicMusicTrack[]> {
  const { data, error } = await getSupabaseClient()
    .from('public_music')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    const missingCatalogTable =
      error.code === 'PGRST205' ||
      (error.message.includes('public.public_music') && error.message.includes('schema cache'));
    if (missingCatalogTable) {
      throw new Error(
        'The API for this app cannot find public.public_music. Run the full catalog migration in the Supabase project configured by VITE_SUPABASE_URL, not another project. If it already ran in that exact project, refresh that project’s schema cache.',
      );
    }
    throw new Error(`Could not load the public music catalog: ${error.message}`);
  }
  return data ?? [];
}

export async function publishPublicMusic(
  adminId: string,
  input: NewPublicMusicTrack,
): Promise<PublicMusicTrack> {
  if (!input.file.size || input.file.size > MAX_PUBLIC_AUDIO_SIZE) {
    throw new Error('Choose an audio file that is no larger than 50 MB.');
  }

  const extension = input.file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!/^(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(extension)) {
    throw new Error('Use an MP3, WAV, OGG, M4A, AAC, FLAC, or WEBM audio file.');
  }

  const client = getSupabaseClient();
  const path = `${adminId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage
    .from(PUBLIC_MUSIC_BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`);

  const { data, error: insertError } = await client
    .from('public_music')
    .insert({
      admin_id: adminId,
      title: input.title.trim(),
      artist: input.artist.trim(),
      album: input.album.trim(),
      genre: input.genre.trim() || 'Other',
      cover_url: input.coverUrl.trim(),
      audio_path: path,
    })
    .select('*')
    .single();

  if (insertError) {
    const { error: cleanupError } = await client.storage.from(PUBLIC_MUSIC_BUCKET).remove([path]);
    const cleanupNotice = cleanupError
      ? ` The uploaded file also needs cleanup: ${cleanupError.message}`
      : '';
    throw new Error(`Could not publish track: ${insertError.message}.${cleanupNotice}`);
  }

  return data;
}

export async function deletePublicMusicTrack(track: PublicMusicTrack): Promise<void> {
  const client = getSupabaseClient();
  const { error: deleteError } = await client.from('public_music').delete().eq('id', track.id);

  if (deleteError)
    throw new Error(`Could not remove track from the public catalog: ${deleteError.message}`);

  const { error: storageError } = await client.storage
    .from(PUBLIC_MUSIC_BUCKET)
    .remove([track.audio_path]);

  if (storageError) {
    throw new Error(
      `Track was unpublished, but its audio file could not be removed: ${storageError.message}`,
    );
  }
}
