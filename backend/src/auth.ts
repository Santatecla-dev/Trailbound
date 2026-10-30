import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { pool } from './db.js'

const secret = () => process.env.JWT_SECRET ?? 'trailbound-local-secret'
export type AuthRequest = Request & { userId?: number }

export function tokenFor(userId: number) {
  return jwt.sign({ userId }, secret(), { expiresIn: '7d' })
}

export function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const header = request.header('authorization')
  if (!header?.startsWith('Bearer ')) return response.status(401).json({ message: 'Sign in to continue.' })
  try {
    const payload = jwt.verify(header.slice(7), secret()) as { userId?: number }
    if (!payload.userId) throw new Error('missing user')
    request.userId = payload.userId
    next()
  } catch {
    response.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
}

export async function publicUser(userId: number) {
  const result = await pool.query('SELECT id, display_name AS "displayName", username, email FROM users WHERE id = $1', [userId])
  return result.rows[0]
}

export async function hashPassword(password: string) { return bcrypt.hash(password, 10) }
export async function checkPassword(password: string, hash: string) { return bcrypt.compare(password, hash) }
