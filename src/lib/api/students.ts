import { supabase } from '../supabase'
import type {
  EnrollmentStatus,
  ParentManagementStatus,
  ParentStatusHistory,
  Student,
  StudentClassHistoryRow,
  Tag,
} from '../types'
import { CLASS_SELECT, normalizeClassRow, normalizeStudentRow } from './_shared'

export async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select(`*, classes(${CLASS_SELECT})`)
    .order('korean_name')
  if (error) throw error
  return (data ?? []).map((row) => normalizeStudentRow(row as Record<string, unknown>))
}

export async function fetchStudentsByClass(classId: string): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select(`*, classes(${CLASS_SELECT})`)
    .eq('class_id', classId)
    .order('korean_name')
  if (error) throw error
  return (data ?? []).map((row) => normalizeStudentRow(row as Record<string, unknown>))
}

export async function fetchStudent(id: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from('students')
    .select(`*, classes(${CLASS_SELECT})`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeStudentRow(data as Record<string, unknown>) : null
}

export async function createStudent(input: {
  korean_name: string
  english_name?: string | null
  class_id?: string | null
  enrollment_status?: EnrollmentStatus
  parent_management_status?: ParentManagementStatus
}): Promise<Student> {
  const { data, error } = await supabase.rpc('create_student', {
    p_korean_name: input.korean_name,
    p_english_name: input.english_name ?? null,
    p_class_id: input.class_id ?? null,
    p_enrollment_status: input.enrollment_status ?? 'active',
    p_parent_management_status: input.parent_management_status ?? 'unclassified',
  })
  if (error) throw error
  return data as Student
}

export async function updateStudent(
  id: string,
  patch: Partial<{
    korean_name: string
    english_name: string | null
    enrollment_status: EnrollmentStatus
    accent_color: string | null
  }>,
): Promise<void> {
  const { error } = await supabase.from('students').update(patch).eq('id', id)
  if (error) throw error
}

/** Atomic: close current history + open new + update students.class_id */
export async function changeStudentClass(input: {
  student_id: string
  new_class_id: string
  start_date?: string
  note?: string
}): Promise<Student> {
  const { data, error } = await supabase.rpc('change_student_class', {
    p_student_id: input.student_id,
    p_new_class_id: input.new_class_id,
    p_start_date: input.start_date ?? null,
    p_note: input.note ?? null,
  })
  if (error) throw error
  return data as Student
}

export async function clearStudentClass(input: {
  student_id: string
  end_date?: string
  note?: string
}): Promise<Student> {
  const { data, error } = await supabase.rpc('clear_student_class', {
    p_student_id: input.student_id,
    p_end_date: input.end_date ?? null,
    p_note: input.note ?? null,
  })
  if (error) throw error
  return data as Student
}

export async function fetchStudentClassHistory(
  studentId: string,
): Promise<StudentClassHistoryRow[]> {
  const { data, error } = await supabase
    .from('student_class_history')
    .select(
      `id, student_id, class_id, start_date, end_date, is_current, note, created_at,
       classes(${CLASS_SELECT})`,
    )
    .eq('student_id', studentId)
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      student_id: r.student_id as string,
      class_id: r.class_id as string,
      start_date: r.start_date as string,
      end_date: (r.end_date as string | null) ?? null,
      is_current: Boolean(r.is_current),
      note: (r.note as string | null) ?? null,
      created_at: r.created_at as string,
      classes: r.classes
        ? normalizeClassRow(r.classes as Record<string, unknown>)
        : null,
    }
  })
}

export async function changeParentStatus(
  studentId: string,
  newStatus: ParentManagementStatus,
  reason?: string,
): Promise<Student> {
  const { data, error } = await supabase.rpc('change_parent_management_status', {
    p_student_id: studentId,
    p_new_status: newStatus,
    p_reason: reason ?? null,
  })
  if (error) throw error
  return data as Student
}

export async function fetchParentHistory(studentId: string): Promise<ParentStatusHistory[]> {
  const { data, error } = await supabase
    .from('parent_status_history')
    .select('*')
    .eq('student_id', studentId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
