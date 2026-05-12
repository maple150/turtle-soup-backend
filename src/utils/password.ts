import { randomString, sha256Hex } from './random'

export interface PasswordHashResult {
  hash: string
  salt: string
}

export async function hashPassword(password: string, salt = randomString(16)): Promise<PasswordHashResult> {
  const hash = await sha256Hex(`${salt}:${password}`)

  return {
    hash,
    salt
  }
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const next = await hashPassword(password, salt)
  return next.hash === hash
}
