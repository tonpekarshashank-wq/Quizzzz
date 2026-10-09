import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentHost } from "@/lib/auth";
import { HostGame } from "@/components/host-game";
import { database } from "@/lib/db";
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
  const db = await database();
  if (
    !(
      await db.query(
        "SELECT id FROM quiz_sessions WHERE id=$1 AND host_id=$2",
        [id, host.id],
      )
    ).rows.length
  )
    notFound();
  return <HostGame id={id} />;
}
