# Sonora music library

Sonora is a Quasar single-page music library with Supabase email/password and Google authentication. The browser connects directly to Supabase using its public anon/publishable key. Signed-in users' track metadata, playlists, and folders are loaded from and synchronized to Supabase Postgres. Browser local storage is retained as a per-user cache and as the one-time source for importing the existing demo library into an empty Supabase project.

Sonora stores playlist and track metadata in Supabase Postgres. Uploaded audio files are stored in the private `music` Storage bucket and resolved from their object paths into short-lived signed URLs. Seeded demo tracks contain metadata only, not bundled recordings. To make one playable, search for and choose an embeddable YouTube result from the track actions, or attach a file or direct audio URL you are authorized to use.

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com/) and wait for the database to finish provisioning.
   Use the same Supabase project for SQL migrations, authentication, and the app's `VITE_SUPABASE_URL`. Running SQL in a different project will not affect the app.
2. In the Supabase dashboard, open **SQL Editor**, create a query, paste all of [`lib/supabase/schema.sql`](./lib/supabase/schema.sql), and run it. The schema script is safe to rerun; it recreates its named Row Level Security policies without deleting user data.
3. In that same project's SQL Editor, run the migrations in order: [`lib/supabase/migrations/20261106_music_storage_and_lyrics.sql`](./lib/supabase/migrations/20261106_music_storage_and_lyrics.sql), then [`lib/supabase/migrations/20261112_public_music_catalog.sql`](./lib/supabase/migrations/20261112_public_music_catalog.sql). The first migration configures the private per-user audio bucket. The second creates a separate public catalog and public audio bucket; only trusted admins can publish, edit, or remove catalog entries.
4. Open **Project Settings → API** (or **Connect**) and copy the **Project URL** and the **publishable/anon public key**. Do not use a secret or service-role key in browser code.
5. Copy `.env.example` to `.env` and replace the example values:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
   VITE_YOUTUBE_API_KEY=your_restricted_youtube_data_api_key
   ```

   These values are public project configuration. Keep database access protected by the Row Level Security policies installed by the schema.

6. In **Authentication → URL Configuration**, set the Site URL to your production website URL (use `http://localhost:3000` only for local web development). Add the web URLs you use and `com.sonora.music://auth/callback` to the allowed Redirect URLs. The native callback is required even when the Site URL is set to localhost; otherwise Supabase can send the phone's browser to `localhost:3000`, which points back to the phone rather than your computer.
7. Under **Authentication → Providers → Email**, enable Email. If **Confirm email** is enabled, users must open the confirmation link sent after signup before signing in. If they try to sign in early, Sonora explains the issue and offers to resend the link. To allow immediate sign-in without email verification, turn **Confirm email** off in Supabase; this is a project-wide security setting.
8. Supabase's default email service is for testing: it is limited to about two messages per hour and only sends to authorized project team addresses. If signup shows an email sending error, stop retrying and check **Authentication → Users** to see whether the account was created. For signup emails to other addresses and reliable delivery, configure a custom SMTP provider under **Authentication → SMTP Settings**. See [Supabase's custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).
9. Restart the Quasar development server after changing `.env`.

### Automatic YouTube search

1. In Google Cloud Console, select or create a project and enable **YouTube Data API v3**.
2. Create an API key. Restrict it to **YouTube Data API v3** and to your app's HTTP referrers, such as `http://localhost:3000/*` and your deployed app origin. For the Android Capacitor app, also allow `https://localhost/*`.
3. Put the key in `.env` as `VITE_YOUTUBE_API_KEY` and restart the app. This key is sent to browsers, so keep its API and referrer restrictions enabled; do not commit `.env`.

When a demo song has no recording linked, Sonora searches YouTube by title and artist and presents embeddable matches to choose from. Selecting a result uses YouTube's embedded player; availability and playback restrictions are controlled by YouTube.

### Configure the admin studio

1. Create or confirm the account for `angoringedwin12@gmail.com` in **Authentication → Users**.
2. In Supabase SQL Editor, grant that account the trusted admin role by running:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'angoringedwin12@gmail.com';
   ```

   Verify that the query updated one row. `app_metadata` is trusted server-side user metadata; do not use editable `user_metadata` for authorization. Sign out and back in so the new role is included in the access token. To remove admin access, remove the `role` key from that user's `raw_app_meta_data` and have them sign in again.

3. The `/admin` route uses the same sign-in panel as the public app. Only `angoringedwin12@gmail.com` with the trusted `app_metadata.role = 'admin'` claim can manage the catalog; both the UI and the database policies enforce this restriction. Sign out and back in after changing the role so the access token refreshes.
4. Set or reset the account password through Supabase Auth or the app's password-reset flow. Do not put passwords in source code, SQL files, or chat. Open `/admin` to upload music and manage published tracks. Uploads are limited to 50 MB. Published tracks appear in the signed-in library under **New releases** and can be played with the Sonora player.

The public catalog uses a separate `public_music` table and `public-music` Storage bucket. It does not expose users' private tracks or the existing private `music` bucket. Public uploads should contain audio the admin has permission to share.

From the sign-in page, choose **Forgot password?** and submit your email. Open the reset link from the email to reach Sonora's separate `/auth/reset-password` page, where you can set a new password. Make sure your app origin is included in Supabase's allowed Redirect URLs.

If signup reports **Error sending confirmation email** while custom SMTP is enabled, check **Authentication → Emails → SMTP Settings** and **Authentication → Logs** in Supabase. Confirm the SMTP host, port, username, password, and sender address with your mail provider. For Gmail SMTP, use `smtp.gmail.com`, port `465`, your full Gmail address as the username, and a Google App Password (not your regular Gmail password). Check **Authentication → Users** before retrying signup because Supabase may have created the account even though email delivery failed.

The application runs entirely in the browser. It uses Supabase's browser client and relies on database Row Level Security to isolate each signed-in user's rows.

## Deploy with GitHub and Vercel

1. Commit and push the project to GitHub. The root `.gitignore` excludes `.env`; keep the local file untracked and never commit API secrets. `VITE_*` values are included in browser code, so use only the Supabase publishable/anon key and a restricted YouTube API key.
2. In Vercel, choose **Add New → Project**, import the GitHub repository, and keep the repository root as the project root. The checked-in [`vercel.json`](./vercel.json) configures the Quasar SPA build (`npm run build`), output directory (`dist/spa`), and history-mode route fallback. Do not set Vercel's output directory to the repository root.
3. Before deploying, add these environment variables in **Project Settings → Environment Variables** for each environment you plan to use (Production, and Preview if needed):

   ```text
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   VITE_YOUTUBE_API_KEY
   ```

   Use the same Supabase project where the schema and migrations are installed. Set the YouTube key's API restriction to **YouTube Data API v3** and its website restriction to your production domain, for example `https://your-app.vercel.app/*`. Also allow `https://localhost/*` if you use YouTube search in the Android app. Add a custom domain or a specific preview URL only if that deployment needs YouTube search. Never add a Supabase service-role key or other server secret as a `VITE_*` variable.

4. Deploy. Vite reads these values at build time, so redeploy after adding or changing them. For a build failure, check the Vercel build log and confirm the project is using a supported Node version from `package.json`.
5. In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to your production origin, such as `https://your-app.vercel.app`, and add `https://your-app.vercel.app/**` to **Redirect URLs**. Add your custom domain and local development URLs there too, if used. Without these entries, confirmation, password-reset, and Google OAuth return flows may be rejected.
6. If Google sign-in is enabled, confirm the provider is enabled for the same Supabase project and the Google OAuth client has Supabase's callback URL in its authorized redirect URIs.
7. Open the deployed app, sign in, and verify library loading, password-reset links, and YouTube search. Vercel Preview deployments have distinct URLs; add their exact hostnames to Supabase redirect allowlists and YouTube referrer restrictions only when you need those flows to work in previews.

GitHub stores the source; Vercel builds and hosts the app. A successful local build does not by itself configure production environment variables, Supabase redirect allowlists, OAuth domains, or API-key referrers.

## Build the Android APK

The Android app is a Capacitor wrapper around the same Sonora web app. It uses the same Supabase project and cloud tables; the APK does not contain a separate database. Capacitor support is already scaffolded with app ID `com.sonora.music` and app name **Sonora Music**.

1. Install Node.js using a version supported by `package.json`, Android Studio with the Android SDK platform/build tools, and **JDK 21**. Capacitor 8's Android sources require Java 21; Java 8 and Java 17 are not sufficient. Make sure `JAVA_HOME`, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and Android SDK licenses are configured.

   On Windows, install Eclipse Temurin JDK 21 if Java is missing:

   ```powershell
   winget install --id EclipseAdoptium.Temurin.21.JDK -e
   ```

   Open a new PowerShell terminal, then set `JAVA_HOME` to the installed JDK and verify Java:

   ```powershell
   $jdk = Get-ChildItem "$env:ProgramFiles\Eclipse Adoptium" -Directory |
     Where-Object { $_.Name -like 'jdk-21*' } |
     Select-Object -First 1
   if (-not $jdk) { throw 'JDK 21 was not found under Program Files\Eclipse Adoptium.' }
   [Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk.FullName, 'User')
   $env:JAVA_HOME = $jdk.FullName
   $env:Path = "$env:JAVA_HOME\bin;$env:Path"
   java -version
   ```

   Confirm the output reports version 21, then restart VS Code so new terminals inherit `JAVA_HOME`.
2. Use the project-root `.env` (the same file used by desktop/web development), not `src-capacitor/.env`. Quasar reads the root file for both the web app and the Capacitor build. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to values from the same Supabase project; use those exact `VITE_` names rather than `SUPABASE_URL` or `SUPABASE_ANON_KEY`. Add a restricted `VITE_YOUTUBE_API_KEY` if needed. These Vite values are embedded into the APK, so use only public/publishable keys—never a Supabase service-role key. Restart the dev server after changing the file, and rebuild and reinstall the APK whenever these values change.
3. In Supabase **Authentication → URL Configuration → Redirect URLs**, add this exact native callback: `com.sonora.music://auth/callback`. The Android app uses that deep link to return from Google sign-in, signup confirmation, and password reset. This is separate from the Google Cloud OAuth client's authorized redirect URI, which must remain the Supabase callback URL shown in **Authentication → Providers → Google**.
4. From the project root, build and sync the Android project:

   ```powershell
   quasar build -m capacitor -T android
   ```

5. Build a debug APK:

   ```powershell
   Push-Location src-capacitor/android
   .\gradlew.bat assembleDebug
   Pop-Location
   ```

   The APK is written to `src-capacitor/android/app/build/outputs/apk/debug/app-debug.apk`.
   To make it downloadable from the website, copy the APK to the public static files before deploying:

   ```powershell
   New-Item -ItemType Directory -Force public/downloads | Out-Null
   Copy-Item src-capacitor/android/app/build/outputs/apk/debug/app-debug.apk public/downloads/sonora-music.apk
   ```

   The sign-in page and library navigation link to `/downloads/sonora-music.apk`. Repeat the copy and redeploy whenever you publish an updated APK.

6. Install the newly built APK on a connected Android phone with USB debugging enabled. Rebuilding and reinstalling matters: an older APK may still send Google sign-in back to its previous web URL.

   ```powershell
   adb devices
   adb -d install -r src-capacitor/android/app/build/outputs/apk/debug/app-debug.apk
   ```

   Or copy that APK to the phone and install it manually. Test sign-in, cloud library loading, track playback, Google sign-in, signup/reset links, and YouTube search. The Supabase project must allow the native callback URL, and the YouTube API key must allow the Capacitor WebView origin `https://localhost/*`.

   If Google sign-in finishes at `localhost:3000` or shows `ERR_CONNECTION_REFUSED`, check that the native callback above is in Supabase's **Redirect URLs**, then rebuild and reinstall the APK. `localhost` on the phone is the phone itself, not the development computer. In the Google account chooser/consent flow, Google should return to Supabase first; Supabase should then open the installed Sonora app through `com.sonora.music://auth/callback`.

The local `.env`, Gradle build outputs, local SDK path, and generated Android web assets are ignored by Git. Commit the Capacitor config and Android project, not local credentials or build artifacts.

### Optional: Google sign-in

1. Create a Google OAuth web client in Google Cloud Console.
2. In the Supabase dashboard, enable the Google provider and enter the OAuth client ID and secret.
3. Add the Supabase callback URL displayed in the Google provider settings to the OAuth client's authorized redirect URIs.
4. Make sure the app's local and production URLs are allowed in Supabase **Authentication → URL Configuration**.

If Google sign-in returns `Unsupported provider: provider is not enabled`, Google is not enabled in the Supabase project set by `VITE_SUPABASE_URL`. Enable the Google provider there and configure its OAuth client ID and secret.

### Start the app

```powershell
Copy-Item .env.example .env
# Set your Supabase URL and public anon/publishable key in .env before starting.
npm install
npm run dev
```

Sign up or sign in. If the tables are empty, Sonora imports the signed-in user's existing local demo catalog and playlists into Supabase. Otherwise, Supabase is authoritative and replaces that user's local cache with the cloud library. Track, playlist, folder, and favorite edits sync automatically. Upload audio (up to 50 MB) from a playlist or library; new uploads go to the private `music` bucket. Database/network errors are shown in the app.

## Library features

Create folders from the sidebar, choose a folder when adding a track, or move existing tracks into folders from each track's actions menu. Playlists remain separate from folders. Removing a track is persisted to the signed-in user's cloud library.

## Test actual audio playback

1. Apply the `music_storage_and_lyrics` migration above and restart the app.
2. Sign in, open **Upload music**, and choose a local audio file you own or are licensed to use. The upload should create an object under `music/<your-user-id>/` and save its object key in the track's `audio_path`.
3. Confirm the file is visible in **Supabase → Storage → music**. On library load, Sonora checks saved Storage paths and reports missing, legacy-bucket, and unverifiable objects.
4. To attach several files to the existing catalog at once, open **Your Library → Songs → Attach audio**. Choose your authorized audio files, confirm or change each filename-to-song match, and select **Upload and attach**. Filenames beginning with the song title or artist/title are matched automatically; unmatched files can be assigned from the song list. Each file must be 50 MB or smaller. This updates the existing tracks rather than creating duplicate songs.
5. Play an attached track and verify audible output, then exercise pause/resume, next/previous, seek, volume/mute, shuffle, repeat, and queue. The elapsed time and duration should follow the browser's audio element, not catalog metadata.
6. Add only lyrics you own or are licensed to store. Plain text appears in Lyrics; LRC lines such as `[00:12.50] lyric text` highlight against the current audio time.

To audit all of a user's recorded paths in the Supabase SQL Editor, replace the UUID and run:

```sql
select t.title,
       t.audio_path,
       case
         when coalesce(t.audio_path, '') = '' then 'no storage path'
         when exists (
           select 1 from storage.objects o
           where o.bucket_id = 'music' and o.name = t.audio_path
         ) then 'music: present'
         when exists (
           select 1 from storage.objects o
           where o.bucket_id = 'tracks'
             and o.name = t.audio_path
             and t.audio_url like '%/object/%/tracks/%'
         ) then 'legacy tracks: present'
         else 'missing from music and legacy tracks'
       end as storage_status
from public.tracks t
where t.user_id = 'YOUR_USER_UUID'::uuid
order by t.title;
```

## Structure

Application code is grouped by feature under `src/components/`, with shared
application services under `src/services/`. Supabase client and database setup
files are kept together in `lib/supabase/`.

```text
src/
  App.vue
  components/
    auth/
      AuthGate.vue
      AuthPanel.vue
      ResetPasswordForm.vue
    library/
      SideNavigation.vue
      SonoraLibrary.vue
  css/
    app.css
  pages/
    [...path].vue
    index.vue
    index/
      (index).vue
    auth/
      reset-password.vue
    library.vue
    login.vue
    signup.vue
  router/
    index.ts
    typed-router.d.ts
  services/
    sonora-library.ts
  stores/
    index.ts
lib/
  supabase/
    client.ts
    database.types.ts
    library.ts
    schema.sql
```

## Run locally

```powershell
# After completing Supabase setup above:
npm run dev
```

`npm run dev` and `npm run build` run the Quasar single-page application. No separate Node SSR server setup is required.

## Checks and production build

```powershell
npm run typecheck
npm run build
```
