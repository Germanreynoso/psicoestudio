export type Level = 'Repetición Literal' | 'Comprensión Básica' | 'Integración Conceptual' | 'Pensamiento Crítico';

export interface Evaluation {
    score: number;
    level: Level;
    feedback: string;
    accurate_points: string[];
    missing_points: string[];
    practical_implications?: string;
}

export interface Question {
    id: string;
    text: string;
    authors: string[];
    difficulty: number;
    expected_concepts: string[];
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    evaluation?: Evaluation;
}

export interface ExamSession {
    id: string;
    started_at: Date;
    finished_at?: Date;
    messages: ChatMessage[];
    overall_score: number;
}
