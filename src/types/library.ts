export type ModuleType = 'quiz' | 'vote' | 'scenario' | 'gamification' | 'reflection';

export interface LibraryItem {
  id: string;
  lektorId: string;
  type: ModuleType;
  title: string;
  question: string;
  options: string[];
  timeLimit: number;
  correctAnswer?: string;
  points?: number;
  createdAt: number;
  updatedAt: number;
  setName?: string;
}

export interface TrainingSet {
  id: string;
  lektorId: string;
  title: string;
  description: string;
  items: LibraryItem[];
  createdAt: number;
  updatedAt: number;
}
