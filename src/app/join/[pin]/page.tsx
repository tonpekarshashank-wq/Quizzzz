import { redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ pin: string }>;
}) {
  const { pin } = await params;
  redirect(`/join?pin=${encodeURIComponent(pin)}`);
}
