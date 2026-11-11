import bcrypt from 'bcryptjs'

const HASH_ROUNDS = 12

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, HASH_ROUNDS)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
