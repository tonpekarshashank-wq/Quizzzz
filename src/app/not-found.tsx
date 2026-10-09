import Link from "next/link";
import { Nav } from "@/components/nav";
import { Blob } from "@/components/ui";
export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="card status-page">
        <Blob body={1} size={100} mood="o" />
        <h1>That page wandered off.</h1>
        <p>Check the link, or head back to your quizzes.</p>
        <Link className="button primary" href="/quizzes">
          My quizzes
        </Link>
      </main>
    </>
  );
}
