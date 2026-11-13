/** Bolds the part of a name the visitor has typed, so why it matched is obvious. */
export function HighlightedName({ name, term }: { name: string; term: string }) {
  const needle = term.trim().toLowerCase();
  const lower = name.toLowerCase();
  const at = lower.startsWith(needle) ? 0 : lower.indexOf(` ${needle}`) + 1;
  if (!needle || at < 0 || (at === 0 && !lower.startsWith(needle))) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <strong className="font-semibold">{name.slice(at, at + needle.length)}</strong>
      <span className="text-muted-foreground">{name.slice(at + needle.length)}</span>
    </>
  );
}
