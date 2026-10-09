import Link from "next/link";
import { redirect } from "next/navigation";
import { currentHost } from "@/lib/auth";
import { listReports } from "@/lib/reports";
import { Nav } from "@/components/nav";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const host = await currentHost();
  if (!host) redirect("/login");
  const params = await searchParams;
  const page = Math.max(
    0,
    Math.min(5000, Number.parseInt(params.page ?? "0", 10) || 0),
  );
  const data = await listReports(host.id, page * 20);
  return (
    <>
      <Nav name={host.fullName} />
      <main id="main" className="workspace">
        <div className="page-heading">
          <div>
            <h1>Session reports.</h1>
            <p>Real answers. A little insight for your next quiz.</p>
          </div>
          <Link className="button secondary" href="/quizzes">
            My quizzes ↗
          </Link>
        </div>
        {!data.items.length && (
          <section className="card report-panel">
            <h2>No finished games here yet.</h2>
            <p>Run a quiz to see its results.</p>
          </section>
        )}
        <div className="report-list">
          {data.items.map((s) => (
            <article className="card open-game report-panel" key={s.id}>
              <div>
                <h2>{s.title}</h2>
                <p>
                  {s.state === "COMPLETED"
                    ? "Completed"
                    : s.state === "CANCELLED"
                      ? "Cancelled lobby"
                      : "Partial results"}{" "}
                  ·{" "}
                  {new Date(s.endedAt).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Kolkata",
                  })}
                </p>
              </div>
              <Link
                className="button secondary small"
                href={
                  s.state === "CANCELLED" ? `/host/${s.id}` : `/reports/${s.id}`
                }
              >
                {s.state === "CANCELLED" ? "View closed lobby" : "View report"}{" "}
                ↗
              </Link>
            </article>
          ))}
        </div>
        <div className="card-actions">
          {page > 0 && (
            <Link
              className="button secondary"
              href={`/reports?page=${page - 1}`}
            >
              Previous
            </Link>
          )}
          {data.hasMore && (
            <Link
              className="button secondary"
              href={`/reports?page=${page + 1}`}
            >
              Next
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
