import { z } from "zod";
import { newQuestion, questionSchema, type Question } from "./model";
export const contentCategories = [
  "Science",
  "Tech",
  "Geography",
  "Work safety",
  "General",
  "Sports",
] as const;
export const ideaCategories = ["All", ...contentCategories] as const;
export type IdeaCategory = (typeof ideaCategories)[number];
export type QuestionIdea = {
  id: string;
  category: Exclude<IdeaCategory, "All">;
  type: "mc" | "tf";
  prompt: string;
  revealFact?: string;
  answers: readonly string[];
  correctIndex: number;
  timeLimit: Question["timeLimit"];
  basePoints: Question["basePoints"];
};
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
    revealFact: idea.revealFact,
    options,
    correctOptionId: options[idea.correctIndex]?.id,
    timeLimit: idea.timeLimit,
    basePoints: idea.basePoints,
  });
}

export const ideaItemSchema = z
  .object({
    id: z.string().min(1).max(80),
    category: z.enum(contentCategories),
    kind: z.enum(["mc", "tf"]),
    prompt: z.string().min(1).max(250),
    revealFact: z.string().trim().max(160).optional(),
    timeSeconds: z.union([
      z.literal(10),
      z.literal(20),
      z.literal(30),
      z.literal(60),
      z.literal(90),
      z.literal(120),
    ]),
    points: z.union([z.literal(0), z.literal(1000), z.literal(2000)]),
    options: z.array(z.string().trim().min(1).max(150)).min(2).max(4),
    correctIndex: z.number().int().min(0).max(3),
  })
  .superRefine((item, ctx) => {
    if (
      item.correctIndex >= item.options.length ||
      (item.kind === "tf" &&
        (item.options.length !== 2 ||
          item.options[0] !== "True" ||
          item.options[1] !== "False"))
    )
      ctx.addIssue({ code: "custom", message: "Invalid idea answers" });
  });
export type IdeaItem = z.infer<typeof ideaItemSchema>;
export type IdeasPage = {
  items: IdeaItem[];
  nextCursor: string | null;
  total: number;
};
export function toQuestionIdea(item: IdeaItem): QuestionIdea {
  return {
    id: item.id,
    category: item.category,
    type: item.kind,
    prompt: item.prompt,
    revealFact: item.revealFact,
    answers: [...item.options],
    correctIndex: item.correctIndex,
    timeLimit: item.timeSeconds,
    basePoints: item.points,
  };
}
