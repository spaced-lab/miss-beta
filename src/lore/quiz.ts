// WHAT: The Learning Center quiz (IDEAS 18, EDUCATION 9): three-choice questions, scored, each linked to a topic.
// WHY:  Reading is passive; a question asks the player to use what they read. Never blocks progress.
// HOW:  Questions live in config/quiz.json. `quizOrder(group)` puts the current topic group's questions first.
//       QuizState is plain data; the Learning Center draws it and feeds key presses to `answer` and `next`.
// LORE: G1 (how to play), C1

import quizJson from '../config/quiz.json';

export interface Question {
  topic: string;
  q: string;
  a: string[];
  right: number;
  why: string;
}

export const QUESTIONS: readonly Question[] = (quizJson as { questions: Question[] }).questions;

/** Indices into QUESTIONS, the given group's questions first (group = the topic id's letter). */
export function quizOrder(group: string): number[] {
  const idx = QUESTIONS.map((_, i) => i);
  return [...idx.filter((i) => QUESTIONS[i]?.topic.startsWith(group)), ...idx.filter((i) => !QUESTIONS[i]?.topic.startsWith(group))];
}

export interface QuizState {
  order: number[];
  pos: number;
  /** The choice made for the current question, or -1. */
  chosen: number;
  right: number;
  asked: number;
}

export function startQuiz(group: string): QuizState {
  return { order: quizOrder(group), pos: 0, chosen: -1, right: 0, asked: 0 };
}

export function current(st: QuizState): Question | null {
  return QUESTIONS[st.order[st.pos % st.order.length] ?? 0] ?? null;
}

/** Record an answer once per question; returns whether it was right. */
export function answer(st: QuizState, choice: number): boolean {
  const q = current(st);
  if (!q || st.chosen >= 0) return false;
  st.chosen = choice;
  st.asked++;
  const ok = choice === q.right;
  if (ok) st.right++;
  return ok;
}

export function next(st: QuizState): void {
  st.pos = (st.pos + 1) % st.order.length;
  st.chosen = -1;
}
