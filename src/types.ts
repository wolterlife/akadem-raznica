export type Owner = 'D' | 'M'
export type AssessmentType =
  | 'exam'
  | 'credit'
  | 'diff_credit'
  | 'coursework'
  | 'course_project'
  | 'practice'
export type ColumnId = 'd' | 'm' | 'shared' | 'done'
export type MatchKind = 'ideal' | 'professor' | 'none'

export interface Assessment {
  id: string
  subject: string
  short: string
  /** Кафедра (пока вместо ФИО препода — в листе только кафедра) */
  professor: string
  type: AssessmentType
  owners: Owner[]
  column: ColumnId
  note?: string
}

export interface ColumnDef {
  id: ColumnId
  title: string
  subtitle: string
}

export const TYPE_LABEL: Record<AssessmentType, string> = {
  exam: 'экзамен',
  credit: 'зачёт',
  diff_credit: 'дифф.зачёт',
  coursework: 'курс.раб.',
  course_project: 'курс.пр.',
  practice: 'практика',
}
