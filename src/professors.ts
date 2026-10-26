export const UNKNOWN_PROFESSOR = '????? ?????'

export interface ProfessorProfile {
  name: string
  photo: string
  role: string
  page?: string
}

/** Пустое ФИО, прочерки или одни знаки вопроса. */
export function isUnknownProfessor(name: string) {
  const n = name.trim()
  if (!n || n === '—' || n === '-' || n === '–') return true
  return /^[?？]+(?:\s+[?？]+)*$/.test(n)
}

export function professorLabel(name: string) {
  return isUnknownProfessor(name) ? UNKNOWN_PROFESSOR : name.trim()
}

const CATALOG: ProfessorProfile[] = [
  {
    name: 'Казаков Вадим Евгеньевич',
    photo: 'kazakov.jpg',
    role: 'к. т. н., доцент, зав. каф. ИСиТ',
    page: 'https://isit.vstu.by/index.php/structure/employees/kazakov',
  },
  {
    name: 'Коваленко Александр Вильямович',
    photo: 'kovalenko.jpg',
    role: 'ст. преподаватель, зам. зав. каф. МиИТ',
    page: 'https://miit.vstu.by/department/staff/management/kovalenko-aleksandr-vilyamovich/',
  },
  {
    name: 'Костырева Светлана Степановна',
    photo: 'kostyreva.jpg',
    role: 'к. филол. н., доцент, зав. каф. иностранных языков',
    page: 'https://forlang.vstu.by/',
  },
  {
    name: 'Науменко Андрей Михайлович',
    photo: 'naumenko.png',
    role: 'к. т. н., доцент, зав. каф. АПП',
    page: 'https://at.vstu.by/department/staff/management/naumenko-andrej-mihajlovich/',
  },
  {
    name: 'Никонова Татьяна Викторовна',
    photo: 'nikonova.jpg',
    role: 'к. ф.-м. н., доцент, зав. каф. МиИТ',
    page: 'https://miit.vstu.by/department/staff/management/nikonova-tatyana-viktorovna/',
  },
  {
    name: 'Рудко Елена Антоновна',
    photo: 'rudko.jpg',
    role: 'к. филос. н., доцент, зам. зав. каф. СГД',
    page: 'https://sgd.vstu.by/department/staff/management/rudko-elena-antonovna/',
  },
  {
    name: 'Советникова Ольга Петровна',
    photo: 'sovetnikova.jpg',
    role: 'к. э. н., доцент, зав. каф. маркетинга и финансов',
    page: 'https://mif.vstu.by/department/staff/management/sovetnikova-olga-petrovna/',
  },
  {
    name: 'Субботин Александр Александрович',
    photo: 'subbotin.jpg',
    role: 'к. ист. н., доцент, зав. каф. СГД',
    page: 'https://sgd.vstu.by/department/staff/management/subbotin-aleksandr-aleksandrovich/',
  },
  {
    name: 'Хаданёнак Виктор Мамертович',
    photo: 'hadanyonak.jpg',
    role: 'к. ист. н., доцент каф. СГД',
    page: 'https://sgd.vstu.by/department/staff/mainstaff/hadanyonak-viktor-mamertovich/',
  },
]

function nameKey(value: string) {
  const n = value.trim().toLowerCase()
  if (!n || n === '—' || n === '-' || n === '–' || n === '?') return null
  return n
}

const byKey = new Map(
  CATALOG.flatMap((p) => {
    const key = nameKey(p.name)
    return key ? [[key, p] as const] : []
  }),
)

export function lookupProfessor(name: string): ProfessorProfile | null {
  const key = nameKey(name)
  if (!key) return null
  return byKey.get(key) ?? null
}

export function professorPhotoUrl(profile: ProfessorProfile) {
  return `${import.meta.env.BASE_URL}professors/${profile.photo}`
}

export function professorSearchUrl(name: string) {
  return `https://yandex.ru/images/search?text=${encodeURIComponent(`${name} ВГТУ Витебск`)}`
}
