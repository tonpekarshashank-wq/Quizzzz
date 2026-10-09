import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentHost } from "@/lib/auth";
import { getQuiz } from "@/lib/repository";
import { ApiError } from "@/lib/security";
import { Editor } from "@/components/editor";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const host = await currentHost();
  if (!host) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  try {
    return <Editor initial={await getQuiz(host.id, id)} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
