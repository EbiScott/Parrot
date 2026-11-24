# Parrot — Product Notes

## Product

Parrot is a private audio and video journal. Recordings, transcripts and settings live in the
browser's IndexedDB. There is no account and no upload today. The app is installable, works
offline, and can transcribe speech on the device.

Hosted at https://parrot-jet.vercel.app.

## Release 1.0

- Audio and video recording, upload, drag-drop and paste.
- On-device speech transcription with paragraphing, editing and timed captions.
- Downloadable `.srt` and `.vtt` subtitle files for transcribed audio and video.
- Newest-first journal with pagination and transcript/title search.
- Entry playback, transcript copy/share, audio download and video download when a video exists.
- Installable PWA with a home-screen button and platform instructions.
- Local storage usage, persistent-storage request and delete-all controls.
- Encrypted offline backup and restore, with a last-backup date and stale-backup reminder.

## Accounts, device changes and storage

### Principle

Keep the product usable without an account. Accounts and sync are optional additions for people
who want a backup or a second device. Privacy copy must stay honest: if a feature uploads
anything, it says exactly what leaves the device.

### The immediate problem: changing device

Browser storage does not move with a person. Clearing site data, uninstalling, changing phones or
switching browsers loses the journal. A user must be able to take the journal with them before the
old device is gone.

### Recommended path

Start with the cheapest and most private option, then add cloud only for people who ask for it.

#### Phase 1 — Encrypted backup file (implemented)

- Settings gets **Backup & devices**.
- **Export backup** creates one encrypted `.parrot` file containing entry metadata, transcripts,
  audio and video. Recordings are encrypted in chunks so long files do not need to be loaded whole.
- The user chooses a passphrase. Files are encrypted in the browser with AES-GCM; the passphrase
  and key never leave the device.
- **Import backup** offers merge or replace. Entries are matched by a stable UUID, not the current
  timestamp id.
- Works across phones, laptops, browsers and operating systems. No account, no server, no monthly
  cost.
- Limitation: the user must remember to export, and the backup is only as fresh as the last file.
- Large journals still build the download in browser memory. A later version should stream the
  archive to disk where the File System Access API is available, or split very large backups.

#### Phase 2 — Optional account and metadata backup

- Sign in with an email magic link or passkey. No password database.
- Back up transcripts, entry metadata and settings, not recordings by default. Text is tiny.
- Encrypt the backup client-side with a key derived from a recovery phrase. The service stores
  ciphertext and cannot read journal text.
- New device: sign in, restore transcripts immediately, and download media only when needed.
- This is inexpensive because metadata is measured in kilobytes; recordings are not included.

#### Phase 3 — Optional encrypted media backup

- Only after the user opts in, upload recordings to object storage such as Cloudflare R2 or
  Backblaze B2. R2 is attractive because it has no egress fee; B2 is another low-cost option.
- Encrypt each recording in the browser before upload. Store a content hash to avoid uploading the
  same file twice.
- Upload only on Wi-Fi and, optionally, while charging. Pause on low battery.
- On a new device, show cloud entries in the journal with a download-on-play state. "Keep offline"
  downloads a copy permanently. "Download all" is explicit, never automatic.
- Enforce a per-account storage cap and show usage before upload. Video dominates storage, so the
  cap matters most there.
- Metadata can live in a small serverless database such as D1 or Postgres. The database stores
  entry ids, sizes, hashes, revisions and timestamps, not transcripts or media bytes.

### Data model changes needed

- Add `uuid` to every entry; keep the numeric timestamp id as the local sort key.
- Add `updatedAt`, `revision`, `deletedAt` and `syncState` (`local`, `pending`, `synced`).
- Keep blobs in IndexedDB as they are. For cloud backup, store the remote object key and hash next
  to the local entry; do not load media into memory unless it is being played or uploaded.
- Deletes become tombstones until every device has seen them, then can be purged.
- Store a backup manifest so an import can validate versions before writing anything.

### Conflicts

The journal is mostly append-only, so conflicts are rare. For the few mutable fields:

- Use last-write-wins per entry based on `updatedAt`.
- Keep a revision number to detect a stale upload.
- Never silently discard a transcript edit: if a revision conflict is found, keep the newer local
  text and surface a small "review this entry" notice.
- Apply tombstones before merging edits.

### Security

- Encrypt backup files and cloud media with AES-GCM using keys generated on the device.
- Derive the wrapping key from a long recovery phrase; never store the phrase or derived key on a
  server.
- Warn clearly that losing the recovery phrase loses encrypted backups.
- Keep account authentication separate from the encryption key so a provider breach does not
  expose journal content.
- Do not add server-side search or transcription if the product promise remains end-to-end
  encrypted.

### Cost reasoning

- Local-only: free.
- Transcript and metadata backup: effectively free at personal scale; text and small rows fit
  comfortably inside free or low-cost tiers.
- Media backup: priced by stored gigabytes. Object storage is typically cents per gigabyte per
  month, and R2 removes egress charges. This is far cheaper than running a general-purpose server
  or database for large blobs.
- Efficiency rules: never store uncompressed audio, never upload video unless opted in, dedupe by
  hash, upload only on Wi-Fi, and download media lazily on a new device.

### Suggested UI

Settings → Backup & devices:

- Export backup
- Import backup
- Turn on transcript backup (optional account)
- Turn on recording backup (optional, shows storage used and cap)
- Connected devices (later; sign out a device)
- Last backup time and a gentle reminder after 30 days

### Acceptance criteria for Phase 1

- An encrypted export can be created on one browser and imported on another.
- Import validates the file, reports how many entries will be added or replaced, and asks before
  writing.
- A wrong passphrase fails without modifying local data.
- Audio and video still play after import.
- The export works offline and makes no network request.
- Existing entries migrate to UUIDs without data loss.

### Non-goals

- Live collaborative editing.
- Public sharing or social features.
- Server-side transcription or content scanning.
- Uploading recordings silently or by default.

## Android APK packaging

Parrot is a web app, not a React Native app. Expo is not the right build tool: using it would mean
either rewriting the app in React Native or shipping a WebView wrapper around the hosted site.

Recommended path when an APK is needed:

1. Keep the PWA as the primary build. Android users can already install it from Chrome.
2. Generate a Trusted Web Activity (TWA) package with PWABuilder or Bubblewrap. It opens the
   hosted PWA in the real Chrome engine and keeps install, service-worker caching and permissions
   behavior.
3. Choose a permanent Android package id, for example `app.parrot.journal`.
4. Create and keep the signing keystore. Every future APK update must use the same key.
5. Add the generated `/.well-known/assetlinks.json` to the Vercel deployment so Android verifies
   that the app owns the site.
6. Test microphone, camera, file upload, downloads, install/update and offline launch on a device.

Tradeoffs:

- TWA needs the site to remain online for the first launch. The service worker handles later
  offline use.
- A Capacitor package can bundle the build locally and may behave better on a first offline
  launch, but adds a native project and build pipeline.
- An Expo/WebView wrapper is possible but not recommended. File downloads, uploads, microphone
  permission, share targets and service-worker behavior need extra native handling, and it would
  still be a web app inside a shell.
- A truly native app would be a separate React Native port with native recording and playback. It
  should not reuse the current web UI assumptions.

The current machine has no JDK or Android SDK, so TWA packaging should use PWABuilder in a browser
or a CI build rather than a local Gradle build.
