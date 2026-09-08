import { createContext, useContext } from 'react'
import { minskClock, presenceOf, type Presence, type VstuLesson, type VstuTeacher, type WeekKind } from './schedule'

export interface WhereState {
  ready: boolean
  weekLabel: string
  weekKind: Exclude<WeekKind, 'always'>
  clockDate: string
  clockDay: number
  clockMinutes: number
  teacherFor: (name: string) => VstuTeacher | null
  lessonsFor: (teacherId: number) => VstuLesson[]
  presenceFor: (name: string) => Presence
}

export const EMPTY_WHERE: WhereState = {
  ready: false,
  weekLabel: '',
  weekKind: 'den',
  clockDate: '',
  clockDay: 0,
  clockMinutes: 0,
  teacherFor: () => null,
  lessonsFor: () => [],
  presenceFor: () => presenceOf(null, [], minskClock(), 'den'),
}

export const WhereContext = createContext<WhereState>(EMPTY_WHERE)

export function useWhere() {
  return useContext(WhereContext)
}
