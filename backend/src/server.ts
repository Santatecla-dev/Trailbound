import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { checkPassword, hashPassword, publicUser, requireAuth, tokenFor, type AuthRequest } from './auth.js'
import { initDb, pool } from './db.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '32kb' }))

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const email = (value: unknown) => clean(value, 160).toLowerCase()
const username = (value: unknown) => clean(value, 32).toLowerCase()
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : ''

app.get('/api/health', (_request, response) => response.json({ ok: true, name: 'Trailbound API' }))

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const body = request.body as Record<string, unknown>
    const displayName = clean(body.displayName, 80)
    const user = username(body.username)
    const mail = email(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    if (displayName.length < 2 || !/^[a-z0-9_-]{3,32}$/.test(user) || !/^\S+@\S+\.\S+$/.test(mail) || password.length < 8) {
      return response.status(400).json({ message: 'Enter a name, valid username, email and password of at least 8 characters.' })
    }
    const inserted = await pool.query<{ id: number }>('INSERT INTO users (display_name, username, email, password_hash) VALUES ($1,$2,$3,$4) RETURNING id', [displayName, user, mail, await hashPassword(password)])
    const account = await publicUser(inserted.rows[0].id)
    response.status(201).json({ user: account, token: tokenFor(inserted.rows[0].id) })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return response.status(409).json({ message: 'That username or email is already in use.' })
    next(error)
  }
})

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const body = request.body as Record<string, unknown>
    const login = clean(body.login, 160).toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''
    const result = await pool.query('SELECT id, password_hash FROM users WHERE username = $1 OR email = $1', [login])
    if (!result.rows[0] || !(await checkPassword(password, result.rows[0].password_hash))) return response.status(401).json({ message: 'Those details did not match.' })
    const account = await publicUser(result.rows[0].id)
    response.json({ user: account, token: tokenFor(result.rows[0].id) })
  } catch (error) { next(error) }
})

app.get('/api/me', requireAuth, async (request: AuthRequest, response, next) => {
  try { response.json({ user: await publicUser(request.userId!) }) } catch (error) { next(error) }
})

app.get('/api/trips', requireAuth, async (request: AuthRequest, response, next) => {
  try {
    const result = await pool.query(`SELECT id, title, location, to_char(starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(ends_on, 'YYYY-MM-DD') AS "endsOn", starts_on = ends_on AS "dayTrip", difficulty, distance_km AS "distanceKm", notes FROM trips WHERE user_id = $1 ORDER BY starts_on ASC, id ASC`, [request.userId])
    response.json({ trips: result.rows })
  } catch (error) { next(error) }
})

app.post('/api/trips', requireAuth, async (request: AuthRequest, response, next) => {
  try {
    const body = request.body as Record<string, unknown>
    const title = clean(body.title, 120)
    const location = clean(body.location, 160)
    const startsOn = date(body.startsOn)
    const dayTrip = body.dayTrip === true || body.dayTrip === 'true'
    const endsOn = dayTrip ? startsOn : date(body.endsOn)
    const difficulty = body.difficulty
    const distance = body.distanceKm === '' || body.distanceKm === undefined ? null : Number(body.distanceKm)
    const notes = clean(body.notes, 1200) || null
    if (!title || !location || !startsOn || !endsOn || endsOn < startsOn || !['gentle', 'moderate', 'challenging'].includes(String(difficulty)) || (distance !== null && (!Number.isFinite(distance) || distance < 0))) {
      return response.status(400).json({ message: 'Complete the dates, place, difficulty and trip details correctly.' })
    }
    const result = await pool.query(`INSERT INTO trips (user_id, title, location, starts_on, ends_on, difficulty, distance_km, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, title, location, to_char(starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(ends_on, 'YYYY-MM-DD') AS "endsOn", starts_on = ends_on AS "dayTrip", difficulty, distance_km AS "distanceKm", notes`, [request.userId, title, location, startsOn, endsOn, difficulty, distance, notes])
    response.status(201).json({ trip: result.rows[0] })
  } catch (error) { next(error) }
})

app.patch('/api/trips/:id', requireAuth, async (request: AuthRequest, response, next) => {
  try {
    const id = Number(request.params.id)
    const existing = await pool.query('SELECT * FROM trips WHERE id = $1 AND user_id = $2', [id, request.userId])
    if (!existing.rows[0]) return response.status(404).json({ message: 'Trip not found.' })
    const body = request.body as Record<string, unknown>
    const title = clean(body.title, 120)
    const location = clean(body.location, 160)
    const startsOn = date(body.startsOn)
    const dayTrip = body.dayTrip === true || body.dayTrip === 'true'
    const endsOn = dayTrip ? startsOn : date(body.endsOn)
    const difficulty = body.difficulty
    const distance = body.distanceKm === '' || body.distanceKm === undefined ? null : Number(body.distanceKm)
    const notes = clean(body.notes, 1200) || null
    if (!title || !location || !startsOn || !endsOn || endsOn < startsOn || !['gentle', 'moderate', 'challenging'].includes(String(difficulty)) || (distance !== null && (!Number.isFinite(distance) || distance < 0))) {
      return response.status(400).json({ message: 'Complete the dates, place, difficulty and trip details correctly.' })
    }
    const result = await pool.query(`UPDATE trips SET title = $1, location = $2, starts_on = $3, ends_on = $4, difficulty = $5, distance_km = $6, notes = $7 WHERE id = $8 AND user_id = $9 RETURNING id, title, location, to_char(starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(ends_on, 'YYYY-MM-DD') AS "endsOn", starts_on = ends_on AS "dayTrip", difficulty, distance_km AS "distanceKm", notes`, [title, location, startsOn, endsOn, difficulty, distance, notes, id, request.userId])
    response.json({ trip: result.rows[0] })
  } catch (error) { next(error) }
})

app.delete('/api/trips/:id', requireAuth, async (request: AuthRequest, response, next) => {
  try {
    await pool.query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [Number(request.params.id), request.userId])
    response.status(204).end()
  } catch (error) { next(error) }
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error)
  response.status(500).json({ message: 'Something went wrong.' })
})

const port = Number(process.env.PORT ?? 4002)
const start = async () => { await initDb(); app.listen(port, () => console.log(`Trailbound API listening on http://localhost:${port}`)) }
if (process.env.NODE_ENV !== 'test') void start().catch((error) => { console.error(error); process.exitCode = 1 })
export { app }
