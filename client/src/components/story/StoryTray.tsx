import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { LuPlus } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useStoryFeed } from "../../hooks/useStories";
import { Avatar } from "../shared/Avatar";
import { StoryViewer } from "./StoryViewer";
import { NewStoryModal } from "./NewStoryModal";
import { canAttachVideo } from "../../lib/permissions";

export function StoryRing({ active, children }: { active: "unviewed" | "viewed" | "none"; children: ReactNode }) {
  if (active === "none") return <>{children}</>;
  return (
    <div className={`rounded-full p-[2px] ${active === "unviewed" ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700"}`}>
      <div className="rounded-full bg-white p-[2px] dark:bg-black">{children}</div>
    </div>
  );
}

export function StoryTray() {
  const { user } = useAuth();
  const videoAllowed = canAttachVideo(user);
  const { data, loadMore, isLoadingMore } = useStoryFeed(user?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  if (!user) return null;

  const groups = data?.groups ?? [];
  const myGroup = groups.find((g) => g.author.id === user.id);
  const otherGroups = groups.filter((g) => g.author.id !== user.id);

  const handleAddOrView = () => {
    if (myGroup) {
      setViewerIndex(groups.indexOf(myGroup));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingFile(file);
  };

  if (!groups.length) {
    return (
      <div className="px-4">
        <div className="flex gap-4 border-b border-neutral-100 py-3 dark:border-neutral-800">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button onClick={handleAddOrView} className="relative" aria-label="Add a story">
            <Avatar user={user} size={14} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white ring-2 ring-white dark:ring-black">
              <LuPlus className="h-3.5 w-3.5" />
            </span>
          </button>
          <span className="max-w-[64px] truncate text-xs text-neutral-500">Your story</span>
          <input ref={fileInputRef} type="file" accept={videoAllowed ? "image/*,video/*" : "image/*"} onChange={handleFileChange} className="hidden" />
        </div>

        {data?.hasMore && (
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="shrink-0 self-center rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </button>
        )}

        {pendingFile && <NewStoryModal file={pendingFile} onClose={() => setPendingFile(null)} />}
      </div>
    </div>
    );
  }

  return (
      <div className="px-4">
        <div className="flex gap-4 overflow-x-auto border-b border-neutral-100 py-3 dark:border-neutral-800">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <div className="relative">
          <button onClick={handleAddOrView} aria-label={myGroup ? "View your story" : "Add a story"}>
            <StoryRing active={myGroup ? (myGroup.hasUnviewed ? "unviewed" : "viewed") : "none"}>
              <Avatar user={user} size={14} />
            </StoryRing>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            aria-label="Add another story"
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white ring-2 ring-white dark:ring-black"
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="max-w-[64px] truncate text-xs text-neutral-500">Your story</span>
        <input ref={fileInputRef} type="file" accept={videoAllowed ? "image/*,video/*" : "image/*"} onChange={handleFileChange} className="hidden" />
      </div>

      {otherGroups.map((group) => (
        <button
          key={group.author.id}
          onClick={() => setViewerIndex(groups.indexOf(group))}
          className="flex shrink-0 flex-col items-center gap-1"
        >
          <StoryRing active={group.hasUnviewed ? "unviewed" : "viewed"}>
            <Avatar user={group.author} size={14} />
          </StoryRing>
          <span className="max-w-[64px] truncate text-xs text-neutral-500">{group.author.username}</span>
        </button>
      ))}

      {data?.hasMore && (
        <button
          onClick={loadMore}
          disabled={isLoadingMore}
          className="shrink-0 self-center rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {isLoadingMore ? "Loading…" : "Load more"}
        </button>
      )}

      {viewerIndex !== null && (
        <StoryViewer groups={groups} initialGroupIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}

      {pendingFile && <NewStoryModal file={pendingFile} onClose={() => setPendingFile(null)} />}
      </div>
    </div>
  );
}
