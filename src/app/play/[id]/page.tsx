import { notFound } from "next/navigation";
import { z } from "zod";
import { PlayerGame } from "@/components/player-game";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <PlayerGame id={id} />;
}
