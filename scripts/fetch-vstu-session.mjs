import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Расписание сессии группы с датами: GET /schedule/group/{id} */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'vstu-session.json')
const API = 'https://schedule.vstu.by/api/v1'
const GROUP_ID = 9337

try {
  const res = await fetch(`${API}/schedule/group/${GROUP_ID}`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`${res.status} /schedule/group/${GROUP_ID}`)
  const rows = await res.json()
  const lessons = rows
    .filter((r) => r?.lessonNumber && r?.startDate)
    .map((r) => ({
      date: r.startDate,
      to: r.endDate ?? r.startDate,
      num: r.lessonNumber,
      off: r.timeOffset || 0,
      sub: r.subGroup && r.subGroup !== 'Все' ? String(r.subGroup) : '',
      kind: r.typeClassName ?? '',
      title: r.disciplineName ?? '',
      teacher: r.teacher?.fullName ?? '',
      teacherId: r.teacher?.id ?? 0,
      frame: r.frame || 0,
      room: r.location ?? '',
    }))
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    `${JSON.stringify({ fetchedAt: new Date().toISOString(), groupId: GROUP_ID, lessons })}\n`,
  )
  console.log(`vstu-session.json: ${lessons.length} lessons`)
} catch (err) {
  console.warn('Could not refresh VSTU session cache:', err)
  process.exitCode = 0
}
