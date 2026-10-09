import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentHost } from "@/lib/auth";
import { getReport } from "@/lib/reports";
import { ApiError } from "@/lib/security";
import { Nav } from "@/components/nav";
import { Blob, Chip } from "@/components/ui";
export const dynamic = "force-dynamic";
const percent = (n: number | null) =>
  n === null ? "—" : `${Math.round(n * 100)}%`;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const host = await currentHost();
  if (!host) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const page = Math.max(
    0,
    Math.min(4000, Number.parseInt(query.page ?? "0", 10) || 0),
  );
  const report = await getReport(host.id, id, { offset: page * 25 }).catch(
    (e) => {
      if (e instanceof ApiError && e.code === "NOT_FOUND") notFound();
      if (e instanceof ApiError && e.code === "REPORT_UNAVAILABLE")
        redirect(`/host/${id}`);
      throw e;
    },
  );
  const s = report.summary;
  return (
    <>
      <Nav name={host.fullName} />
      <main id="main" className="workspace report-page">
        <Link href="/reports">← Session reports</Link>
        <div className="page-heading">
          <div>
            <Chip>{s.partial ? "PARTIAL · PROVISIONAL" : "COMPLETED"}</Chip>
            <h1>{report.title}</h1>
            <p>
              {s.questionCount} closed questions · {s.playerCount} players
            </p>
          </div>
          <a className="button primary" href={`/api/reports/${id}/csv`}>
            Download CSV ↓
          </a>
        </div>
        {s.partial && (
          <p className="notice">
            Only closed questions are included. These results are provisional;
            no awards are given.
          </p>
        )}
        <div className="report-metrics">
          {[
            ["Joined players", s.playerCount],
            ["Completion", percent(s.completion)],
            ["Overall accuracy", percent(s.accuracy)],
            [
              "Average response",
              s.averageMs === null
                ? "—"
                : `${(s.averageMs / 1000).toFixed(2)}s`,
            ],
            [
              "Ease rating",
              report.rating.average === null
                ? "—"
                : `${report.rating.average.toFixed(1)} / 5`,
            ],
          ].map(([label, value]) => (
            <section className="card metric" key={label}>
              <span className="eyebrow">{label}</span>
              <strong>{value}</strong>
              {label === "Ease rating" && (
                <small>{report.rating.count} ratings</small>
              )}
            </section>
          ))}
        </div>
        <p className="hint">
          Completion means answering every included question. Unanswered
          questions count as incorrect. Average response includes all accepted
          answers.
        </p>
        <section className="card report-panel">
          <h2>Toughest question</h2>
          {s.toughest ? (
            <p>
              <b>
                Q{s.toughest.index}: {s.toughest.prompt}
              </b>
              <br />
              {percent(s.toughest.accuracy)} answered correctly
            </p>
          ) : (
            <p>No closed-question data.</p>
          )}
        </section>
        <section className="card report-panel">
          <h2>Question breakdown</h2>
          {s.questions.map((q) => (
            <div className="question-stat" key={q.id}>
              <b>
                Q{q.index}. {q.prompt}
              </b>
              <p>
                {q.correct} correct · {q.answered} answered ·{" "}
                {Math.max(0, s.playerCount - q.answered)} unanswered
              </p>
              <div
                className="report-bar"
                role="img"
                aria-label={`${q.correct} of ${s.playerCount} correct`}
              >
                <span
                  style={{
                    width: `${(q.correct / Math.max(1, s.playerCount)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </section>
        <section className="report-players">
          <h2>Player breakdown</h2>
          {s.players.map((p) => (
            <details className="card report-panel" key={p.id}>
              <summary>
                <Blob body={p.avatar.body} mood={p.avatar.mood} size={42} />
                <b>
                  #{p.rank ?? "—"} · {p.nickname}
                </b>
                <strong>{p.score.toLocaleString()} pts</strong>
              </summary>
              <p>
                {percent(p.accuracy)} accuracy · {p.bestStreak} best streak
              </p>
              {!!p.awards.length && <p>{p.awards.join(" · ")}</p>}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th scope="col">Selected option</th>
                      <th scope="col">Result</th>
                      <th scope="col">Time</th>
                      <th scope="col">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.questions.map((q) => {
                      const a = report.answers.find(
                        (a) =>
                          a.participant_id === p.id && a.question_id === q.id,
                      );
                      return (
                        <tr key={q.id}>
                          <th scope="row">Q{q.index}</th>
                          <td>{a?.label ?? "—"}</td>
                          <td>
                            {a
                              ? a.correct
                                ? "Correct"
                                : "Incorrect"
                              : "Unanswered"}
                          </td>
                          <td>
                            {a ? `${(a.response_ms / 1000).toFixed(2)}s` : "—"}
                          </td>
                          <td>{a?.points ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </section>
        <div className="card-actions">
          {page > 0 && (
            <Link
              className="button secondary"
              href={`/reports/${id}?page=${page - 1}`}
            >
              Previous players
            </Link>
          )}
          {report.hasMore && (
            <Link
              className="button secondary"
              href={`/reports/${id}?page=${page + 1}`}
            >
              Next players
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
