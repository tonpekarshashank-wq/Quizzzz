import Link from "next/link";
import { Nav } from "@/components/nav";
import { Blob, Chip } from "@/components/ui";
export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="home">
        <section className="hero-copy">
          <Chip>BIG QUESTIONS. GOOD COMPANY.</Chip>
          <h1>
            A little quiz.
            <br />A lot of <span className="highlight">personality.</span>
          </h1>
          <p>
            Turn what you know into something everyone wants to play. Build your
            first quiz, one question at a time.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="button primary">
              Make a quiz ↗
            </Link>
            <Link href="/login" className="text-link">
              Already a host? Sign in
            </Link>
          </div>
          <div className="hero-note">
            <span className="dot" /> No player accounts. Just a code and a
            nickname.
          </div>
        </section>
        <section className="hero-art" aria-label="Colorful quiz characters">
          <div className="art-label chip">EVERYONE HAS A QUIZ FACE.</div>
          <div className="hero-blob one">
            <Blob size={170} body={0} mood="grin" />
          </div>
          <div className="hero-blob two">
            <Blob size={150} body={1} />
          </div>
          <div className="hero-blob three">
            <Blob size={170} body={2} mood="o" />
          </div>
          <div className="hero-blob four">
            <Blob size={130} body={3} mood="grin" />
          </div>
          <span className="art-star">✳</span>
          <span className="art-caption">ready, set, quiz.</span>
        </section>
      </main>
      <footer className="footer">
        A room full of people. A reason to play.
      </footer>
    </>
  );
}
