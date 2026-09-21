import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/common/wordmark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { routes } from "@/lib/routes";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <a href="#auth-form" className="auth-skip-link">
        Skip to account form
      </a>
      <header className="auth-nav">
        <Link href={routes.home} className="auth-wordmark" aria-label="Nyoni Members home">
          <Wordmark />
        </Link>
        <div className="auth-nav-actions">
          <Link href={routes.home} className="auth-back-link">
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="auth-main">
        <section className="auth-form-panel" aria-label="Your Nyoni Members account">
          <div id="auth-form" className="auth-form-content" tabIndex={-1}>
            {children}
          </div>
        </section>
        <aside className="auth-editorial" aria-labelledby="auth-editorial-title">
          <div className="auth-editorial-heading">
            <p className="auth-eyebrow">Quality · Discretion · Craftsmanship</p>
            <h2 id="auth-editorial-title">
              Your wardrobe.
              <br />
              <span>Your measurements.</span>
              <br />
              Your concierge.
            </h2>
          </div>
          <div className="auth-editorial-footer">
            <p>Every member starts with the Nyoni capsule.</p>
            <span>Charlotte · Atlanta · Houston</span>
          </div>
        </aside>
      </main>
    </div>
  );
}
