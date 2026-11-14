import Link from "next/link";

/**
 * Dev-only switch between the real data and the stress fixtures. The caller renders
 * it only outside production. Plain links to `?data=`, so the choice survives a
 * reload and needs no JavaScript. Deliberately unstyled by the site's design
 * system: it is test chrome, not part of what is being tested.
 */
const OPTIONS = [
  { value: undefined, label: "Demo data" },
  { value: "worst", label: "Worst case" },
  { value: "one", label: "One" },
  { value: "empty", label: "Empty" },
] as const;

export function DevDataToggle({ basePath, active }: { basePath: string; active?: string }) {
  return (
    <nav
      aria-label="Test data"
      className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-200 p-1 font-sans text-xs shadow"
    >
      <ul className="flex gap-1">
        {OPTIONS.map((option) => {
          const current = option.value === active || (!option.value && !active);
          return (
            <li key={option.label}>
              <Link
                href={option.value ? `${basePath}?data=${option.value}` : basePath}
                aria-current={current ? "page" : undefined}
                className={`block rounded-md px-3 py-1.5 ${
                  current ? "bg-white font-semibold text-black" : "text-neutral-700"
                }`}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
