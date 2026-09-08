import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'vstu-schedule.json')
const API = 'https://schedule.vstu.by/api/v1'

function mapWeekType(value) {
  if (/числ/i.test(value)) return 'num'
  if (/знам/i.test(value)) return 'den'
  return 'always'
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

try {
  const [weekRaw, teachersRaw] = await Promise.all([
    getJson('/schedule/week'),
    getJson('/schedule/teacher/all'),
  ])
  const teachers = teachersRaw.map((t) => ({
    id: t.id,
    surname: t.surname ?? '',
    n: t.firstLetterName ?? '',
    p: t.firstLetterPatronymic ?? '',
    name: t.fullName ?? '',
  }))
  const lessons = []
  await mapPool(teachers, 8, async (teacher) => {
    const rows = await getJson(`/schedule/teacher/${teacher.id}`)
    for (const row of rows) {
      if (!row?.lessonNumber) continue
      lessons.push({
        teacherId: teacher.id,
        day: row.lessonDay,
        num: row.lessonNumber,
        week: mapWeekType(row.weekType ?? ''),
        frame: row.frame || 0,
        room: row.location ?? '',
        title: row.disciplineName ?? '',
        kind: row.shortTypeClassName || row.typeClassName || '',
        group: row.group?.name ?? '',
        from: row.startDate ?? '',
        to: row.endDate ?? '',
        off: row.timeOffset || 0,
        corr: Boolean(row.correspondence),
      })
    }
  })
  const bundle = {
    fetchedAt: new Date().toISOString(),
    week: {
      number: Number(weekRaw.numberOfWeek) || 0,
      name: weekRaw.nameOfWeek ?? '',
      date: weekRaw.date ?? '',
      day: Number(weekRaw.day) || 0,
    },
    teachers,
    lessons,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(bundle)}\n`)
  console.log(
    `vstu-schedule.json: ${teachers.length} teachers, ${lessons.length} lessons`,
  )
} catch (err) {
  console.warn('Could not refresh VSTU schedule cache:', err)
  process.exitCode = 0
}
