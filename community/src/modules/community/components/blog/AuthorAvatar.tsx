"use client";

import { useState } from "react";

interface AuthorAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}

const gradientFor = (seed: string): string => {
  const palettes = [
    "bg-ink",
    "bg-ink-body",
    "bg-power-orange-solid",
    "bg-indigo-800",
    "bg-indigo-700",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
};

/** Circular author avatar: the photo, or a solid warm initial when there is
 *  none or it fails to load. The initial is the first grapheme (so an emoji or
 *  accented first letter is not cut in half). The name is always rendered next
 *  to it, so the image itself is decorative. */
export default function AuthorAvatar({
  name,
  photoUrl,
  size = 40,
  className = "",
}: AuthorAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (Array.from((name || "?").trim())[0] ?? "?").toLocaleUpperCase();

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt=""
        onError={() => setFailed(true)}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${gradientFor(
        name || "?"
      )} font-semibold text-white ring-2 ring-white ${className}`}
    >
      {initial}
    </span>
  );
}
