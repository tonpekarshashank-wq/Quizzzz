import type { Metadata } from "next";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/700.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Quizzzz — make room for a little competition",
    template: "%s · Quizzzz",
  },
  description:
    "Create quizzes, bring people together, and make every answer count.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
