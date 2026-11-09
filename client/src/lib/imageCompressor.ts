export async function compressImageToAVIF(
  file: File,
  maxDimension = 2000,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const tryEncode = (format: string, fallbackFormat?: string) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const ext = format === "image/avif" ? "avif" : format === "image/webp" ? "webp" : "jpg";
              const newFileName = file.name.replace(/\.[^/.]+$/, "") + `.${ext}`;
              const compressedFile = new File([blob], newFileName, { type: format });
              resolve(compressedFile);
            } else if (fallbackFormat) {
              tryEncode(fallbackFormat);
            } else {
              resolve(file);
            }
          },
          format,
          quality
        );
      };

      tryEncode("image/avif", "image/webp");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
