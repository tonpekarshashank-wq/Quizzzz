import { z } from "zod";
export const times = [10, 20, 30, 60, 90, 120] as const;
export const points = [0, 1000, 2000] as const;
export const MAX_QUESTIONS = 100;
const optionSchema = z.object({ id: z.uuid(), label: z.string().max(150) });
export const questionSchema = z
  .object({
    id: z.uuid(),
    sourceIdeaId: z.string().max(80).optional(),
    type: z.enum(["mc", "tf"]),
    prompt: z.string().max(250),
    revealFact: z.string().trim().max(160).optional(),
    timeLimit: z.union(times.map((t) => z.literal(t))),
    basePoints: z.union(points.map((t) => z.literal(t))),
    options: z.array(optionSchema).min(2).max(4),
    correctOptionId: z.uuid().nullable(),
  })
  .superRefine((q, ctx) => {
    if (new Set(q.options.map((o) => o.id)).size !== q.options.length)
      ctx.addIssue({ code: "custom", message: "Duplicate answer IDs" });
    if (q.correctOptionId && !q.options.some((o) => o.id === q.correctOptionId))
      ctx.addIssue({
        code: "custom",
        message: "Correct answer must belong to the question",
      });
    if (
      q.type === "tf" &&
      (q.options.length !== 2 ||
        q.options[0].label !== "True" ||
        q.options[1].label !== "False")
    )
      ctx.addIssue({
        code: "custom",
        message: "True/False answers must stay fixed",
      });
  });
export const draftSchema = z
  .object({
    title: z.string().max(120),
    description: z.string().max(500),
    language: z
      .string()
      .min(2)
      .max(35)
      .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/),
    coverImageUrl: z.union([
      z.literal(""),
      z.url().refine((v) => v.startsWith("https://"), "Use an HTTPS image URL"),
    ]),
    questions: z.array(questionSchema).max(MAX_QUESTIONS),
  })
  .superRefine((d, ctx) => {
    if (new Set(d.questions.map((q) => q.id)).size !== d.questions.length)
      ctx.addIssue({ code: "custom", message: "Duplicate question IDs" });
  });
export type Draft = z.infer<typeof draftSchema>;
export type Question = Draft["questions"][number];
export type Quiz = {
  id: string;
  draft: Draft;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export const emptyDraft: Draft = {
  title: "Untitled quiz",
  description: "",
  language: "en",
  coverImageUrl: "",
  questions: [],
};
export function launchErrors(d: Draft): string[] {
  const errors: string[] = [];
  if (!d.title.trim()) errors.push("Add a quiz name.");
  if (!d.questions.length) errors.push("Add at least one question.");
  d.questions.forEach((q, i) => {
    if (!q.prompt.trim()) errors.push(`Question ${i + 1}: add a prompt.`);
    if (q.options.some((o) => !o.label.trim()))
      errors.push(`Question ${i + 1}: fill in every answer.`);
    if (!q.correctOptionId)
      errors.push(`Question ${i + 1}: mark one correct answer.`);
  });
  return errors;
}
export function newQuestion(type: "mc" | "tf"): Question {
  const options = (type === "tf" ? ["True", "False"] : ["", "", "", ""]).map(
    (label) => ({ id: crypto.randomUUID(), label }),
  );
  return {
    id: crypto.randomUUID(),
    type,
    prompt: "",
    timeLimit: 30,
    basePoints: 1000,
    options,
    correctOptionId: null,
  };
}
