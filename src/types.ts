export type Owner = 'D' | 'M'
export type AssessmentType = 'exam' | 'credit'
export type ColumnId = 'd' | 'm' | 'shared' | 'done'
export type MatchKind = 'ideal' | 'professor' | 'none'

export interface Assessment {
  id: string
  subject: string
  short: string
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
