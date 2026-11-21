"use client";

import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Flag,
  Info,
  Search,
  Star,
  StarOff,
  Ban,
  Trash2,
  Eraser,
  UserCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { RefObject, useEffect } from "react";

interface Props {
  menuRef: RefObject<HTMLDivElement | null>;
  isGroup: boolean;
  isMessageSelectionMode: boolean;
  isMuted: boolean;
  isFavourited: boolean;
  isBlocked: boolean;
  isTogglingBlockUser: boolean;
  onClose: () => void;
  onViewInfo: () => void;
  onToggleSearch: () => void;
  onMarkAllAsRead: () => void;
  onToggleSelectMessages: () => void;
  onToggleMute: () => void;
  onToggleFavourite: () => void;
  onBlock: () => void;
  onReport: () => void;
  onClearChat: () => void;
  onDeleteChat: () => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
  hasBorderBottom = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  hasBorderBottom?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 w-full items-center gap-3 px-4 text-base font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === "danger" ? "text-red-700 hover:bg-red-50" : "text-ink hover:bg-paper-deep"
      } ${hasBorderBottom ? "border-hairline border-b" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function ChatHeaderMenu({
  menuRef,
  isGroup,
  isMessageSelectionMode,
  isMuted,
  isFavourited,
  isBlocked,
  isTogglingBlockUser,
  onClose,
  onViewInfo,
  onToggleSearch,
  onMarkAllAsRead,
  onToggleSelectMessages,
  onToggleMute,
  onToggleFavourite,
  onBlock,
  onReport,
  onClearChat,
  onDeleteChat,
}: Props) {
  const wrap = (fn: () => void) => () => {
    fn();
    onClose();
  };

  // Nothing else closed this menu, so it stayed open over the conversation and
  // stacked with the next popover. Close on a press anywhere outside it (the
  // trigger is excluded: it toggles the menu itself) and on Escape.
  useEffect(() => {
    const onPress = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (menuRef.current?.contains(target as Node)) return;
      if (target?.closest?.("[data-chat-menu-trigger]")) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuRef, onClose]);

  return (
    <motion.div
      ref={menuRef}
      role="menu"
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.12 }}
      className="border-hairline bg-paper absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-lg border"
    >
      {/* Group 1 — Info / Search */}
      <MenuItem
        icon={
          isGroup ? (
            <Info size={16} className="text-ink-muted" aria-hidden="true" />
          ) : (
            <UserCircle2 size={16} className="text-ink-muted" aria-hidden="true" />
          )
        }
        label={isGroup ? "Group info" : "Contact info"}
        onClick={wrap(onViewInfo)}
      />
      <MenuItem
        icon={<Search size={16} className="text-ink-muted" aria-hidden="true" />}
        label="Search"
        onClick={wrap(onToggleSearch)}
        hasBorderBottom
      />

      {/* Group 2 — Messaging */}
      <MenuItem
        icon={<CheckCheck size={15} className="text-ink-muted" />}
        label="Mark all as read"
        onClick={wrap(onMarkAllAsRead)}
      />
      <MenuItem
        icon={<Check size={15} className="text-ink-muted" />}
        label={isMessageSelectionMode ? "Cancel selection" : "Select messages"}
        onClick={wrap(onToggleSelectMessages)}
        hasBorderBottom
      />

      {/* Group 3 — Preferences */}
      <MenuItem
        icon={
          isMuted ? (
            <Bell size={16} className="text-ink-muted" aria-hidden="true" />
          ) : (
            <BellOff size={16} className="text-ink-muted" aria-hidden="true" />
          )
        }
        label={isMuted ? "Unmute notifications" : "Mute notifications"}
        onClick={wrap(onToggleMute)}
      />
      <MenuItem
        icon={
          isFavourited ? (
            <StarOff size={15} className="text-ink-muted" />
          ) : (
            <Star size={15} className="text-ink-muted" />
          )
        }
        label={isFavourited ? "Remove from favourites" : "Add to favourites"}
        onClick={wrap(onToggleFavourite)}
        hasBorderBottom={!isGroup}
      />

      {/* Group 4 — Safety (DM only) */}
      {!isGroup && (
        <MenuItem
          icon={<Ban size={15} />}
          label={isBlocked ? "Unblock user" : "Block user"}
          onClick={wrap(onBlock)}
          variant="danger"
          disabled={isTogglingBlockUser}
          hasBorderBottom
        />
      )}

      {/* Group 5 — Destructive */}
      <MenuItem
        icon={<Flag size={15} />}
        label="Report"
        onClick={wrap(onReport)}
        variant="danger"
      />
      <MenuItem
        icon={<Eraser size={15} />}
        label="Clear chat"
        onClick={wrap(onClearChat)}
        variant="danger"
      />
      <MenuItem
        icon={<Trash2 size={15} />}
        label="Delete chat"
        onClick={wrap(onDeleteChat)}
        variant="danger"
      />
    </motion.div>
  );
}
