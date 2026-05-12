const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomString(length = 16) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join('')
}

export function generateId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function sha256Hex(input: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then((buffer) =>
    Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
  )
}
