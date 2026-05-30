export type UserRole = 'lektor' | 'participant';

export interface Session {
  id: string;
  code: string;
  lektorId: string;
  lektorName: string;
  title: string;
  status: 'waiting' | 'active' | 'finished';
  currentModule: string | null;
  createdAt: number;
}

export interface Participant {
  id: string;
  nickname: string;
  sessionId: string;
  teamId?: string;
  score: number;
  joinedAt: number;
}

export interface Module {
  id: string;
  type: 'scenario' | 'quiz' | 'vote' | 'gamification' | 'reflection';
  title: string;
  status: 'pending' | 'active' | 'finished';
  data: Record<string, unknown>;
}

export interface Question {
  id: string;
  text: string;
  type: 'single' | 'multiple' | 'open' | 'wordcloud';
  options?: string[];
  correctAnswer?: string | string[];
  timeLimit?: number;
}

export interface Answer {
  participantId: string;
  nickname: string;
  questionId: string;
  answer: string | string[];
  answeredAt: number;
  score?: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  memberIds: string[];
}
