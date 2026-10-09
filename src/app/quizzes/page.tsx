import { redirect } from "next/navigation";
import { currentHost } from "@/lib/auth";
import { listQuizzes, listOpenGames } from "@/lib/repository";
import { Library } from "@/components/library";
import { Nav } from "@/components/nav";
export const dynamic = "force-dynamic";
export default async function Page() {
  const host = await currentHost();
  if (!host) redirect("/login");
  return (
    <>
      <Nav name={host.fullName} />
      <Library
        initial={await listQuizzes(host.id)}
        openGames={await listOpenGames(host.id)}
      />
    </>
  );
}
