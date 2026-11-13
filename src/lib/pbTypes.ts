import type { RecordModel } from "pocketbase";
import type { ScoreSnapshot, TeamScore } from "./scoring";

export interface WildcardState {
  question: string;
  team?: string;
  wager?: number | null;
  resolved?: boolean;
}

export interface AllInState {
  category?: string;
  question?: string;
  answer?: string;
  results?: Record<string, boolean>;
  order?: string[];
  revealed?: number;
  /** Score change applied to each team as it was revealed. */
  applied?: Record<string, number>;
}

export interface TeamRecord extends RecordModel {
  name: string;
  user?: string;
  isPublic?: boolean;
  color?: string;
  emoji?: string;
  members?: string[];
}

export interface QuestionCategoryRecord extends RecordModel {
  name: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  isPublic?: boolean;
  user?: string;
  expand?: {
    user?: RecordModel;
  };
}

export type MediaKind = "image" | "audio" | "video";
export type QuestionType = "buzzer" | "multiple_choice" | "typed" | "estimation";

export interface QuestionRecord extends RecordModel {
  question: string;
  answer: string;
  hint?: string;
  value?: number;
  category: string;
  difficulty?: number;
  tags?: string[];
  isPublic?: boolean;
  user?: string;
  media?: string;
  mediaUrl?: string;
  mediaType?: MediaKind | "";
  questionType?: QuestionType | "";
  options?: string[];
  expand?: {
    user?: RecordModel;
    category?: QuestionCategoryRecord;
  };
}

export interface GameTemplateRecord extends RecordModel {
  title: string;
  categories: string[];
  questions: string[];
  isPublic?: boolean;
  user?: string;
  expand?: {
    user?: RecordModel;
    categories?: QuestionCategoryRecord[];
    questions?: QuestionRecord[];
  };
}

export type WrongPenalty = "full" | "half" | "none";
export type WildcardCapMode = "standard" | "unlimited" | "fixed";
export type AllInCapMode = "score" | "score_or_top";
export type TvThemeMode = "dark" | "light";
export type BackgroundStyle = "gradient" | "solid" | "midnight";

export interface BrandingSettings {
  gameTitle?: string;
  accentColor?: string;
  logoUrl?: string;
  tvTheme?: TvThemeMode;
  backgroundStyle?: BackgroundStyle;
}

export type SoundEvent = "buzz" | "correct" | "wrong" | "timerEnd" | "allInReveal" | "wildcard";

export interface SoundSettings {
  muted?: boolean;
  volume?: number;
  enabledEvents?: Partial<Record<SoundEvent, boolean>>;
  customUrls?: Partial<Record<SoundEvent, string>>;
}

export interface GameSettings {
  wrongPenalty?: WrongPenalty;
  stealEnabled?: boolean;
  pointMultiplier?: number;
  customValues?: number[];
  wildcardEnabled?: boolean;
  wildcardCapMode?: WildcardCapMode;
  wildcardFixedCap?: number;
  allInEnabled?: boolean;
  allInCapMode?: AllInCapMode;
  buzzTimerSeconds?: number;
  answerTimerSeconds?: number;
  branding?: BrandingSettings;
  sound?: SoundSettings;
  allowSelfRegistration?: boolean;
}

export interface GameRecord extends RecordModel {
  title?: string;
  uniqueID: string;
  template: string;
  host?: string;
  teams: string[];
  categories?: string[];
  values?: number[];
  teamScores?: TeamScore[];
  answeredQuestions?: string[];
  buzzerQueue?: unknown[];
  currentActiveQuestion?: string | null;
  currentActiveTeam?: string | null;
  showAnswer?: boolean;
  buzzerUnlocked?: boolean;
  hostForceShowQuestion?: boolean;
  buzzRound?: number;
  scoreHistory?: ScoreSnapshot[];
  wildcards?: string[];
  wildcard?: WildcardState | null;
  allInPhase?: string;
  allIn?: AllInState | null;
  gameOver?: boolean;
  settings?: GameSettings;
  passedTeams?: string[];
  timerEndsAt?: string;
  timerType?: "buzz" | "answer" | "";
  timerPausedRemaining?: number | null;
  paused?: boolean;
  lockedTeams?: string[];
  cohostCode?: string;
  expand?: {
    template?: GameTemplateRecord;
    teams?: TeamRecord[];
  };
}

export interface BoardQuestion {
  id: string;
  question: string;
  answer: string;
  value: number;
  mediaUrl?: string;
  mediaType?: MediaKind;
  questionType?: QuestionType;
  options?: string[];
}

export interface AnswerRecord extends RecordModel {
  game: string;
  question: string;
  round: number;
  team: string;
  value: string;
}

export interface TeamRegistrationRecord extends RecordModel {
  game: string;
  name: string;
  color?: string;
  emoji?: string;
  members?: string[];
  status: "pending" | "approved" | "rejected";
}

export interface GameTeam {
  id: string;
  name: string;
  score: number;
  color?: string;
  emoji?: string;
  members?: string[];
}

export interface GameHistoryStanding {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  score: number;
}

export interface GameHistoryRecord extends RecordModel {
  host: string;
  gameCode: string;
  title: string;
  winnerName?: string;
  winnerScore?: number;
  standings?: GameHistoryStanding[];
  finishedAt?: string;
}

