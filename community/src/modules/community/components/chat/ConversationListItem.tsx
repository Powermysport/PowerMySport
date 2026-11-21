import { memo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, BellOff, Volume2, MoreHorizontal } from "lucide-react";
import type { ConversationItem } from "@/modules/community/types";
import { getAvatarCharacter, formatChatListDate } from "../../utils/chatUtils";

type ConversationListItemProps = {
  conversation: ConversationItem;
  isSelected: boolean;
  isPinned: boolean;
  isMuted: boolean;
  onOpenConversation: (conversationId: string) => void;
  onTogglePin: (conversationId: string) => void;
  onToggleMute: (conversationId: string) => void;
  isSelectMode?: boolean;
  onToggleSelect?: (conversationId: string) => void;
};

export const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isSelected,
  isPinned,
  isMuted,
  onOpenConversation,
  onTogglePin,
  onToggleMute,
  isSelectMode,
  onToggleSelect,
}: ConversationListItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const conversationName =
    conversation.conversationType === "GROUP"
      ? conversation.group?.name || conversation.otherParticipant.displayName
      : conversation.otherParticipant.displayName;
  const conversationPhotoUrl =
    conversation.conversationType === "GROUP"
      ? null
      : (conversation.otherParticipant.photoUrl ?? null);
  const conversationAvatarChar = getAvatarCharacter(conversationName);

  // Truncate last message
  // Full text goes to the DOM and CSS `truncate` clips it to the row. A JS
  // slice cut by UTF-16 units, which splits emoji, and ignored the width.
  const lastMessageText =
    conversation.status === "PENDING"
      ? "Sent you a message request"
      : conversation.latestMessage?.content || "No messages yet";

  useEffect(() => {
    if (!showContextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showContextMenu]);

  return (
    <motion.div layout className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={isSelectMode}
        aria-current={isSelected && !isSelectMode ? "true" : undefined}
        onClick={() => {
          if (!isSelectMode) onOpenConversation(conversation.id);
          else onToggleSelect?.(conversation.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isSelectMode) onOpenConversation(conversation.id);
            else onToggleSelect?.(conversation.id);
          }
        }}
        className={`relative w-full cursor-pointer overflow-hidden px-4 py-3 text-left transition-colors duration-200 ${
          isSelected && !isSelectMode
            ? "bg-paper-deep"
            : "bg-paper hover:bg-paper-deep/60 active:bg-paper-deep"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="bg-paper-deep text-ink relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-semibold">
            {conversationPhotoUrl ? (
              <img
                src={conversationPhotoUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              conversationAvatarChar
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {conversation.unreadCount > 0 && (
                  <div
                    className="bg-power-orange-solid mt-0.5 h-2 w-2 shrink-0 rounded-full"
                    role="img"
                    aria-label="Unread"
                  />
                )}
                <p
                  className={`text-ink truncate text-base ${
                    conversation.unreadCount > 0 ? "font-semibold" : "font-medium"
                  }`}
                >
                  {conversationName}
                </p>
                {isPinned && (
                  <Pin
                    size={12}
                    aria-label="Pinned"
                    className="fill-ink-muted text-ink-muted shrink-0"
                  />
                )}
                {isMuted && (
                  <BellOff size={12} aria-label="Muted" className="text-ink-muted shrink-0" />
                )}
                {conversation.status === "PENDING" && (
                  <span className="bg-wash text-ink shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold">
                    New
                  </span>
                )}
              </div>

              {/* Timestamp */}
              <div className="flex shrink-0 items-center gap-1.5">
                {conversation.latestMessage?.createdAt && (
                  <span
                    className={`text-sm font-medium tabular-nums leading-none ${
                      conversation.unreadCount > 0 ? "text-power-orange-solid" : "text-ink-muted"
                    }`}
                  >
                    {formatChatListDate(conversation.latestMessage.createdAt)}
                  </span>
                )}
                {/* Context menu trigger */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContextMenu((prev) => !prev);
                  }}
                  aria-label={`Options for ${conversationName}`}
                  aria-haspopup="menu"
                  aria-expanded={showContextMenu}
                  className="text-ink-muted hover:bg-paper-deep hover:text-ink flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-200 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  style={{ opacity: showContextMenu ? 1 : undefined }}
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p
                className={`truncate text-base leading-tight ${
                  conversation.unreadCount > 0 ? "text-ink font-medium" : "text-ink-body"
                }`}
              >
                {lastMessageText}
              </p>

              {/* Unread Badge */}
              {conversation.unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-power-orange-solid inline-flex min-w-[20px] shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white"
                >
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                </motion.span>
              )}
            </div>
          </div>
        </div>

        {/* Subtle separator line */}
        {!isSelected && <div className="bg-hairline absolute bottom-0 left-[76px] right-0 h-px" />}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {showContextMenu && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="border-hairline bg-paper absolute right-3 top-1 z-30 w-44 overflow-hidden rounded-lg border"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(conversation.id);
                setShowContextMenu(false);
              }}
              className="text-ink hover:bg-paper-deep flex min-h-11 w-full items-center gap-2 px-3 text-base font-medium transition-colors duration-200"
            >
              <Pin
                size={16}
                aria-hidden="true"
                className={isPinned ? "fill-power-orange text-power-orange-solid" : ""}
              />
              {isPinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute(conversation.id);
                setShowContextMenu(false);
              }}
              className="text-ink hover:bg-paper-deep flex min-h-11 w-full items-center gap-2 px-3 text-base font-medium transition-colors duration-200"
            >
              {isMuted ? (
                <>
                  <Volume2 size={16} aria-hidden="true" /> Unmute
                </>
              ) : (
                <>
                  <BellOff size={16} aria-hidden="true" /> Mute
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
