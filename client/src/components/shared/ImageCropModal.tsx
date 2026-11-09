import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { LuX, LuRotateCw, LuZoomIn, LuZoomOut, LuRefreshCw } from "react-icons/lu";
import { Tooltip } from "./Tooltip";

export type CropAspect = "circle" | "banner" | "square";

interface ImageCropModalProps {
  open: boolean;
  imageFile: File | null;
  aspect?: CropAspect;
  title?: string;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
}

export function ImageCropModal({
  open,
  imageFile,
  aspect = "circle",
  title = "Edit Image",
  onClose,
  onCropComplete,
}: ImageCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [minZoom, setMinZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: aspect === "banner" ? 500 : 270,
    height: aspect === "banner" ? 165 : 270,
  });

  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const isBanner = aspect === "banner";
  const maxZoom = 3.5;

  const containerW = containerDimensions.width;
  const containerH = containerDimensions.height;

  const updateContainerDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerDimensions({ width: rect.width, height: rect.height });
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updateContainerDimensions();
    window.addEventListener("resize", updateContainerDimensions);
    return () => window.removeEventListener("resize", updateContainerDimensions);
  }, [open, updateContainerDimensions]);

  const getRotatedDimensions = useCallback(
    (rot: number) => {
      const isRotated = rot === 90 || rot === 270;
      const imgW = isRotated ? naturalSize.height : naturalSize.width;
      const imgH = isRotated ? naturalSize.width : naturalSize.height;
      return { imgW, imgH };
    },
    [naturalSize]
  );

  const getMinZoomForRotation = useCallback(
    (rot: number) => {
      if (!naturalSize.width || !naturalSize.height) return 1;
      const { imgW, imgH } = getRotatedDimensions(rot);
      const coverScaleW = containerW / imgW;
      const coverScaleH = containerH / imgH;
      const coverScale = Math.max(coverScaleW, coverScaleH);
      const baseScale = Math.max(containerW / naturalSize.width, containerH / naturalSize.height);
      return coverScale / baseScale;
    },
    [containerW, containerH, naturalSize, getRotatedDimensions]
  );

  const clampOffset = useCallback(
    (newOffset: { x: number; y: number }, currentZoom: number, rot: number) => {
      if (!naturalSize.width || !naturalSize.height) return newOffset;

      const { imgW, imgH } = getRotatedDimensions(rot);
      const baseScale = Math.max(containerW / naturalSize.width, containerH / naturalSize.height);
      const effectiveScale = baseScale * currentZoom;

      const renderedW = imgW * effectiveScale;
      const renderedH = imgH * effectiveScale;

      const maxOffsetX = Math.max(0, (renderedW - containerW) / 2);
      const maxOffsetY = Math.max(0, (renderedH - containerH) / 2);

      return {
        x: Math.min(maxOffsetX, Math.max(-maxOffsetX, newOffset.x)),
        y: Math.min(maxOffsetY, Math.max(-maxOffsetY, newOffset.y)),
      };
    },
    [containerW, containerH, naturalSize, getRotatedDimensions]
  );

  useEffect(() => {
    if (!imageFile) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setNaturalSize({ width: naturalWidth, height: naturalHeight });
    updateContainerDimensions();
    setMinZoom(1);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    const requiredMinZoom = getMinZoomForRotation(nextRot);
    setMinZoom(requiredMinZoom);
    const validZoom = Math.max(requiredMinZoom, zoom);
    setZoom(validZoom);
    setOffset((prev) => clampOffset(prev, validZoom, nextRot));
  };

  const handleZoomChange = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.min(maxZoom, Math.max(minZoom, newZoom));
      setZoom(clampedZoom);
      setOffset((prev) => clampOffset(prev, clampedZoom, rotation));
    },
    [minZoom, maxZoom, rotation, clampOffset]
  );

  useEffect(() => {
    if (!open) return;

    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const containerEl = containerRef.current;
    const workspaceEl = workspaceRef.current;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomStep = e.deltaY < 0 ? 0.22 : -0.22;

      setZoom((prevZoom) => {
        const nextZoom = Math.min(maxZoom, Math.max(minZoom, prevZoom + zoomStep));
        if (nextZoom === prevZoom) return prevZoom;

        let cursorRelX = 0;
        let cursorRelY = 0;

        if (containerEl) {
          const rect = containerEl.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          cursorRelX = e.clientX - centerX;
          cursorRelY = e.clientY - centerY;
        }

        const scaleChange = nextZoom / prevZoom;
        setOffset((prevOffset) => {
          const focalAdjustedX = cursorRelX - (cursorRelX - prevOffset.x) * scaleChange;
          const focalAdjustedY = cursorRelY - (cursorRelY - prevOffset.y) * scaleChange;
          return clampOffset({ x: focalAdjustedX, y: focalAdjustedY }, nextZoom, rotation);
        });

        return nextZoom;
      });
    };

    const getTouchDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchStartDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
        pinchStartZoomRef.current = zoom;
      }
    };

    const onTouchMoveNative = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDistanceRef.current !== null) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = dist / pinchStartDistanceRef.current;
        const targetZoom = pinchStartZoomRef.current * scale;

        setZoom(() => {
          const nextZoom = Math.min(maxZoom, Math.max(minZoom, targetZoom));
          setOffset((prevOffset) => clampOffset(prevOffset, nextZoom, rotation));
          return nextZoom;
        });
      }
    };

    const onTouchEndNative = () => {
      pinchStartDistanceRef.current = null;
    };

    if (workspaceEl) {
      workspaceEl.addEventListener("wheel", onWheelNative, { passive: false });
      workspaceEl.addEventListener("touchstart", onTouchStartNative, { passive: false });
      workspaceEl.addEventListener("touchmove", onTouchMoveNative, { passive: false });
      workspaceEl.addEventListener("touchend", onTouchEndNative);
    }

    return () => {
      document.body.style.overflow = originalStyle;
      if (workspaceEl) {
        workspaceEl.removeEventListener("wheel", onWheelNative);
        workspaceEl.removeEventListener("touchstart", onTouchStartNative);
        workspaceEl.removeEventListener("touchmove", onTouchMoveNative);
        workspaceEl.removeEventListener("touchend", onTouchEndNative);
      }
    };
  }, [open, minZoom, maxZoom, rotation, zoom, clampOffset]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const rawOffset = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    };
    setOffset(clampOffset(rawOffset, zoom, rotation));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
      }
    }
  };

  const handleApply = useCallback(() => {
    if (!imageSrc || !imageFile || !containerRef.current) return;
    setIsProcessing(true);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const sourceW = naturalSize.width || img.naturalWidth;
      const sourceH = naturalSize.height || img.naturalHeight;
      let outputW = aspect === "banner" ? 1500 : 1000;
      let outputH = aspect === "banner" ? 500 : 1000;
      const canvas = document.createElement("canvas");
      canvas.width = outputW;
      canvas.height = outputH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      ctx.clearRect(0, 0, outputW, outputH);
      if (imageFile.type !== "image/png") {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, outputW, outputH);
      }

      if (aspect === "circle") {
        ctx.beginPath();
        ctx.arc(outputW / 2, outputH / 2, outputW / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }

      const baseScale = Math.max(containerW / sourceW, containerH / sourceH);
      const effectiveScale = baseScale * zoom;
      const displayedW = sourceW * effectiveScale;
      const displayedH = sourceH * effectiveScale;
      const scaleToOutput = outputW / containerW;

      ctx.save();
      ctx.translate(outputW / 2 + offset.x * scaleToOutput, outputH / 2 + offset.y * scaleToOutput);
      ctx.rotate((rotation * Math.PI) / 180);

      const drawW = (rotation === 90 || rotation === 270 ? displayedH : displayedW) * scaleToOutput;
      const drawH = (rotation === 90 || rotation === 270 ? displayedW : displayedH) * scaleToOutput;

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const mimeType = imageFile.type === "image/png" ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          setIsProcessing(false);
          if (blob) {
            const ext = imageFile.type === "image/png" ? "png" : "jpg";
            const croppedFile = new File([blob], `cropped_${Date.now()}.${ext}`, {
              type: mimeType,
            });
            onCropComplete(croppedFile);
            onClose();
          }
        },
        mimeType,
        0.98
      );
    };
  }, [imageSrc, imageFile, aspect, naturalSize, containerW, containerH, zoom, offset, rotation, onCropComplete, onClose]);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  if (!open || !imageSrc) return null;

  const sliderPercentage = Math.min(100, Math.max(0, ((zoom - minZoom) / (maxZoom - minZoom)) * 100));

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-lg transition-all duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-xl max-h-[92vh] flex-col overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5 sm:px-6 sm:py-4 dark:border-neutral-800/80">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              {title || (isBanner ? "Edit Banner" : "Edit Profile Picture")}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {isTouchDevice ? "Pinch to zoom, drag to position." : "Scroll to zoom, drag to position."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-white transition-colors"
            aria-label="Close"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Workspace */}
        <div
          ref={workspaceRef}
          className="relative flex items-center justify-center bg-neutral-100/80 p-4 sm:p-8 min-h-[300px] sm:min-h-[360px] select-none overflow-hidden touch-none dark:bg-neutral-900/80"
        >
          <div className="absolute inset-0 bg-[radial-gradient(#a3a3a3_1px,transparent_1px)] dark:bg-[radial-gradient(#404040_1px,transparent_1px)] [background-size:20px_20px] opacity-30" />

          <div className="pointer-events-none absolute inset-0 bg-black/40" />

          {/* Mask Viewport */}
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`relative cursor-grab active:cursor-grabbing overflow-hidden border-2 border-brand shadow-[0_0_40px_rgba(0,0,0,0.5)] z-20 ${
              isBanner
                ? "h-[140px] sm:h-[165px] w-full max-w-[500px] rounded-2xl"
                : aspect === "circle"
                ? "h-[220px] w-[220px] sm:h-[270px] sm:w-[270px] rounded-full"
                : "h-[220px] w-[220px] sm:h-[270px] sm:w-[270px] rounded-2xl"
            }`}
          >
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                transformOrigin: "center center",
              }}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop viewport preview"
                onLoad={handleImageLoad}
                className="max-h-none max-w-none"
                style={{
                  minWidth: "100%",
                  minHeight: "100%",
                  objectFit: "cover",
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/30" />
          </div>
        </div>

        {/* Controls Section */}
        <div className="space-y-3 sm:space-y-4 px-5 py-4 sm:px-6 sm:py-5 bg-white border-t border-neutral-100 dark:bg-neutral-950 dark:border-neutral-800/80">
          {/* Slider & Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => handleZoomChange(zoom - 0.15)}
              className="p-1 text-neutral-400 hover:text-brand"
            >
              <LuZoomOut className="h-4 w-4" />
            </button>

            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step={0.01}
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                style={{
                  background: `linear-gradient(to right, #1A4DFF 0%, #1A4DFF ${sliderPercentage}%, rgba(163, 163, 163, 0.25) ${sliderPercentage}%, rgba(163, 163, 163, 0.25) 100%)`,
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => handleZoomChange(zoom + 0.15)}
              className="p-1 text-neutral-400 hover:text-brand"
            >
              <LuZoomIn className="h-4 w-4" />
            </button>

            <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5 sm:mx-1" />

            <Tooltip text="Rotate 90°" align="right">
              <button
                type="button"
                onClick={handleRotate}
                aria-label="Rotate 90°"
                className="rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-neutral-600 hover:bg-neutral-100 hover:text-black dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
              >
                <LuRotateCw className="h-4 w-4" />
              </button>
            </Tooltip>

            <Tooltip text="Reset position & zoom" align="right">
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset position and zoom"
                className="rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-neutral-600 hover:bg-neutral-100 hover:text-black dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
              >
                <LuRefreshCw className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-300 px-4 sm:px-5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing}
              className="rounded-full bg-brand px-5 sm:px-6 py-2 text-xs font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isProcessing ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
