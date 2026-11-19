const MAGIC = new TextEncoder().encode('PARROT1\n')
const FORMAT = 'parrot-backup'
const VERSION = 1
const DEFAULT_ITERATIONS = 210000
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024
const MIN_ITERATIONS = 1000
const MAX_ITERATIONS = 2000000
const MIN_CHUNK_SIZE = 16 * 1024
const MAX_CHUNK_SIZE = 64 * 1024 * 1024
const MAX_HEADER_BYTES = 64 * 1024
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024
const IV_BYTES = 12
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class BackupError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BackupError'
  }
}

export function backupFileName(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `parrot-backup-${year}-${month}-${day}.parrot`
}

function cryptoApi() {
  if (!globalThis.crypto?.subtle) {
    throw new BackupError('This browser cannot create or open encrypted backups.')
  }
  return globalThis.crypto
}

function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function base64ToBytes(value) {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    throw new BackupError('This backup file is damaged.')
  }
}

function u32(value) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, true)
  return bytes
}

function readU32(bytes, offset) {
  if (offset + 4 > bytes.length) throw new BackupError('This backup file is incomplete.')
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true)
}

function aad(value) {
  return encoder.encode(value)
}

function manifestAad() {
  return aad(`${FORMAT}:manifest:v${VERSION}`)
}

function chunkAad(uuid, kind, index) {
  return aad(`${FORMAT}:${uuid}:${kind}:${index}`)
}

function chunkCount(size, chunkSize) {
  return Math.ceil(size / chunkSize)
}

function mediaMeta(blob) {
  if (!blob?.size) return null
  return { type: blob.type || 'application/octet-stream', size: blob.size }
}

function validateHeader(header) {
  if (!header || header.format !== FORMAT || header.version !== VERSION) {
    throw new BackupError('That is not a Parrot backup, or it uses a newer format.')
  }
  if (!header.kdf || header.kdf.name !== 'PBKDF2' || header.kdf.hash !== 'SHA-256') {
    throw new BackupError('This backup uses an unsupported encryption setup.')
  }
  if (
    !Number.isInteger(header.kdf.iterations) ||
    header.kdf.iterations < MIN_ITERATIONS ||
    header.kdf.iterations > MAX_ITERATIONS
  ) {
    throw new BackupError('This backup uses an unsafe encryption setup.')
  }
  if (
    !Number.isInteger(header.chunkSize) ||
    header.chunkSize < MIN_CHUNK_SIZE ||
    header.chunkSize > MAX_CHUNK_SIZE
  ) {
    throw new BackupError('This backup uses an unsupported chunk size.')
  }
  if (!header.kdf.salt || !header.manifestIv) throw new BackupError('This backup is incomplete.')
}

function validateManifest(manifest) {
  if (!manifest || manifest.format !== FORMAT || manifest.version !== VERSION) {
    throw new BackupError('This backup has an unreadable manifest.')
  }
  if (!Array.isArray(manifest.entries) || !manifest.entries.length) {
    throw new BackupError('This backup contains no entries.')
  }

  const uuids = new Set()
  for (const entry of manifest.entries) {
    if (!entry || typeof entry.uuid !== 'string' || !entry.uuid) {
      throw new BackupError('This backup has an entry without an id.')
    }
    if (uuids.has(entry.uuid)) throw new BackupError('This backup contains duplicate entries.')
    uuids.add(entry.uuid)

    for (const kind of ['audio', 'video']) {
      const media = entry[kind]
      if (media === null || media === undefined) continue
      if (typeof media.type !== 'string' || !Number.isInteger(media.size) || media.size < 0) {
        throw new BackupError('This backup has invalid recording details.')
      }
    }
  }
}

async function deriveKey(passphrase, salt, iterations) {
  const crypto = cryptoApi()
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptBytes(key, bytes, additionalData) {
  const iv = cryptoApi().getRandomValues(new Uint8Array(IV_BYTES))
  const encrypted = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData },
    key,
    bytes,
  )
  return { iv, bytes: new Uint8Array(encrypted) }
}

async function decryptBytes(key, bytes, iv, additionalData) {
  return new Uint8Array(
    await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData },
      key,
      bytes,
    ),
  )
}

function readBytes(blob, offset, length) {
  if (offset < 0 || length < 0 || offset + length > blob.size) {
    throw new BackupError('This backup file is incomplete.')
  }
  return blob.slice(offset, offset + length).arrayBuffer().then((value) => new Uint8Array(value))
}

export async function createBackupBlob(entries, passphrase, options = {}) {
  if (!passphrase || !String(passphrase).trim()) {
    throw new BackupError('Enter a passphrase to protect the backup.')
  }
  if (!Array.isArray(entries) || !entries.length) {
    throw new BackupError('There is nothing to back up yet.')
  }

  const iterations = options.iterations || DEFAULT_ITERATIONS
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
  const salt = cryptoApi().getRandomValues(new Uint8Array(16))
  const key = await deriveKey(String(passphrase), salt, iterations)

  const manifest = {
    format: FORMAT,
    version: VERSION,
    exportedAt: Date.now(),
    entries: entries.map((entry) => ({
      uuid: entry.uuid,
      type: entry.type,
      title: entry.title,
      transcript: entry.transcript || '',
      duration: entry.duration || 0,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt || entry.createdAt,
      status: entry.status || 'done',
      audio: mediaMeta(entry.audioBlob),
      video: mediaMeta(entry.videoBlob),
    })),
  }

  if (manifest.entries.some((entry) => !entry.uuid)) {
    throw new BackupError('One or more entries are missing their backup id.')
  }

  const manifestCipher = await encryptBytes(
    key,
    encoder.encode(JSON.stringify(manifest)),
    manifestAad(),
  )

  const header = {
    format: FORMAT,
    version: VERSION,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: bytesToBase64(salt),
    },
    chunkSize,
    manifestIv: bytesToBase64(manifestCipher.iv),
    manifestSize: manifestCipher.bytes.byteLength,
  }
  const headerBytes = encoder.encode(JSON.stringify(header))
  const parts = [MAGIC, u32(headerBytes.byteLength), headerBytes, manifestCipher.bytes]

  const total = manifest.entries.reduce(
    (sum, entry) =>
      sum +
      (entry.audio ? chunkCount(entry.audio.size, chunkSize) : 0) +
      (entry.video ? chunkCount(entry.video.size, chunkSize) : 0),
    0,
  )
  let done = 0

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    const meta = manifest.entries[index]

    for (const kind of ['audio', 'video']) {
      const blob = kind === 'audio' ? entry.audioBlob : entry.videoBlob
      const chunkTotal = meta[kind] ? chunkCount(meta[kind].size, chunkSize) : 0
      for (let chunk = 0; chunk < chunkTotal; chunk++) {
        const start = chunk * chunkSize
        const end = Math.min(start + chunkSize, blob.size)
        const plain = new Uint8Array(await blob.slice(start, end).arrayBuffer())
        const encrypted = await encryptBytes(key, plain, chunkAad(entry.uuid, kind, chunk))
        parts.push(u32(encrypted.bytes.byteLength), encrypted.iv, encrypted.bytes)
        done++
        options.onProgress?.({ done, total })
      }
    }
  }

  return new Blob(parts, { type: 'application/octet-stream' })
}

export async function readBackupFile(blob, passphrase, options = {}) {
  if (!blob || typeof blob.size !== 'number') throw new BackupError('Choose a backup file.')
  if (!passphrase || !String(passphrase).trim()) {
    throw new BackupError('Enter the passphrase for this backup.')
  }

  const magic = await readBytes(blob, 0, MAGIC.length)
  if (magic.some((byte, index) => byte !== MAGIC[index])) {
    throw new BackupError('That is not a Parrot backup.')
  }

  const lengthBytes = await readBytes(blob, MAGIC.length, 4)
  const headerLength = readU32(lengthBytes, 0)
  if (headerLength < 2 || headerLength > MAX_HEADER_BYTES) {
    throw new BackupError('This backup file is damaged.')
  }

  const headerBytes = await readBytes(blob, MAGIC.length + 4, headerLength)
  let header
  try {
    header = JSON.parse(decoder.decode(headerBytes))
  } catch {
    throw new BackupError('This backup file is damaged.')
  }
  validateHeader(header)

  if (
    !Number.isInteger(header.manifestSize) ||
    header.manifestSize < 16 ||
    header.manifestSize > MAX_MANIFEST_BYTES
  ) {
    throw new BackupError('This backup file is damaged.')
  }

  const salt = base64ToBytes(header.kdf.salt)
  const manifestIv = base64ToBytes(header.manifestIv)
  if (salt.length !== 16 || manifestIv.length !== IV_BYTES) {
    throw new BackupError('This backup file is damaged.')
  }

  const key = await deriveKey(String(passphrase), salt, header.kdf.iterations)
  const manifestOffset = MAGIC.length + 4 + headerLength
  const manifestCipher = await readBytes(blob, manifestOffset, header.manifestSize)

  let manifest
  try {
    manifest = JSON.parse(
      decoder.decode(await decryptBytes(key, manifestCipher, manifestIv, manifestAad())),
    )
  } catch {
    throw new BackupError('That passphrase did not open this backup.')
  }
  validateManifest(manifest)

  const total = manifest.entries.reduce(
    (sum, entry) =>
      sum +
      (entry.audio ? chunkCount(entry.audio.size, header.chunkSize) : 0) +
      (entry.video ? chunkCount(entry.video.size, header.chunkSize) : 0),
    0,
  )
  let offset = manifestOffset + header.manifestSize
  let done = 0
  const restored = []

  for (const meta of manifest.entries) {
    const entry = {
      uuid: meta.uuid,
      type: meta.type,
      title: meta.title,
      transcript: meta.transcript || '',
      duration: Number(meta.duration) || 0,
      createdAt: Number(meta.createdAt),
      updatedAt: Number(meta.updatedAt) || Number(meta.createdAt),
      status: meta.status || 'done',
      audioBlob: null,
      videoBlob: null,
    }

    for (const kind of ['audio', 'video']) {
      const media = meta[kind]
      if (!media) continue

      const blobParts = []
      const chunks = chunkCount(media.size, header.chunkSize)
      let restoredSize = 0

      for (let chunk = 0; chunk < chunks; chunk++) {
        const lengthBytes = await readBytes(blob, offset, 4)
        const encryptedLength = readU32(lengthBytes, 0)
        offset += 4
        if (encryptedLength < 16 || encryptedLength > header.chunkSize + 16) {
          throw new BackupError('This backup file is damaged.')
        }

        const iv = await readBytes(blob, offset, IV_BYTES)
        offset += IV_BYTES
        const cipher = await readBytes(blob, offset, encryptedLength)
        offset += encryptedLength

        let plain
        try {
          plain = await decryptBytes(key, cipher, iv, chunkAad(meta.uuid, kind, chunk))
        } catch {
          throw new BackupError('This backup is damaged or incomplete.')
        }
        blobParts.push(plain)
        restoredSize += plain.byteLength
        done++
        options.onProgress?.({ done, total })
      }

      if (restoredSize !== media.size) {
        throw new BackupError('This backup is damaged or incomplete.')
      }
      entry[`${kind}Blob`] = new Blob(blobParts, { type: media.type })
    }

    restored.push(entry)
  }

  return { exportedAt: Number(manifest.exportedAt) || null, entries: restored }
}
