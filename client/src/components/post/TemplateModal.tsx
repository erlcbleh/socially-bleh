import { useEffect, useRef, useState } from "react";
import { LuImagePlus } from "react-icons/lu";
import { Modal } from "../shared/Modal";
import { useUploadMedia } from "../../hooks/useMediaUpload";

const LANDSCAPE = { w: 1280, h: 720 };
const PORTRAIT = { w: 720, h: 1280 };

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number
) {
  let size = startSize;
  const build = (fontSize: number) => {
    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  while (size > minSize) {
    const lines = build(size);
    if (lines.length <= maxLines) return { size, lines };
    size -= 2;
  }

  const lines = build(minSize);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last}…`;
    return { size: minSize, lines: kept };
  }
  return { size: minSize, lines };
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

function draw(
  canvas: HTMLCanvasElement,
  bgImg: HTMLImageElement | null,
  wordmarkImg: HTMLImageElement | null,
  headline: string,
  ticker: string,
  size: { w: number; h: number }
) {
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { w, h } = size;

  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, w, h);
  if (bgImg) drawImageCover(ctx, bgImg, 0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0, 0, w, h);

  const padX = w * 0.03;
  const padY = h * 0.045;
  const badgeH = h * 0.06;

  if (wordmarkImg) {
    const wordmarkH = badgeH * 0.7;
    const wordmarkW = wordmarkH * (wordmarkImg.width / wordmarkImg.height);
    ctx.drawImage(wordmarkImg, w - padX - wordmarkW, padY + (badgeH - wordmarkH) / 2, wordmarkW, wordmarkH);
  }

  const tickerH = h * 0.075;
  const headlineH = h * 0.16;
  const tagH = h * 0.075;
  const tickerY = h - tickerH;
  const headlineY = tickerY - headlineH;
  const tagY = headlineY - tagH;
  const tagPadX = w * 0.025;
  ctx.font = `900 ${Math.round(tagH * 0.45)}px Arial, sans-serif`;
  const tagW = Math.min(ctx.measureText("BREAKING NEWS").width + tagPadX * 2, w * 0.9);

  ctx.fillStyle = "#d21f2f";
  ctx.fillRect(0, tagY, tagW, tagH);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("BREAKING NEWS", tagPadX, tagY + tagH / 2);

  ctx.fillStyle = "#e7e7e7";
  ctx.fillRect(0, headlineY, w, headlineH);
  const { size: hSize, lines } = fitText(
    ctx,
    (headline || "YOUR HEADLINE HERE").toUpperCase(),
    w * 0.94,
    2,
    headlineH * 0.4,
    headlineH * 0.16
  );
  ctx.fillStyle = "#0a0a0a";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const lineHeight = hSize * 1.15;
  const totalTextH = lineHeight * lines.length;
  let lineY = headlineY + headlineH / 2 - totalTextH / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.font = `900 ${hSize}px Arial, sans-serif`;
    ctx.fillText(line, w * 0.03, lineY);
    lineY += lineHeight;
  }

  ctx.fillStyle = "#f7d417";
  ctx.fillRect(0, tickerY, w, tickerH);
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  ctx.font = `800 ${Math.round(tickerH * 0.4)}px Arial, sans-serif`;
  const timeBoxW = ctx.measureText(timeStr).width + w * 0.04;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, tickerY, timeBoxW, tickerH);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(timeStr, w * 0.02, tickerY + tickerH / 2);

  ctx.font = `800 ${Math.round(tickerH * 0.38)}px Arial, sans-serif`;
  ctx.fillStyle = "#0a0a0a";
  const maxTickerWidth = w - timeBoxW - w * 0.06;
  const tickerLine = truncateToWidth(ctx, (ticker || "").toUpperCase(), maxTickerWidth);
  ctx.fillText(tickerLine, timeBoxW + w * 0.02, tickerY + tickerH / 2);
}

export function TemplateModal({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: (media: { url: string; type: "image" | "video" }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgFileName, setBgFileName] = useState<string | null>(null);
  const [wordmarkImg, setWordmarkImg] = useState<HTMLImageElement | null>(null);
  const [headline, setHeadline] = useState("");
  const [ticker, setTicker] = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const uploadMedia = useUploadMedia();

  useEffect(() => {
    return () => {
      if (bgImg) URL.revokeObjectURL(bgImg.src);
    };
  }, [bgImg]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setWordmarkImg(img);
    img.src = "/wordmark-white.svg";
  }, []);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw(canvas, bgImg, wordmarkImg, headline, ticker, orientation === "landscape" ? LANDSCAPE : PORTRAIT);
  }, [open, bgImg, wordmarkImg, headline, ticker, orientation]);

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setBgImg(img);
    img.src = url;
    setBgFileName(file.name);
  };

  const close = () => {
    setBgImg(null);
    setBgFileName(null);
    setHeadline("");
    setTicker("");
    setOrientation("landscape");
    onClose();
  };

  const generate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "template.png", { type: "image/png" });
      uploadMedia.mutate(file, {
        onSuccess: (media) => {
          onGenerated(media);
          close();
        },
      });
    }, "image/png");
  };

  return (
    <Modal open={open} onClose={close} title="Breaking news template" size="default">
      <div className="space-y-4">
        <div className="flex justify-center overflow-hidden rounded-lg bg-black">
          <canvas ref={canvasRef} className="max-h-[50vh] w-auto max-w-full" />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setOrientation("landscape")}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${
              orientation === "landscape"
                ? "border-brand bg-brand/10 text-brand"
                : "border-neutral-200 dark:border-neutral-700"
            }`}
          >
            Landscape
          </button>
          <button
            onClick={() => setOrientation("portrait")}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${
              orientation === "portrait"
                ? "border-brand bg-brand/10 text-brand"
                : "border-neutral-200 dark:border-neutral-700"
            }`}
          >
            Portrait
          </button>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-neutral-500">Background image</label>
          <button
            type="button"
            onClick={() => bgInputRef.current?.click()}
            className="flex w-full items-center gap-2 text-left"
          >
            {bgImg ? (
              <img src={bgImg.src} alt="" className="h-12 w-12 flex-shrink-0 rounded-md object-cover" />
            ) : (
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center text-black dark:text-white">
                <LuImagePlus className="h-6 w-6" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {bgFileName || "Choose a background image"}
              </span>
              <span className="block text-xs text-neutral-500">
                {bgImg ? "Click to change" : "PNG or JPG"}
              </span>
            </span>
          </button>
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            onChange={handleBackgroundChange}
            className="hidden"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-neutral-500">Headline</label>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={120}
            placeholder="Something went viral online"
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-neutral-500">Ticker</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            maxLength={200}
            placeholder="Is this really news? asks commenter"
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        <button
          onClick={generate}
          disabled={!bgImg || uploadMedia.isPending}
          className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          {uploadMedia.isPending ? "Generating…" : "Use template"}
        </button>
        {uploadMedia.isError && <p className="text-sm text-red-500">{(uploadMedia.error as Error).message}</p>}
      </div>
    </Modal>
  );
}
