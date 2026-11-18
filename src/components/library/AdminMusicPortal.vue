<template>
  <q-page v-if="!checkingSession && !session" class="auth-page">
    <AuthPanel initial-mode="login" :setup-error="authError" />
  </q-page>
  <q-page v-else class="admin-page">
    <header class="admin-header">
      <a class="admin-brand" href="/"
        ><span class="admin-logo"><q-icon name="graphic_eq" /></span>sonora <span>STUDIO</span></a
      >
      <div class="header-actions">
        <button v-if="session" aria-label="Sign out" @click="signOut">
          <q-icon name="logout" /> Sign out
        </button>
      </div>
    </header>

    <main class="admin-main">
      <section v-if="checkingSession || redirectingToLibrary" class="portal-state">
        <q-spinner size="30px" /><span>{{
          checkingSession ? 'Checking your account…' : 'Opening your library…'
        }}</span>
      </section>

      <section v-else-if="!isAdmin" class="sign-in-card">
        <span class="admin-logo admin-logo-large admin-logo-warning"
          ><q-icon name="gpp_bad"
        /></span>
        <p class="portal-kicker">ACCESS RESTRICTED</p>
        <h1>Admin access required</h1>
        <p class="portal-description">
          Only {{ ADMIN_EMAIL }} with the trusted Sonora admin role can manage the public catalog.
        </p>
        <div class="signed-in-email">{{ session?.user.email }}</div>
        <div v-if="authError" class="portal-error" role="alert">{{ authError }}</div>
        <button class="submit-button" @click="redirectToLibrary">Open my library</button>
        <button class="submit-button" @click="signOut">Sign out</button>
      </section>

      <template v-else>
        <section class="portal-heading">
          <div>
            <p class="portal-kicker"><span /> CONTENT MANAGEMENT</p>
            <h1>Music <span>Studio</span></h1>
            <p class="portal-description">
              Upload tracks once. They’re published to the public catalog for everyone to hear.
            </p>
          </div>
          <div class="catalog-stat">
            <strong>{{ tracks.length }}</strong
            ><span>PUBLIC TRACKS</span>
          </div>
        </section>

        <div class="studio-layout">
          <section class="studio-panel upload-panel">
            <div class="panel-heading">
              <span class="panel-icon"><q-icon name="library_add" /></span>
              <div>
                <h2>Publish a track</h2>
                <p>Audio files up to 50 MB</p>
              </div>
            </div>
            <div v-if="portalError" class="portal-error" role="alert">{{ portalError }}</div>
            <div v-if="successMessage" class="portal-success" role="status">
              {{ successMessage }}
            </div>
            <q-form class="admin-form" @submit.prevent="publish">
              <label
                >Song title *<q-input
                  v-model.trim="form.title"
                  outlined
                  dense
                  maxlength="120"
                  required
              /></label>
              <div class="form-pair">
                <label
                  >Artist<q-input
                    v-model.trim="form.artist"
                    outlined
                    dense
                    maxlength="120"
                    placeholder="Unknown artist"
                /></label>
                <label
                  >Genre<q-input
                    v-model.trim="form.genre"
                    outlined
                    dense
                    maxlength="60"
                    placeholder="Pop"
                /></label>
              </div>
              <label
                >Album or collection<q-input
                  v-model.trim="form.album"
                  outlined
                  dense
                  maxlength="120"
                  placeholder="Optional"
              /></label>
              <label
                >Cover image URL<q-input
                  v-model.trim="form.coverUrl"
                  outlined
                  dense
                  type="url"
                  placeholder="https://…"
              /></label>
              <label class="file-label"
                >Audio file *
                <input
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,audio/*"
                  required
                  @change="selectFile"
                />
                <span class="file-drop"
                  ><q-icon name="upload_file" /><strong>{{
                    selectedFile?.name || 'Choose audio file'
                  }}</strong
                  ><small>{{
                    selectedFile
                      ? formatSize(selectedFile.size)
                      : 'MP3, WAV, OGG, M4A, AAC, FLAC or WEBM · max 50 MB'
                  }}</small></span
                >
              </label>
              <q-btn
                class="submit-button"
                unelevated
                no-caps
                :label="uploading ? 'Uploading and publishing…' : 'Publish to public catalog'"
                type="submit"
                :loading="uploading"
                :disable="!selectedFile"
              />
            </q-form>
            <p class="privacy-note">
              <q-icon name="public" /> Published tracks are publicly playable. Upload only audio you
              have permission to share.
            </p>
          </section>

          <section class="studio-panel published-panel">
            <div class="panel-heading published-heading">
              <span class="panel-icon"><q-icon name="queue_music" /></span>
              <div>
                <h2>Published tracks</h2>
                <p>Visible to everyone on the public page</p>
              </div>
              <button
                class="icon-button"
                aria-label="Refresh tracks"
                :disabled="loadingTracks"
                @click="loadTracks"
              >
                <q-icon name="refresh" />
              </button>
            </div>
            <div v-if="listError" class="portal-error" role="alert">{{ listError }}</div>
            <div v-else-if="loadingTracks" class="portal-state">
              <q-spinner size="24px" /><span>Loading tracks…</span>
            </div>
            <div v-else-if="!tracks.length" class="portal-empty">
              <q-icon name="music_off" /><strong>No public tracks yet</strong
              ><span>Upload your first track to start the catalog.</span>
            </div>
            <ul v-else class="published-list">
              <li v-for="track in tracks" :key="track.id">
                <span
                  class="list-cover"
                  :style="
                    track.cover_url ? { backgroundImage: `url('${track.cover_url}')` } : undefined
                  "
                  ><q-icon v-if="!track.cover_url" name="music_note"
                /></span>
                <span class="list-copy"
                  ><strong>{{ track.title }}</strong
                  ><small
                    >{{ track.artist || 'Unknown artist'
                    }}<span v-if="track.album"> · {{ track.album }}</span></small
                  ></span
                >
                <button
                  class="delete-button"
                  :aria-label="`Remove ${track.title} from public catalog`"
                  @click="trackToDelete = track"
                >
                  <q-icon name="delete_outline" />
                </button>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </main>

    <q-dialog
      :model-value="Boolean(trackToDelete)"
      @update:model-value="(open) => !open && (trackToDelete = null)"
    >
      <q-card class="delete-dialog">
        <q-card-section
          ><h2>Remove this public track?</h2>
          <p>
            “{{ trackToDelete?.title }}” will no longer be visible or playable from the public
            catalog.
          </p></q-card-section
        >
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            label="Remove track"
            :loading="deleting"
            @click="removeTrack"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Session, Subscription } from '@supabase/supabase-js';
import AuthPanel from '@/components/auth/AuthPanel.vue';
import { ADMIN_EMAIL, hasAdminAccess } from '@/services/admin-access';
import { getSupabaseClient } from '../../../lib/supabase/client';
import {
  MAX_PUBLIC_AUDIO_SIZE,
  deletePublicMusicTrack,
  loadPublicMusic,
  publishPublicMusic,
  type PublicMusicTrack,
} from '@/services/public-music';

const session = ref<Session | null>(null);
const checkingSession = ref(true);
const redirectingToLibrary = ref(false);
const uploading = ref(false);
const loadingTracks = ref(false);
const deleting = ref(false);
const authError = ref('');
const portalError = ref('');
const listError = ref('');
const successMessage = ref('');
const selectedFile = ref<File | null>(null);
const tracks = ref<PublicMusicTrack[]>([]);
const trackToDelete = ref<PublicMusicTrack | null>(null);
const form = reactive({ title: '', artist: '', album: '', genre: '', coverUrl: '' });
const isAdmin = computed(() => hasAdminAccess(session.value?.user));
const router = useRouter();
let authSubscription: Subscription | undefined;

onMounted(async () => {
  try {
    const client = getSupabaseClient();
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      session.value = nextSession;
      if (hasAdminAccess(nextSession?.user)) void loadTracks();
      else {
        tracks.value = [];
        if (nextSession) void redirectToLibrary();
        else redirectingToLibrary.value = false;
      }
    });
    authSubscription = data.subscription;
    const { data: sessionData, error } = await client.auth.getSession();
    if (error) throw error;
    session.value = sessionData.session;
    if (hasAdminAccess(sessionData.session?.user)) await loadTracks();
    else if (sessionData.session) await redirectToLibrary();
  } catch (error) {
    authError.value =
      error instanceof Error ? error.message : 'Unable to initialize the admin portal.';
  } finally {
    checkingSession.value = false;
  }
});

onUnmounted(() => authSubscription?.unsubscribe());

async function redirectToLibrary() {
  if (redirectingToLibrary.value) return;
  redirectingToLibrary.value = true;
  authError.value = '';
  try {
    await router.replace('/library');
  } catch (error) {
    redirectingToLibrary.value = false;
    authError.value =
      error instanceof Error
        ? `Unable to open your library: ${error.message}`
        : 'Unable to open your library.';
  }
}

async function signOut() {
  try {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
    session.value = null;
    tracks.value = [];
  } catch (error) {
    portalError.value = error instanceof Error ? error.message : 'Unable to sign out.';
  }
}

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (file && file.size > MAX_PUBLIC_AUDIO_SIZE) {
    selectedFile.value = null;
    portalError.value = 'That file exceeds the 50 MB upload limit.';
    input.value = '';
    return;
  }
  selectedFile.value = file;
  portalError.value = '';
}

async function loadTracks() {
  loadingTracks.value = true;
  listError.value = '';
  try {
    tracks.value = await loadPublicMusic();
  } catch (error) {
    listError.value = error instanceof Error ? error.message : 'Unable to load public tracks.';
  } finally {
    loadingTracks.value = false;
  }
}

async function publish() {
  if (!session.value || !selectedFile.value) return;
  uploading.value = true;
  portalError.value = '';
  successMessage.value = '';
  try {
    const track = await publishPublicMusic(session.value.user.id, {
      ...form,
      file: selectedFile.value,
    });
    tracks.value = [track, ...tracks.value];
    form.title = '';
    form.artist = '';
    form.album = '';
    form.genre = '';
    form.coverUrl = '';
    selectedFile.value = null;
    const fileInput = document.querySelector<HTMLInputElement>('.file-label input[type="file"]');
    if (fileInput) fileInput.value = '';
    successMessage.value = `${track.title} is now live in the public catalog.`;
  } catch (error) {
    portalError.value = error instanceof Error ? error.message : 'Unable to publish track.';
  } finally {
    uploading.value = false;
  }
}

async function removeTrack() {
  if (!trackToDelete.value) return;
  deleting.value = true;
  portalError.value = '';
  try {
    const track = trackToDelete.value;
    await deletePublicMusicTrack(track);
    tracks.value = tracks.value.filter((item) => item.id !== track.id);
    trackToDelete.value = null;
    successMessage.value = `${track.title} was removed from the public catalog.`;
  } catch (error) {
    portalError.value = error instanceof Error ? error.message : 'Unable to remove track.';
    await loadTracks();
  } finally {
    deleting.value = false;
  }
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #f4f5f0;
  color: #20251c;
  font-family: Inter, Roboto, Arial, sans-serif;
}
.admin-header {
  height: 72px;
  padding: 0 clamp(20px, 5vw, 70px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #151813;
  color: #f5f6ef;
}
.admin-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  text-decoration: none;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.7px;
}
.admin-brand > span:last-child {
  font-size: 9px;
  letter-spacing: 1.6px;
  color: #c5d994;
  margin-left: 2px;
}
.admin-logo {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: #d7ff70;
  color: #17220a;
  font-size: 19px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.header-actions a,
.header-actions button {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: none;
  color: #d9ded0;
  text-decoration: none;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.header-actions a:hover,
.header-actions button:hover {
  color: #d7ff70;
}
.admin-main {
  width: min(1160px, calc(100% - 40px));
  margin: 0 auto;
  padding: 54px 0 80px;
}
.portal-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 34px;
}
.portal-kicker {
  margin: 0 0 10px;
  color: #70786a;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.7px;
}
.portal-kicker span {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  background: #7d9d3c;
}
.portal-heading h1,
.sign-in-card h1 {
  margin: 0;
  font-size: clamp(38px, 5vw, 56px);
  letter-spacing: -2.7px;
}
.portal-heading h1 span {
  color: #819e46;
}
.portal-description {
  max-width: 570px;
  margin: 12px 0 0;
  color: #757b70;
  font-size: 14px;
  line-height: 1.6;
}
.catalog-stat {
  min-width: 125px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  border: 1px solid #dfe2d7;
  border-radius: 16px;
  background: #fff;
}
.catalog-stat strong {
  font-size: 28px;
  line-height: 1.1;
}
.catalog-stat span {
  margin-top: 5px;
  color: #81877c;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
}
.studio-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(390px, 1.1fr);
  align-items: start;
  gap: 20px;
}
.studio-panel {
  padding: 24px;
  border: 1px solid #e3e5dc;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 12px 35px #25291c08;
}
.panel-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 23px;
}
.panel-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: #eff5e1;
  color: #64812e;
  font-size: 20px;
}
.panel-heading h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.5px;
}
.panel-heading p {
  margin: 4px 0 0;
  color: #868b80;
  font-size: 11px;
}
.published-heading {
  margin-bottom: 16px;
}
.published-heading > div {
  flex: 1;
}
.icon-button {
  width: 35px;
  height: 35px;
  border: 1px solid #e3e5dc;
  border-radius: 10px;
  background: #fff;
  color: #5f6755;
  cursor: pointer;
}
.admin-form {
  display: grid;
  gap: 15px;
}
.admin-form label {
  display: grid;
  gap: 7px;
  color: #50564a;
  font-size: 11px;
  font-weight: 700;
}
.admin-form :deep(.q-field__control) {
  border-radius: 10px;
  background: #fbfcf9;
}
.form-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.file-label input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.file-drop {
  min-height: 78px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1px dashed #cbd2bd;
  border-radius: 12px;
  background: #fafbf8;
  color: #71834b;
  cursor: pointer;
}
.file-drop > strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #3e4635;
  font-size: 11px;
}
.file-drop > small {
  color: #858a80;
  font-size: 9px;
  font-weight: 400;
}
.file-drop .q-icon {
  font-size: 20px;
}
.submit-button {
  min-height: 44px;
  border-radius: 11px;
  background: #c7ec6a;
  color: #1c2611;
  font-weight: 800;
}
.privacy-note {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  margin: 15px 0 0;
  color: #858a80;
  font-size: 10px;
  line-height: 1.5;
}
.privacy-note .q-icon {
  color: #6e8e34;
}
.published-list {
  max-height: 620px;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}
.published-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid #eef0e9;
}
.list-cover {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: linear-gradient(140deg, #d9e8bc, #899c63);
  background-position: center;
  background-size: cover;
  color: #516833;
  font-size: 19px;
}
.list-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 4px;
}
.list-copy strong,
.list-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.list-copy strong {
  font-size: 12px;
}
.list-copy small {
  color: #81877c;
  font-size: 10px;
}
.delete-button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #92988b;
  font-size: 17px;
  cursor: pointer;
}
.delete-button:hover {
  background: #fff0ed;
  color: #c44335;
}
.portal-state,
.portal-empty {
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #888e82;
  text-align: center;
  font-size: 12px;
}
.portal-empty .q-icon {
  font-size: 27px;
  color: #94a275;
}
.portal-empty strong {
  color: #40483a;
}
.portal-error,
.portal-success {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.5;
}
.portal-error {
  background: #fff1ee;
  color: #a93e31;
}
.portal-success {
  background: #f0f7df;
  color: #56702b;
}
.sign-in-card {
  width: min(420px, 100%);
  margin: 65px auto;
  padding: 32px;
  border: 1px solid #e3e5dc;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 18px 55px #25291c0d;
}
.admin-logo-large {
  width: 46px;
  height: 46px;
  margin-bottom: 22px;
  border-radius: 15px;
  font-size: 22px;
}
.sign-in-card h1 {
  font-size: 34px;
  letter-spacing: -1.6px;
}
.sign-in-card .portal-description {
  margin: 9px 0 22px;
}
.sign-in-help {
  margin: -12px 0 18px;
  color: #858a80;
  font-size: 11px;
  line-height: 1.5;
}
.sign-in-card .admin-form {
  margin-top: 22px;
}
.back-link {
  display: block;
  margin-top: 20px;
  color: #71834b;
  text-align: center;
  text-decoration: none;
  font-size: 11px;
  font-weight: 700;
}
.reset-link {
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}
.reset-link:disabled {
  opacity: 0.6;
  cursor: wait;
}
.admin-logo-warning {
  background: #fff1da;
  color: #a97020;
}
.signed-in-email {
  margin: 20px 0;
  padding: 12px;
  border-radius: 10px;
  background: #f4f5f0;
  color: #6b7165;
  font-size: 12px;
}
.delete-dialog {
  width: min(420px, calc(100vw - 32px));
  border-radius: 18px;
}
.delete-dialog h2 {
  margin: 0;
  font-size: 19px;
}
.delete-dialog p {
  color: #73786f;
  font-size: 13px;
  line-height: 1.6;
}
@media (max-width: 820px) {
  .studio-layout {
    grid-template-columns: 1fr;
  }
  .admin-main {
    padding-top: 38px;
  }
  .published-list {
    max-height: 460px;
  }
}
@media (max-width: 520px) {
  .admin-header {
    height: 64px;
  }
  .header-actions {
    gap: 12px;
  }
  .header-actions a,
  .header-actions button {
    font-size: 0;
  }
  .header-actions .q-icon {
    font-size: 19px;
  }
  .admin-main {
    width: calc(100% - 28px);
    padding-top: 28px;
  }
  .portal-heading {
    align-items: flex-end;
    gap: 12px;
  }
  .portal-heading h1 {
    font-size: 40px;
  }
  .catalog-stat {
    min-width: 80px;
    padding: 11px;
  }
  .studio-panel {
    padding: 18px;
  }
  .form-pair {
    grid-template-columns: 1fr;
  }
  .sign-in-card {
    margin: 32px auto;
    padding: 24px;
  }
}
</style>
