import Button from "./Button";

export default function Navbar() {
  return (
    // lift the entire bar ~6–8px; adjust to taste
    <nav className="fixed top-0 inset-x-0 z-50 -translate-y-[8px] md:-translate-y-[10px]">
      <div className="mx-auto max-w-[1400px] px-1 sm:px-2">
        {/* remove top padding so the lift is visible */}
        <div className="flex items-center justify-between py-0">
          <a href="/" className="inline-flex items-center">
            {/* make the logo bigger, and remove its translate so it doesn’t fight the lift */}
            <img src="/logo.svg" alt="Logo" className="h-48 md:h-40 w-auto object-contain select-none" />
          </a>

          <div className="flex items-center gap-8 md:gap-10 lg:gap-12">
            <ul className="flex items-center gap-6 md:gap-8 lg:gap-10">
              <li>
                <NavLink href="#about">About</NavLink>
              </li>
              <li>
                <NavLink href="#policy">Policy</NavLink>
              </li>
              <li>
                <NavLink href="#contact">Contact</NavLink>
              </li>
            </ul>

            <Button label="Sign Up" onClick={() => (window.location.href = "#signup")} />
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="group relative inline-flex items-center font-display font-normal text-[#FA812F] text-xl">
      <span>{children}</span>
      <svg
        className="absolute -bottom-1 left-0 h-[4px] w-full overflow-visible transition-all duration-500 ease-in-out
                   opacity-0 group-hover:opacity-100"
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 3 C 15 6, 35 0, 50 3 S 85 6, 100 3"
          fill="none"
          stroke="#FA812F"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <animate attributeName="stroke-dasharray" from="0, 200" to="200, 0" dur="0.6s" begin="mouseover" fill="freeze" />
        </path>
      </svg>
    </a>
  );
}
