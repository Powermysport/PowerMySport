import { displayName } from "../components/PlayerHero";
import { comboLabel, getRankingSport } from "../config/rankings";
import { fetchPlayer, type PlayerResult } from "../services/api";
import { ownBracket } from "./insights";

/**
 * The browser-tab and link-preview title for one player's page.
 *
 * "Player ranking history" on every page made every bookmark, history entry and
 * shared WhatsApp link look the same. The title names the player and where they
 * stand on their own age group's list, the same list the page's headline uses.
 */
export function playerTitle(data: PlayerResult, acronym: string): string {
  const { player, current } = data;
  const name = displayName(player.fullName ?? `Player ${player.regNo}`);

  const home = ownBracket(current.map((entry) => entry.subcategory));
  const primary = current.find((entry) => entry.subcategory === home) ?? current[0];
  if (!primary) return `${name}: ${acronym} ranking history`;

  const list = comboLabel({ category: primary.category, subcategory: primary.subcategory });
  return `${name}: ${acronym} ${list} rank #${primary.rank.toLocaleString("en-IN")}`;
}

/**
 * The title for a route's params, or the old generic one when the player cannot
 * be found. `fetchPlayer` is the same request the page makes, so Next serves it
 * once for both.
 */
export async function playerPageTitle(sportSlug: string, regNo: string): Promise<string> {
  const sport = getRankingSport(sportSlug);
  const data = sport && /^\d{4,8}$/.test(regNo) ? await fetchPlayer(regNo, sport.slug) : null;
  return sport && data ? playerTitle(data, sport.federation.acronym) : "Player ranking history";
}
