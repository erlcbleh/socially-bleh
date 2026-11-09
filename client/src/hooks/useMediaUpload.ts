import { useMutation } from "../lib/queryStore";
import { api } from "../lib/api";
import { compressImageToAVIF } from "../lib/imageCompressor";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export function useUploadMedia() {
  return useMutation({
    mutationFn: async (file: File) => {
      const isVideo = file.type.startsWith("video/");
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

      if (file.size > maxBytes) {
        throw new Error(isVideo ? "Videos must be under 100MB" : "Images must be under 25MB");
      }

      let uploadFile = file;
      if (!isVideo) {
        uploadFile = await compressImageToAVIF(file, 2000, 0.82);
      }

      const res = await api.post<PresignResponse>("/media/presign", {
        filename: uploadFile.name,
        contentType: uploadFile.type,
      });

      if (!res.uploadUrl || !res.publicUrl) {
        throw new Error("Upload credentials not available.");
      }

      const uploadRes = await fetch(res.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": uploadFile.type,
        },
        body: uploadFile,
      });

      if (!uploadRes.ok) {
        console.error("R2 Upload Failed", uploadRes.status);
        throw new Error("Upload failed. Please try again.");
      }

      const url = res.publicUrl;
      await api.post("/media/register", { url }).catch(() => {});

      return { url, type: (isVideo ? "video" : "image") as "image" | "video" };
    },
  });
}
