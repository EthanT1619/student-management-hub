export type EnrollmentStatus = 'active' | 'inactive' | 'withdrawn'
export type ParentManagementStatus =
  | 'unclassified'
  | 'stable'
  | 'intensive_care'
  | 'retention_risk'
  | 'temporary_leave'
  | 'withdrawn'
  | 'new_student'
export type RecordType =
  | 'observation'
  | 'guidance'
  | 'parent_contact'
  | 'positive_note'
  | 'stamp'
  | 'general_note'
export type ContactMethod = 'phone' | 'message' | 'in_person' | 'other'
export type StampStatus = 'pending' | 'given'
export type FollowupStatus = 'open' | 'done'
export type FocusItemStatus = 'open' | 'done'
export type TagCategory = 'academic' | 'learning_management' | 'classroom_state'
export type DaysCode = 'MWF' | 'TT' | 'MW' | 'TF' | 'FS' | 'MTWTF' | 'UNSET'

export interface LevelRow {
  id: string
  name: string
  sort_order: number
}

export interface TermRow {
  id: string
  name: string
  start_date: string
  end_date: string | null
  is_current: boolean
}

export interface ClassRow {
  id: string
  term_id: string
  level_id: string
  days_code: DaysCode | string
  period: string
  is_active: boolean
  sort_order: number
  levels?: LevelRow | null
  terms?: TermRow | null
}

export interface StudentClassHistoryRow {
  id: string
  student_id: string
  class_id: string
  start_date: string
  end_date: string | null
  is_current: boolean
  note: string | null
  created_at: string
  classes?: ClassRow | null
}

export interface Student {
  id: string
  korean_name: string
  english_name: string | null
  class_id: string | null
  accent_color: string | null
  enrollment_status: EnrollmentStatus
  parent_management_status: ParentManagementStatus
  created_at: string
  updated_at: string
  classes?: ClassRow | null
}

export interface Tag {
  id: string
  name: string
  category: TagCategory
  sort_order: number
  is_active: boolean
}

export interface CurrentFocusItem {
  id: string
  student_id: string
  title: string
  note: string | null
  tag_id: string | null
  status: FocusItemStatus
  sort_order: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface RecordRow {
  id: string
  student_id: string
  record_date: string
  record_type: RecordType
  content: string
  is_important: boolean
  contact_method: ContactMethod | null
  stamp_amount: number | null
  stamp_status: StampStatus | null
  stamp_given_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  students?: Pick<Student, 'id' | 'korean_name' | 'english_name' | 'accent_color'> | null
  record_tags?: { tag_id: string; tags: Tag | null }[]
  followups?: Followup[]
}

export interface Followup {
  id: string
  record_id: string
  due_date: string | null
  note: string
  status: FollowupStatus
  completed_at: string | null
  created_at: string
  updated_at: string
  records?: RecordRow | null
}

export interface ParentStatusHistory {
  id: string
  student_id: string
  status: ParentManagementStatus
  changed_at: string
  reason: string | null
  changed_by: string | null
  created_at: string
}

export type MessagePurpose =
  | 'dream_tree'
  | 'general_notice'
  | 'homework'
  | 'test'
  | 'level_test'
  | 'information_session'
  | 'consultation'
  | 'individual_feedback'
  | 'praise'
  | 'management'
  | 'other'

export type MessageTargetType = 'all' | 'class' | 'student'

export interface MessageTarget {
  id: string
  message_id: string
  target_type: MessageTargetType
  class_id: string | null
  student_id: string | null
  created_at: string
  classes?: ClassRow | null
  students?: Pick<Student, 'id' | 'korean_name' | 'english_name' | 'accent_color'> | null
}

export interface MessageRow {
  id: string
  message_date: string
  purpose: MessagePurpose
  title: string | null
  content: string
  notes: string | null
  is_template: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  message_targets?: MessageTarget[]
}

export type WorkNoteType =
  | 'faculty_meeting'
  | 'approval'
  | 'team_leader'
  | 'deputy_director'
  | 'instruction'
  | 'general'

export type WorkNoteStatus = 'open' | 'done'

export interface WorkFollowup {
  id: string
  work_note_id: string
  due_date: string | null
  note: string
  status: 'open' | 'done'
  completed_at: string | null
  created_at: string
  updated_at: string
  work_notes?: Pick<WorkNoteRow, 'id' | 'title' | 'content' | 'note_type' | 'source'> | null
}

export interface WorkNoteRow {
  id: string
  note_date: string
  note_type: WorkNoteType
  source: string | null
  title: string | null
  content: string
  is_important: boolean
  status: WorkNoteStatus
  created_by: string | null
  created_at: string
  updated_at: string
  work_note_students?: {
    student_id: string
    students?: Pick<Student, 'id' | 'korean_name' | 'english_name' | 'accent_color'> | null
  }[]
  work_note_classes?: {
    class_id: string
    classes?: ClassRow | null
  }[]
  work_followups?: WorkFollowup[]
}

export type CaseStatus = 'open' | 'monitoring' | 'resolved' | 'closed'
export type CasePriority = 'low' | 'normal' | 'high'
export type CaseType =
  | 'learning'
  | 'homework'
  | 'vocabulary'
  | 'class_participation'
  | 'behavior'
  | 'emotional'
  | 'parent_communication'
  | 'attendance'
  | 'other'

export interface CaseRow {
  id: string
  student_id: string
  title: string
  case_type: CaseType | null
  status: CaseStatus
  priority: CasePriority
  summary: string | null
  goal: string | null
  opened_at: string
  closed_at: string | null
  outcome: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  students?: Student | null
  case_records?: { record_id: string; created_at: string; records?: RecordRow | null }[]
}

export type HypothesisConfidence = 'low' | 'medium' | 'high'
export type HypothesisStatus = 'active' | 'supported' | 'unsupported' | 'closed'
export type InterventionType =
  | 'prompting'
  | 'modeling'
  | 'scaffolding'
  | 'positive_reinforcement'
  | 'choice'
  | 'goal_setting'
  | 'study_strategy'
  | 'environmental_change'
  | 'retrieval_practice'
  | 'direct_instruction'
  | 'emotional_support'
  | 'other'
export type ResponseType = 'positive' | 'neutral' | 'negative' | 'mixed' | 'unclear'

export interface StudentVoiceEntry {
  id: string
  student_id: string
  record_id: string | null
  case_id: string | null
  content: string
  recorded_at: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AbcObservation {
  id: string
  record_id: string
  student_id: string
  case_id: string | null
  antecedent: string | null
  behavior: string
  consequence: string | null
  teacher_response: string | null
  student_response: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContextTag {
  id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface WorkingHypothesis {
  id: string
  student_id: string
  case_id: string | null
  hypothesis: string
  confidence: HypothesisConfidence
  status: HypothesisStatus
  needs_more_observation: boolean
  status_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  hypothesis_records?: {
    record_id: string
    records?: (Pick<RecordRow, 'id' | 'record_date' | 'record_type' | 'content'> & {
      abc_observations?: { id: string }[] | { id: string } | null
    }) | null
  }[]
  hypothesis_interventions?: {
    intervention_id: string
    interventions?: Pick<
      Intervention,
      'id' | 'intervention_type' | 'description' | 'applied_at' | 'target'
    > | null
  }[]
}

export interface Intervention {
  id: string
  student_id: string
  record_id: string | null
  case_id: string | null
  intervention_type: InterventionType
  description: string
  target: string | null
  applied_at: string
  created_by: string | null
  created_at: string
  updated_at: string
  intervention_responses?: InterventionResponse[]
  hypothesis_interventions?: {
    hypothesis_id: string
    working_hypotheses?: Pick<
      WorkingHypothesis,
      'id' | 'hypothesis' | 'confidence' | 'status'
    > | null
  }[]
}

export interface InterventionResponse {
  id: string
  intervention_id: string
  response_date: string
  response: string
  response_type: ResponseType | null
  created_at: string
  updated_at: string
}

export interface DetailedTrackingSummary {
  activeHypotheses: number
  recentVoice: number
  activeInterventions: number
}

export interface ConsultationNote {
  id: string
  student_id: string
  consultation_date: string
  period_start: string | null
  period_end: string | null
  talking_points: string | null
  outcome: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
