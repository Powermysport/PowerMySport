"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { comboLabel, playerHref } from "../config/rankings";
import { usePlayerSuggestions, type PlayerSuggestion } from "../hooks/usePlayerSuggestions";
import { HighlightedName } from "./HighlightedName";

/**
 * Find one player across every list of a sport.
 *
 * A parent who knows the child's name but not which of twelve lists they sit on
 * should not have to guess. The suggestions come from the same endpoint as the
 * in-list search, just unscoped, and each row says which list it is on (the
 * player's own age group, never the one they play up in). Choosing a row opens
 * the player's page; there is no results page because the answer is one person.
 *
 * Keyboard: arrows move through the rows, Enter opens the highlighted one (or the
 * first, when none is highlighted), Escape closes the list and then clears the box.
 */
export function PlayerFinder({ sport }: { sport: string }) {
  const router = useRouter();
  const id = useId();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [opening, setOpening] = useState(false);

  const { items, loading } = usePlayerSuggestions(term, { sport }, open);
  const listOpen = open && items.length > 0;
  const noMatch = open && term.trim().length >= 2 && !loading && items.length === 0;

  const choose = (item: PlayerSuggestion) => {
    setOpening(true);
    setOpen(false);
    router.push(playerHref(sport, item.regNo));
  };

  return (
    <div className="max-w-xl">
      <label htmlFor={`${id}-input`} className="text-base font-semibold">
        Find a player
      </label>
      <div className="relative mt-2">
        <input
          id={`${id}-input`}
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && items.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActive((i) => (i + 1) % items.length);
            } else if (event.key === "ArrowUp" && items.length > 0) {
              event.preventDefault();
              setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
            } else if (event.key === "Enter") {
              const pick = items[active >= 0 ? active : 0];
              if (pick) {
                event.preventDefault();
                choose(pick);
              }
            } else if (event.key === "Escape") {
              if (listOpen) {
                setOpen(false);
                setActive(-1);
              } else {
                setTerm("");
              }
            }
          }}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
          enterKeyHint="go"
          autoComplete="off"
          spellCheck={false}
          placeholder="Name or AITA registration number"
          className="border-hairline text-ink focus-visible:border-ink focus-visible:ring-power-orange h-12 w-full rounded-md border bg-white pl-3.5 pr-12 text-base outline-none transition focus-visible:ring-2 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
        {opening ? (
          <Loader2
            className="text-muted-foreground absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        ) : (
          term && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setTerm("");
                document.getElementById(`${id}-input`)?.focus();
              }}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-power-orange absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )
        )}

        <span className="sr-only" role="status" aria-live="polite">
          {listOpen
            ? `${items.length} matching ${items.length === 1 ? "player" : "players"}`
            : noMatch
              ? "No player found"
              : ""}
        </span>

        {listOpen && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Matching players"
            // mousedown, not click: the input's blur would close the list first.
            onMouseDown={(event) => event.preventDefault()}
            className="popover-in border-hairline absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-white shadow-lg"
          >
            {items.map((item, index) => (
              <li
                key={item.regNo}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer flex-col gap-0.5 px-3.5 py-2.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 ${
                  index === active ? "bg-muted" : ""
                }`}
              >
                {/* Wraps instead of truncating: the family name is the end of the
                    string, and a cut there leaves "Venkata Sai Krishna Chaitanya Pem…". */}
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <HighlightedName name={item.fullName} term={term} />
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {item.category && item.subcategory
                    ? `${comboLabel({ category: item.category, subcategory: item.subcategory })}, `
                    : ""}
                  #{item.rank}
                  {item.state ? ` · ${item.state}` : ""}
                  {/* Two players can share a name; the registration number cannot. */}
                  {` · AITA #${item.regNo}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {noMatch && (
        <p className="text-muted-foreground mt-2 text-sm">
          No player found. Check the spelling, or try the AITA registration number.
        </p>
      )}
    </div>
  );
}
