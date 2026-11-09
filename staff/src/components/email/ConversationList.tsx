import { relativeTime } from "../../lib/time";
import { Meta, Row, Tag } from "../panelKit";
import type { EmailConversation } from "../../types";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  claimed: "Claimed",
  pending_staff: "Pending Staff",
  waiting_customer: "Waiting on Customer",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_TONES: Record<string, "neutral" | "high" | "medium" | "low"> = {
  open: "medium",
  claimed: "neutral",
  pending_staff: "high",
  waiting_customer: "neutral",
  resolved: "low",
  closed: "low",
};

export function ConversationList({
  conversations,
  onSelectId,
}: {
  conversations: EmailConversation[];
  onSelectId: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {conversations.map((conv) => {
        const unread = (conv.unreadCount ?? 0) > 0;
        return (
          <Row key={conv.id} onClick={() => onSelectId(conv.id)} selected={unread}>
            <div className="flex items-center gap-2">
              {unread ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-severity-high" aria-label="Unread" />
              ) : null}
              <span className={`truncate text-sm ${unread ? "font-semibold text-white" : "font-medium text-neutral-200"}`}>
                {conv.customerEmail}
              </span>
              <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                {relativeTime(conv.lastMessageAt || conv.createdAt)}
              </span>
            </div>

            <div className="truncate text-[13px] text-neutral-400">{conv.subject}</div>

            <Meta>
              <Tag tone={STATUS_TONES[conv.status] ?? "low"}>{STATUS_LABELS[conv.status] || conv.status}</Tag>
              {conv.claimedBy ? (
                <span className="text-[13px] text-neutral-500">
                  Claimed by {conv.claimedBy.displayName || conv.claimedBy.username}
                </span>
              ) : null}
              {conv.hasAttachments ? <span title="Has attachments">📎</span> : null}
              {conv.emailCount ? <span className="text-[13px] text-neutral-500">{conv.emailCount} messages</span> : null}
              {conv.notesCount ? <span className="text-[13px] text-neutral-500">{conv.notesCount} notes</span> : null}
              {unread ? <span className="text-[13px] font-medium text-severity-high">{conv.unreadCount} unread</span> : null}
            </Meta>
          </Row>
        );
      })}
    </div>
  );
}
