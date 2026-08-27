export type Owner = 'D' | 'M'
export type AssessmentType =
  | 'exam'
  | 'credit'
  | 'diff_credit'
  | 'coursework'
  | 'course_project'
  | 'practice'
export type ColumnId = 'd' | 'm' | 'done'
export type MatchKind = 'ideal' | 'alike' | 'subject' | 'professor' | 'none'

export interface Assessment {
  id: string
  subject: string
  short: string
  /** ФИО преподавателя (пусто — ещё не указан) */
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
