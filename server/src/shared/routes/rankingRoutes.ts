import { Router } from "express";
import { rankingSuggestRateLimiter } from "../../middleware/rateLimit";
import {
  getPlayerRankingHistory,
  getRankingHealth,
  getRankingMeta,
  listRankingDates,
  listRankings,
  suggestPlayers,
} from "../controller/rankingController";

const router = Router();

// GET /api/rankings/meta — combos, current dates, states (for filter UIs)
router.get("/meta", getRankingMeta);

// GET /api/rankings/health — freshness of the mirror
router.get("/health", getRankingHealth);

// GET /api/rankings/dates?category=&subcategory= — weeks available for a combo
router.get("/dates", listRankingDates);

// GET /api/rankings/suggest?category=&subcategory=&q= — name suggestions for the search box
router.get("/suggest", rankingSuggestRateLimiter, suggestPlayers);

// GET /api/rankings/players/:regNo — one player's standing and trajectory
router.get("/players/:regNo", getPlayerRankingHistory);

// GET /api/rankings?category=Boys&subcategory=U-14&state=&search=&date=&page=&limit=
// Declared last so it does not shadow the named routes above.
router.get("/", listRankings);

export default router;
