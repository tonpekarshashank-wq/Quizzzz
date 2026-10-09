import { JoinGame } from "@/components/join-game";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pin?: string }>;
}) {
  const { pin } = await searchParams;
  return <JoinGame initialPin={typeof pin === "string" ? pin : ""} />;
}
