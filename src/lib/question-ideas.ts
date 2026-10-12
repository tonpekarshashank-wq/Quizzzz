import { newQuestion, questionSchema, type Question } from "./model";
export const ideaCategories = [
  "All",
  "Science",
  "Tech",
  "Geography",
  "Work safety",
  "General",
] as const;
export type IdeaCategory = (typeof ideaCategories)[number];
export type QuestionIdea = {
  id: string;
  category: Exclude<IdeaCategory, "All">;
  type: "mc" | "tf";
  prompt: string;
  answers: readonly string[];
  correctIndex: number;
  timeLimit: Question["timeLimit"];
  basePoints: Question["basePoints"];
};
export const questionIdeas: readonly QuestionIdea[] = [
  {
    id: "science-mercury",
    category: "Science",
    type: "mc",
    prompt: "Which planet is closest to the Sun?",
    answers: ["Mercury", "Venus", "Earth", "Mars"],
    correctIndex: 0,
    timeLimit: 20,
    basePoints: 1000,
  },
  {
    id: "science-star",
    category: "Science",
    type: "tf",
    prompt: "The Sun is a star.",
    answers: ["True", "False"],
    correctIndex: 0,
    timeLimit: 10,
    basePoints: 1000,
  },
  {
    id: "science-symbol",
    category: "Science",
    type: "mc",
    prompt: "What is the chemical symbol for gold?",
    answers: ["Ag", "Au", "Fe", "Cu"],
    correctIndex: 1,
    timeLimit: 30,
    basePoints: 2000,
  },
  {
    id: "tech-cpu",
    category: "Tech",
    type: "mc",
    prompt: "What does CPU stand for?",
    answers: [
      "Central Processing Unit",
      "Computer Power Utility",
      "Central Program Update",
      "Control Panel Unit",
    ],
    correctIndex: 0,
    timeLimit: 30,
    basePoints: 1000,
  },
  {
    id: "tech-binary",
    category: "Tech",
    type: "tf",
    prompt: "Binary numbers use only the digits 0 and 1.",
    answers: ["True", "False"],
    correctIndex: 0,
    timeLimit: 20,
    basePoints: 1000,
  },
  {
    id: "geography-ocean",
    category: "Geography",
    type: "mc",
    prompt: "Which ocean is the largest?",
    answers: ["Atlantic", "Indian", "Pacific", "Arctic"],
    correctIndex: 2,
    timeLimit: 20,
    basePoints: 1000,
  },
  {
    id: "geography-capital",
    category: "Geography",
    type: "mc",
    prompt: "What is the capital of Japan?",
    answers: ["Kyoto", "Osaka", "Tokyo", "Sapporo"],
    correctIndex: 2,
    timeLimit: 20,
    basePoints: 1000,
  },
  {
    id: "safety-exits",
    category: "Work safety",
    type: "tf",
    prompt: "It is acceptable to block an emergency exit with storage boxes.",
    answers: ["True", "False"],
    correctIndex: 1,
    timeLimit: 20,
    basePoints: 1000,
  },
  {
    id: "general-week",
    category: "General",
    type: "mc",
    prompt: "How many days are in a week?",
    answers: ["Five", "Six", "Seven", "Eight"],
    correctIndex: 2,
    timeLimit: 10,
    basePoints: 0,
  },
];
export function questionFromIdea(idea: QuestionIdea): Question {
  const question = newQuestion(idea.type);
  const options = idea.answers.map((label) => ({
    id: crypto.randomUUID(),
    label,
  }));
  return questionSchema.parse({
    ...question,
    sourceIdeaId: idea.id,
    prompt: idea.prompt,
    options,
    correctOptionId: options[idea.correctIndex]?.id,
    timeLimit: idea.timeLimit,
    basePoints: idea.basePoints,
  });
}
