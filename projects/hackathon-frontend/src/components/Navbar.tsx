import { useNavigate } from "react-router-dom";
import Button from "./Button";
import type { ReactNode } from "react";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 -translate-y-[8px] md:-translate-y-[10px]">
      <div className="mx-auto max-w-[1400px] px-1 sm:px-2">
        <div className="flex items-center justify-between py-0">
          {/* Logo */}
          <a href="/" className="inline-flex items-center">
            <img src="/logo.svg" alt="Logo" className="h-48 md:h-40 w-auto object-contain select-none" />
          </a>

          <div className="flex items-center gap-8 md:gap-10 lg:gap-12">
            {/* Squiggly nav links */}
            <ul className="flex items-center gap-7 md:gap-9 lg:gap-12">
              <li>
                <SquiggleLink href="#about" variant="a">
                  About
                </SquiggleLink>
              </li>
              <li>
                <SquiggleLink href="#policy" variant="b">
                  Policy
                </SquiggleLink>
              </li>
              <li>
                <SquiggleLink href="#contact" variant="c">
                  Contact
                </SquiggleLink>
              </li>
            </ul>

            {/* Login button */}
            <Button label="Login" onClick={() => navigate("/login")} />
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ---------------------------
   Internal helper component
   (renamed to avoid confusion
   with React Router NavLink)
--------------------------- */

type Variant = "a" | "b" | "c";

function SquiggleLink({ href, children, variant = "a" }: { href: string; children: ReactNode; variant?: Variant }) {
  const paths: Record<Variant, string> = {
    a: "M0 3 C 10 6, 25 0, 40 3 S 70 6, 100 3",
    b: "M0 3 C 8 0, 22 6, 35 3 S 65 0, 100 3",
    c: "M0 3 C 12 5.5, 28 0.5, 50 3 S 82 5.5, 100 3",
  };

  return (
    <a
      href={href}
      className="
        group relative inline-flex items-center
        font-display font-normal
        text-[1.05rem]
        text-[#FA812F]
        leading-none whitespace-nowrap select-none
      "
    >
      <span>{children}</span>
      <svg
        className="nav-squiggle pointer-events-none absolute -bottom-[6px] left-0 h-[8px] w-full overflow-visible"
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={paths[variant]}
          pathLength={100}
          fill="none"
          stroke="#FA812F"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ willChange: "stroke-dasharray, opacity" }}
        />
      </svg>
    </a>
  );
}
