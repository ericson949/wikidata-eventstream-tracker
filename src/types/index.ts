export interface Country {
  id: string;
  name: string;
  flag?: string;
  code?: string;
  region?: string;
}

export interface PoliticalParty {
  id: string | null;
  name: string;
}

export interface PositionHeld {
  id: string | null;
  name: string;
}

export interface VoteStats {
  hearts: number;
  likes: number;
  dislikes: number;
  horrors: number;
}

export interface OpinionStats extends VoteStats {
  total: number;
}

export interface QuestionVoteStats {
  yes: number;
  no: number;
  total: number;
}

export interface PoliticianVoteData {
  opinion: OpinionStats;
  questions: Record<string, QuestionVoteStats>; // keyed by question_id
}

export interface Question {
  id: string;
  text: string;
  active: boolean;
  start_date: string;
  end_date?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface VoteRecord {
  id: string;
  politician_id: string;
  vote_type: 'opinion' | 'question';
  value: 'hearts' | 'likes' | 'dislikes' | 'horrors' | 'yes' | 'no';
  question_id: string | null;
  fingerprint: string;
  timestamp: string;
  age_range?: string | null;
  region?: string | null;
  gender?: string | null;
}

export type DemographicData = {
  age_range?: string;
  region?: string;
  gender?: string;
};

export interface Politician {
  id: string;
  fullname: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  biography?: string;
  birth_date?: string | null;
  death_date?: string | null;
  actor_state?: string;
  status: 'Activé' | 'Désactivé' | string;
  country?: Country;
  political_party?: PoliticalParty;
  position_held?: PositionHeld;
  photo_url?: string | null;
  source_url?: string;
  wikidata_url?: string;
  description?: string;
  votes?: VoteStats;
  // Vote feature flags
  vote_enabled?: boolean;
  block1_enabled?: boolean;
  block2_enabled?: boolean;
}

export interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
}

export type EntityType = 'politician' | 'country';
export type AdminTabType = 'politicians' | 'countries' | 'surveys';
export type VoteEmotion = 'hearts' | 'likes' | 'dislikes' | 'horrors';
export type VoteAnswer = 'yes' | 'no';
export type VotePeriod = 'day' | 'week' | 'month' | 'all';
