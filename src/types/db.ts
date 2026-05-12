export type UserStatus = 'active' | 'blocked' | 'deleted'
export type SoupDifficulty = 'easy' | 'medium' | 'hard'
export type SoupStatus = 'draft' | 'published' | 'archived'
export type RoomStatus = 'waiting' | 'playing' | 'revealed' | 'finished'
export type RoomMode = 'casual' | 'ranked' | 'private'
export type GameAnswerType = 'yes' | 'no' | 'irrelevant'

export interface UserRow {
  id: string
  username: string
  nickname: string
  email: string
  password_hash: string
  password_salt: string
  avatar_url: string | null
  bio: string
  roles: string
  status: UserStatus
  last_login_at: number | null
  created_at: number
  updated_at: number
}

export interface SoupRow {
  id: string
  title: string
  subtitle: string | null
  description: string
  content: string
  answer: string
  difficulty: SoupDifficulty
  tags: string
  created_by: string
  is_public: number
  status: SoupStatus
  favorite_count: number
  created_at: number
  updated_at: number
}

export interface RoomRow {
  id: string
  room_code: string
  name: string
  description: string
  status: RoomStatus
  mode: RoomMode
  host_user_id: string
  current_round_id: string | null
  current_soup_id: string | null
  capacity: number
  settings: string
  last_activity_at: number
  created_at: number
  updated_at: number
  started_at: number | null
  ended_at: number | null
}

export interface GameRoundRow {
  id: string
  room_id: string
  soup_id: string | null
  host_user_id: string
  room_code_snapshot: string
  room_name_snapshot: string
  soup_title_snapshot: string | null
  soup_answer_snapshot: string | null
  round_no: number
  state: RoomStatus
  answer_revealed: number
  question_count: number
  result_summary: string | null
  started_at: number
  ended_at: number | null
}

export interface GameQuestionRow {
  id: string
  round_id: string
  room_id: string
  asker_user_id: string
  asker_nickname_snapshot: string
  question_text: string
  answer_type: GameAnswerType | null
  answer_text: string | null
  answered_by_user_id: string | null
  answered_by_nickname_snapshot: string | null
  asked_at: number
  answered_at: number | null
  ordinal: number
}

export interface FavoriteRow {
  id: string
  user_id: string
  soup_id: string
  created_at: number
}

export interface RefreshTokenRow {
  id: string
  user_id: string
  token_hash: string
  expires_at: number
  revoked_at: number | null
  created_at: number
}
