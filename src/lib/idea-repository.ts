import { z } from "zod";
import { database } from "./db";
import { ApiError } from "./security";
import {
  ideaCategories,
  ideaItemSchema,
  type IdeasPage,
} from "./question-ideas";
export async function listQuestionIdeas(
  params: URLSearchParams,
): Promise<IdeasPage> {
  const category = z
    .enum(ideaCategories)
    .parse(params.get("category") || "All");
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(params.get("limit") ?? 30);
  const raw = params.get("cursor");
  let after = 0;
  if (raw) {
    try {
      if (raw.length > 256 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
      const cursor = z
        .object({
          category: z.enum(ideaCategories),
          after: z.number().int().positive(),
        })
        .strict()
        .parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
      if (cursor.category !== category) throw new Error();
      after = cursor.after;
    } catch {
      throw new ApiError(
        400,
        "INVALID_CURSOR",
        "Invalid cursor for this category.",
      );
    }
  }
  const db = await database();
  const filter = category === "All" ? null : category;
  const rows = (
    await db.query<{
      id: string;
      category: string;
      sort_order: number;
      content: unknown;
    }>(
      "SELECT id,category,sort_order,content FROM question_ideas WHERE active AND ($1::text IS NULL OR category=$1) AND sort_order>$2 ORDER BY sort_order LIMIT $3",
      [filter, after, limit + 1],
    )
  ).rows;
  const total = (
    await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM question_ideas WHERE active AND ($1::text IS NULL OR category=$1)",
      [filter],
    )
  ).rows[0].count;
  const page = rows.slice(0, limit);
  const items = page.map((row) => {
    const parsed = ideaItemSchema.safeParse({
      ...(row.content as object),
      id: row.id,
      category: row.category,
    });
    if (!parsed.success)
      throw new ApiError(
        503,
        "IDEAS_UNAVAILABLE",
        "Question ideas are temporarily unavailable.",
      );
    return parsed.data;
  });
  return {
    items,
    total,
    nextCursor:
      rows.length > limit
        ? Buffer.from(
            JSON.stringify({ category, after: page.at(-1)!.sort_order }),
          ).toString("base64url")
        : null,
  };
}
