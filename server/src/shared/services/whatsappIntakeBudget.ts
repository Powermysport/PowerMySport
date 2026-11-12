import redis from "../../config/redis";

/**
 * How many times a day one parent's messages may be read by the model for the adaptive questions.
 *
 * Its own counter, never the chat's daily message cap: reading a message to ask the next question
 * is not an answer the parent asked for, so it must not use up their 30 messages, and running out
 * of it must not stop them chatting. Running out only means the questions fall back to the plain
 * ones the code asks without the model.
 *
 * A typical request takes 3 or 4 readings, so 40 a day is about ten requests. Like the chat caps,
 * a Redis failure fails open: the cost of a few extra readings is smaller than a stalled chat.
 */
const DEFAULT_DAILY_READS = 40;

export const dailyReadCap = (): number => {
  const set = Number(process.env.WHATSAPP_INTAKE_DAILY_READS);
  return Number.isFinite(set) && set > 0 ? Math.floor(set) : DEFAULT_DAILY_READS;
};

/** The IST calendar day, so the count resets at the parent's midnight, not the server's. */
const istDay = (now: Date): string =>
  new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const intakeBudgetKey = (phoneHash: string, now: Date = new Date()): string =>
  `wa:intake:daily:${phoneHash}:${istDay(now)}`;

/** Takes one reading from today's budget. False means today's budget is spent. */
export async function reserveIntakeRead(
  phoneHash: string,
  now: Date = new Date(),
  cap: number = dailyReadCap()
): Promise<boolean> {
  try {
    const key = intakeBudgetKey(phoneHash, now);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60 * 60 * 48);
    return count <= cap;
  } catch {
    return true;
  }
}
