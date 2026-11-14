import { displayName } from "../components/PlayerHero";
import { comboLabel, getRankingSport } from "../config/rankings";
import { fetchPlayer, type PlayerResult } from "../services/api";
import { ownBracket } from "./insights";

/**
 * The browser-tab and link-preview title for one player's page.
 *
 * "Player ranking history" on every page made every bookmark, history entry and
 * shared WhatsApp link look the same. The title names the player and where they
 * stand on the list the page is showing: their own age group's by default, or
 * the one `?list=` picked, so a shared link to the Under-18 view says Under-18.
 */
export function playerTitle(data: PlayerResult, acronym: string, list?: string): string {
  const { player, current } = data;
  const name = displayName(player.fullName ?? `Player ${player.regNo}`);

  const home = ownBracket(current.map((entry) => entry.subcategory));
  // Same rule as the page: an unknown `list` falls back to the home bracket.
  const primary =
    current.find((entry) => list !== undefined && entry.subcategory === list) ??
    current.find((entry) => entry.subcategory === home) ??
    current[0];
  if (!primary) return `${name}: ${acronym} ranking history`;

  const label = comboLabel({ category: primary.category, subcategory: primary.subcategory });
  return `${name}: ${acronym} ${label} rank #${primary.rank.toLocaleString("en-IN")}`;
}

/**
 * The title for a route's params, or the old generic one when the player cannot
 * be found. `fetchPlayer` is the same request the page makes, so Next serves it
 * once for both.
 */
export async function playerPageTitle(
  sportSlug: string,
  regNo: string,
  list?: string
): Promise<string> {
  const sport = getRankingSport(sportSlug);
  const data = sport && /^\d{4,8}$/.test(regNo) ? await fetchPlayer(regNo, sport.slug) : null;
  return sport && data
    ? playerTitle(data, sport.federation.acronym, list)
    : "Player ranking history";
}
