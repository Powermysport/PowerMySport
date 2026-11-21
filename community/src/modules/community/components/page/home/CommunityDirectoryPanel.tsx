"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Search, Users, X, MoreVertical, Plus, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { ConversationListItem } from "@/modules/community/components/chat/ConversationListItem";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityDirectoryPanel({ page }: Props) {
  const {
    workspaceView,
    directoryView,
    setDirectoryView,
    handleOpenConversation,
    conversationModeOptions,
    conversationMode,
    setConversationMode,
    managedConversations,
    selectedConversationId,
    hasConversationFilters,
    hasMoreConversations,
    handleLoadMoreConversations,
    isLoadingMoreConversations,
    // Chat enhancement state
    pinnedConversationIds,
    mutedConversationIds,
    conversationSearchQuery,
    setConversationSearchQuery,
    handleTogglePinConversation,
    handleToggleMuteConversation,
  } = page;

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  return (
    <motion.section
      className={`border-hairline bg-paper relative flex h-full min-h-0 flex-col border-r ${workspaceView === "DIRECTORY" ? "flex" : "hidden md:flex"}`}
    >
      {/* ── Fixed Header ── */}
      <div className="flex-none px-4 pb-1 pt-4">
        {/* Title Row */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-editorial text-ink text-2xl font-normal leading-none">Inbox</h2>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              aria-label="Inbox options"
              aria-haspopup="menu"
              aria-expanded={showHeaderMenu}
              className="text-ink-body hover:bg-paper-deep flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-200"
            >
              <MoreVertical size={18} aria-hidden="true" />
            </button>
            <AnimatePresence>
              {showHeaderMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0, transformOrigin: "top" }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    className="border-hairline bg-paper absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border p-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        page.setShowBlockedUsersModal(true);
                      }}
                      className="text-ink hover:bg-paper-deep min-h-11 w-full rounded-md px-3 text-left text-base transition-colors duration-200"
                    >
                      Blocked users
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search
            size={16}
            aria-hidden="true"
            className="text-ink-muted absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            value={conversationSearchQuery}
            onChange={(e) => setConversationSearchQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="text-ink placeholder:text-ink-muted focus:border-ink h-11 w-full rounded-md border border-[#d9d3c8] bg-white pl-9 pr-11 text-base outline-none transition-colors duration-200"
          />
          {conversationSearchQuery && (
            <button
              type="button"
              onClick={() => setConversationSearchQuery("")}
              aria-label="Clear search"
              className="text-ink-muted hover:text-ink absolute inset-y-0 right-0 flex w-11 items-center justify-center transition-colors duration-200"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* DM / Groups Toggle */}
        <div className="flex items-center gap-1.5">
          <div
            className="bg-paper-deep flex w-full items-center gap-0.5 rounded-lg p-0.5"
            role="tablist"
            aria-label="Conversation type"
          >
            <button
              type="button"
              role="tab"
              aria-selected={directoryView === "CONTACTS"}
              onClick={() => setDirectoryView("CONTACTS")}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors duration-200 ${directoryView === "CONTACTS" ? "text-ink bg-white" : "text-ink-muted hover:text-ink"}`}
            >
              <MessageSquare size={14} aria-hidden="true" /> Direct messages
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={directoryView === "GROUPS"}
              onClick={() => setDirectoryView("GROUPS")}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors duration-200 ${directoryView === "GROUPS" ? "text-ink bg-white" : "text-ink-muted hover:text-ink"}`}
            >
              <Users size={14} aria-hidden="true" /> Groups
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* All / Unread Filter Capsules */}
        <div className="flex-none px-4 pb-2 pt-2">
          <div
            className={`bg-paper-deep grid gap-0.5 rounded-lg p-0.5 ${directoryView === "GROUPS" ? "w-44 grid-cols-2" : "w-full grid-cols-3"}`}
          >
            {conversationModeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={conversationMode === item.value}
                onClick={() => setConversationMode(item.value as "ALL" | "UNREAD" | "REQUESTS")}
                className={`min-h-10 rounded-md px-1 text-sm font-semibold transition-colors duration-200 ${conversationMode === item.value ? "text-ink bg-white" : "text-ink-muted hover:text-ink"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Pinned section divider */}
          {managedConversations.some((c) => pinnedConversationIds.includes(c.id)) && (
            <div className="text-ink-muted px-4 py-2 text-sm font-medium">Pinned</div>
          )}
          {managedConversations.map((conversation, index) => {
            const isPinned = pinnedConversationIds.includes(conversation.id);
            const isMuted = mutedConversationIds.includes(conversation.id);

            // Show "All Conversations" divider after pinned section
            const prevConversation = managedConversations[index - 1];
            const showAllDivider =
              index > 0 &&
              prevConversation &&
              pinnedConversationIds.includes(prevConversation.id) &&
              !isPinned;

            return (
              <div key={conversation.id}>
                {showAllDivider && (
                  <div className="text-ink-muted px-4 py-2 text-sm font-medium">
                    All conversations
                  </div>
                )}
                <div className="group flex items-center">
                  {page.selectChatsMode && (
                    <div className="flex items-center justify-center pl-1">
                      <button
                        type="button"
                        onClick={() => page.toggleChatSelection(conversation.id)}
                        aria-label={`Select conversation with ${conversation.otherParticipant.displayName}`}
                        aria-pressed={page.selectedChatIds.includes(conversation.id)}
                        className="flex h-11 w-11 items-center justify-center"
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                            page.selectedChatIds.includes(conversation.id)
                              ? "bg-power-orange-solid border-power-orange-solid text-white"
                              : "border-[#d9d3c8] bg-white"
                          }`}
                        >
                          {page.selectedChatIds.includes(conversation.id) && (
                            <Check size={12} strokeWidth={3} aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <ConversationListItem
                      conversation={conversation}
                      isSelected={conversation.id === selectedConversationId}
                      isPinned={isPinned}
                      isMuted={isMuted}
                      onOpenConversation={handleOpenConversation}
                      onTogglePin={handleTogglePinConversation}
                      onToggleMute={handleToggleMuteConversation}
                      isSelectMode={page.selectChatsMode}
                      onToggleSelect={page.toggleChatSelection}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {!managedConversations.length && (
            <div className="px-5 py-10">
              <p className="font-editorial text-ink text-2xl font-light leading-tight">
                {hasConversationFilters ? "No matches." : "No conversations yet."}
              </p>
              <p className="text-ink-body mt-2 text-base leading-relaxed">
                {hasConversationFilters
                  ? "Try a different search, or switch the filter to All."
                  : "Start a chat to connect with another parent."}
              </p>
              {!hasConversationFilters && (
                <button
                  type="button"
                  onClick={() => page.setShowAddChatModal(true)}
                  className="text-ink decoration-ink/30 hover:decoration-ink mt-4 min-h-11 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                >
                  Start a chat
                </button>
              )}
            </div>
          )}
          {!hasConversationFilters && hasMoreConversations && (
            <button
              onClick={() => void handleLoadMoreConversations()}
              disabled={isLoadingMoreConversations}
              className="border-hairline text-ink hover:bg-paper-deep min-h-11 w-full border-t px-3 text-base font-semibold transition-colors duration-200 disabled:opacity-60"
            >
              {isLoadingMoreConversations ? "Loading" : "Load more"}
            </button>
          )}
        </div>
      </div>

      {/* FAB */}
      {!page.selectChatsMode && (
        <button
          type="button"
          onClick={() => page.setShowAddChatModal(true)}
          aria-label="New chat"
          className="bg-power-orange-solid btn-motion absolute bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-lg text-white hover:bg-indigo-700"
        >
          <Plus size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      {/* Select Chats Mode Send Bar */}
      <AnimatePresence>
        {page.selectChatsMode && page.forwardingMessages.length > 0 && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="border-hairline bg-paper absolute bottom-0 left-0 right-0 z-30 flex gap-2 border-t p-3"
          >
            <button
              onClick={() => {
                page.setSelectChatsMode(false);
                page.clearChatSelection();
                page.setForwardingMessages([]);
              }}
              className="border-hairline text-ink hover:bg-paper-deep min-h-11 flex-1 rounded-md border text-base font-semibold transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                try {
                  await page.handleForwardMessages(page.selectedChatIds);
                  const prefix = page.forwardingMessages.length > 1 ? "Messages" : "Message";
                  toast.success(
                    `${prefix} forwarded to ${page.selectedChatIds.length} ${page.selectedChatIds.length === 1 ? "chat" : "chats"}`
                  );
                } catch {
                  toast.error("Failed to forward messages");
                } finally {
                  page.setSelectChatsMode(false);
                  page.clearChatSelection();
                  page.setForwardingMessages([]);
                }
              }}
              disabled={page.selectedChatIds.length === 0}
              className="bg-power-orange-solid btn-motion min-h-11 flex-1 rounded-md text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Forward
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
