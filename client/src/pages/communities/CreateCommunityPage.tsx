import { communityPath } from "../../lib/communityPath";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuArrowLeft, LuCamera } from "react-icons/lu";
import { useCreateCommunity } from "../../hooks/useCommunities";
import { useUploadMedia } from "../../hooks/useMediaUpload";
import { ImageCropModal } from "../../components/shared/ImageCropModal";
import FlickerSpinner from "../../components/shared/FlickerSpinner";

export default function CreateCommunityPage() {
  const navigate = useNavigate();
  const createCommunity = useCreateCommunity();
  const uploadMedia = useUploadMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingCropFile(file);
  };

  const handleCroppedComplete = (croppedFile: File) => {
    uploadMedia.mutate(croppedFile, { onSuccess: (res) => setLogoUrl(res.url) });
    setPendingCropFile(null);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createCommunity.mutate(
      { name: name.trim(), description: description.trim(), logoUrl },
      {
        onSuccess: (res) => {
          navigate(communityPath(res.community.slug));
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-lg p-6">
      <button
        onClick={() => navigate("/communities")}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-black dark:hover:text-white"
      >
        <LuArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-xl font-medium">Create a community</h1>
      <p className="mt-1 text-sm text-neutral-500">
        You'll be the owner, with a shareable invite code and full control over settings and staff.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Logo</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-medium text-neutral-500 ${
                logoUrl ? "bg-transparent" : "bg-neutral-100 dark:bg-neutral-800"
              }`}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full bg-transparent object-cover" />
              ) : uploadMedia.isPending ? (
                <FlickerSpinner size={20} />
              ) : (
                <LuCamera className="h-5 w-5" />
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Bayview Roleplay"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="What's this community about?"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        {createCommunity.isError && <p className="text-sm text-red-500">{(createCommunity.error as Error).message}</p>}

        <button
          onClick={handleCreate}
          disabled={!name.trim() || createCommunity.isPending}
          className="w-full rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {createCommunity.isPending ? "Creating…" : "Create community"}
        </button>

        <ImageCropModal
          open={!!pendingCropFile}
          imageFile={pendingCropFile}
          aspect="circle"
          title="Edit Community Logo"
          onClose={() => setPendingCropFile(null)}
          onCropComplete={handleCroppedComplete}
        />
      </div>
    </div>
  );
}
