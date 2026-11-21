/** Where "Open" on a notification should go. Shared by the notifications page
 *  and the live toast so the two cannot drift: the page used to build `/?...`
 *  links, which land on the community home page rather than the chat. */
export type NotificationTarget = {
  postId?: string;
  conversationId?: string;
  groupId?: string;
};

export const buildNotificationHref = (data?: NotificationTarget | null): string | null => {
  if (data?.postId) {
    return `/questions/${data.postId}`;
  }

  if (data?.conversationId) {
    return `/chats?sidebar=inbox&conversation=${encodeURIComponent(data.conversationId)}`;
  }

  if (data?.groupId) {
    return `/chats?group=${encodeURIComponent(data.groupId)}`;
  }

  return null;
};
