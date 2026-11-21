"use client";

import { useRef, useEffect, useLayoutEffect, useState } from "react";
import { motion } from "framer-motion";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😜",
      "🤔",
      "🤗",
      "😎",
      "🥳",
    ],
  },
  {
    name: "Gestures",
    emojis: [
      "👍",
      "👎",
      "👊",
      "✊",
      "🤞",
      "✌️",
      "🤟",
      "👏",
      "🙌",
      "🤝",
      "💪",
      "🙏",
      "☝️",
      "👆",
      "👋",
      "🤙",
    ],
  },
  {
    name: "Hearts",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "💯",
      "💥",
      "🔥",
      "⭐",
      "✨",
      "💫",
      "🎉",
      "🎊",
    ],
  },
  {
    name: "Sports",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🎾",
      "🏐",
      "🏉",
      "🏸",
      "🏓",
      "🏒",
      "🥊",
      "🏋️",
      "🤸",
      "🚴",
      "🏊",
      "🏆",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "📱",
      "💻",
      "📷",
      "🎵",
      "🎮",
      "📚",
      "✏️",
      "📌",
      "🔔",
      "💡",
      "⏰",
      "📅",
      "✅",
      "❌",
      "⚠️",
      "💬",
    ],
  },
  {
    name: "Food",
    emojis: [
      "🍕",
      "🍔",
      "🍟",
      "🌮",
      "🍩",
      "🍰",
      "🍫",
      "☕",
      "🧃",
      "🍎",
      "🥑",
      "🍗",
      "🥗",
      "🍣",
      "🥤",
      "🧁",
    ],
  },
];

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  alignRight?: boolean;
};

/** Nearest ancestor that scrolls, so the picker can tell where it would be cut off. */
const scrollParent = (el: HTMLElement | null): HTMLElement | null => {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
};

export default function EmojiPicker({ onSelect, onClose, alignRight }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"above" | "below">("above");

  // Opens above its trigger by default. On a message near the top of the
  // thread there is no room, and the picker was cut off under the chat header;
  // open it below instead.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const top = scrollParent(el)?.getBoundingClientRect().top ?? 0;
    if (el.getBoundingClientRect().top < top + 8) setPlacement("below");
  }, []);

  // Escape closes it, like every other popover here.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`absolute ${placement === "above" ? "bottom-full mb-2" : "top-full mt-2"} ${alignRight ? "right-0" : "left-0"} border-hairline bg-paper z-50 w-[min(336px,calc(100vw-2rem))] overflow-hidden rounded-2xl border`}
    >
      <div className="emoji-picker-scroll max-h-[280px] space-y-2 overflow-y-auto p-2">
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.name}>
            <p className="text-ink-muted px-2 py-1 text-sm font-medium">{category.name}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {category.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSelect(emoji);
                    onClose();
                  }}
                  aria-label={emoji}
                  className="hover:bg-paper-deep flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors duration-150 active:scale-[0.98]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
