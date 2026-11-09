import { useEffect, useMemo, useState } from "react";
import { LuX } from "react-icons/lu";
import { useUploadMedia } from "../../hooks/useMediaUpload";
import { useCreateStory } from "../../hooks/useStories";

const MAX_CAPTION_LEN = 200;

export function NewStoryModal({ file, onClose }: { file: File; onClose: () => void }) {
  const [caption, setCaption] = useState("");
  const uploadMedia = useUploadMedia();
  const createStory = useCreateStory();
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const isVideo = file.type.startsWith("video/");

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const isPending = uploadMedia.isPending || createStory.isPending;

  const handleShare = () => {
    uploadMedia.mutate(file, {
      onSuccess: (media) => {
        createStory.mutate(
          { mediaUrl: media.url, mediaType: media.type, caption: caption.trim() },
          { onSuccess: onClose }
        );
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-lg bg-white dark:bg-neutral-900">
        <button
          onClick={onClose}
          aria-label="Cancel"
          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
        >
          <LuX className="h-5 w-5" />
        </button>

        <div className="flex h-96 items-center justify-center bg-black">
          {isVideo ? (
            <video src={previewUrl} className="max-h-full max-w-full" controls />
          ) : (
            <img src={previewUrl} alt="Story preview" className="max-h-full max-w-full object-contain" />
          )}
        </div>

        <div className="p-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))}
            placeholder="Add a caption…"
            rows={2}
            className="w-full resize-none rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {caption.length}/{MAX_CAPTION_LEN}
            </span>
            <button
              onClick={handleShare}
              disabled={isPending}
              className="rounded-lg bg-brand px-4 py-1.5 font-medium text-white hover:bg-brand-dark disabled:opacity-40"
            >
              {isPending ? "Sharing…" : "Share to story"}
            </button>
          </div>
          {(uploadMedia.isError || createStory.isError) && (
            <p className="mt-2 text-sm text-red-500">
              {(uploadMedia.error as Error)?.message || (createStory.error as Error)?.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
