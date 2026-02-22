import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { decompressFrames, parseGIF, type ParsedFrame } from "gifuct-js";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Falha ao carregar imagem"));
    image.src = src;
  });

const getDataUrlMime = (dataUrl: string) => {
  const match = dataUrl.match(/^data:([^;]+);base64,/i);
  return match?.[1]?.toLowerCase() ?? "image/png";
};

const dataUrlToBytes = (dataUrl: string) => {
  const base64Index = dataUrl.indexOf(",");
  const base64 = base64Index >= 0 ? dataUrl.slice(base64Index + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToDataUrl = (bytes: Uint8Array, mimeType: string) => {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

type CropSelection = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasViewport = {
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
};

type AnimatedFrame = {
  canvas: HTMLCanvasElement;
  delayMs: number;
};

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type DragInteraction =
  | { mode: "new"; anchorX: number; anchorY: number }
  | { mode: "move"; offsetX: number; offsetY: number }
  | { mode: "resize"; handle: ResizeHandle };

type ImageCropFlipFieldProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  flipHorizontalValue?: boolean;
  onFlipHorizontalChange?: (value: boolean) => void;
  label?: string;
};

const decodeGifFrames = (sourceDataUrl: string) => {
  const sourceBytes = dataUrlToBytes(sourceDataUrl);
  const sourceBuffer = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength);
  const parsed = parseGIF(sourceBuffer);
  const frames = decompressFrames(parsed, true) as ParsedFrame[];

  if (frames.length === 0) {
    throw new Error("GIF invalido: sem frames.");
  }

  const width = parsed.lsd.width;
  const height = parsed.lsd.height;
  const compositionCanvas = document.createElement("canvas");
  compositionCanvas.width = width;
  compositionCanvas.height = height;
  const compositionContext = compositionCanvas.getContext("2d", { willReadFrequently: true });

  if (!compositionContext) {
    throw new Error("Nao foi possivel ler os frames do GIF.");
  }

  const composedFrames: AnimatedFrame[] = [];

  for (const frame of frames) {
    let restoreSnapshot: ImageData | null = null;

    if (frame.disposalType === 3) {
      restoreSnapshot = compositionContext.getImageData(0, 0, width, height);
    }

    const patchImageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
    compositionContext.putImageData(patchImageData, frame.dims.left, frame.dims.top);

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = width;
    frameCanvas.height = height;
    const frameContext = frameCanvas.getContext("2d");
    if (!frameContext) {
      throw new Error("Nao foi possivel montar frame do GIF.");
    }

    frameContext.drawImage(compositionCanvas, 0, 0);
    composedFrames.push({
      canvas: frameCanvas,
      delayMs: Math.max(20, frame.delay || 80),
    });

    if (frame.disposalType === 2) {
      compositionContext.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    } else if (frame.disposalType === 3 && restoreSnapshot) {
      compositionContext.putImageData(restoreSnapshot, 0, 0);
    }
  }

  return { width, height, frames: composedFrames };
};

const drawStaticToDataUrl = (image: HTMLImageElement, selection: CropSelection, flipHorizontal: boolean, mimeType: string) => {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = selection.width;
  outputCanvas.height = selection.height;
  const context = outputCanvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel processar a imagem.");
  }

  context.save();
  if (flipHorizontal) {
    context.translate(selection.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(image, selection.x, selection.y, selection.width, selection.height, 0, 0, selection.width, selection.height);
  context.restore();

  return outputCanvas.toDataURL(mimeType.includes("jpeg") ? "image/jpeg" : "image/png");
};

const drawGifToDataUrl = (sourceDataUrl: string, selection: CropSelection, flipHorizontal: boolean) => {
  const sourceBytes = dataUrlToBytes(sourceDataUrl);
  const sourceBuffer = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength);
  const parsed = parseGIF(sourceBuffer);
  const frames = decompressFrames(parsed, true) as ParsedFrame[];

  if (frames.length === 0) {
    throw new Error("GIF invalido: sem frames.");
  }

  const gifWidth = parsed.lsd.width;
  const gifHeight = parsed.lsd.height;
  const compositionCanvas = document.createElement("canvas");
  compositionCanvas.width = gifWidth;
  compositionCanvas.height = gifHeight;
  const compositionContext = compositionCanvas.getContext("2d", { willReadFrequently: true });

  if (!compositionContext) {
    throw new Error("Nao foi possivel ler os frames do GIF.");
  }

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = selection.width;
  cropCanvas.height = selection.height;
  const cropContext = cropCanvas.getContext("2d", { willReadFrequently: true });

  if (!cropContext) {
    throw new Error("Nao foi possivel gerar recorte do GIF.");
  }

  const encoder = GIFEncoder();

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    let restoreSnapshot: ImageData | null = null;

    if (frame.disposalType === 3) {
      restoreSnapshot = compositionContext.getImageData(0, 0, gifWidth, gifHeight);
    }

    const patchImageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
    compositionContext.putImageData(patchImageData, frame.dims.left, frame.dims.top);

    cropContext.clearRect(0, 0, selection.width, selection.height);
    cropContext.save();
    if (flipHorizontal) {
      cropContext.translate(selection.width, 0);
      cropContext.scale(-1, 1);
    }
    cropContext.drawImage(
      compositionCanvas,
      selection.x,
      selection.y,
      selection.width,
      selection.height,
      0,
      0,
      selection.width,
      selection.height,
    );
    cropContext.restore();

    const rgba = cropContext.getImageData(0, 0, selection.width, selection.height).data;
    const palette = quantize(rgba, 256, { format: "rgba4444", oneBitAlpha: true });
    const index = applyPalette(rgba, palette, "rgba4444");
    const transparentIndex = palette.findIndex((color) => (color[3] ?? 255) === 0);

    encoder.writeFrame(index, selection.width, selection.height, {
      palette,
      delay: Math.max(20, frame.delay || 80),
      repeat: frameIndex === 0 ? 0 : undefined,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
      dispose: frame.disposalType >= 0 ? frame.disposalType : undefined,
    });

    if (frame.disposalType === 2) {
      compositionContext.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    } else if (frame.disposalType === 3 && restoreSnapshot) {
      compositionContext.putImageData(restoreSnapshot, 0, 0);
    }
  }

  encoder.finish();
  return bytesToDataUrl(encoder.bytes(), "image/gif");
};

const normalizeSelection = (selection: CropSelection, sourceWidth: number, sourceHeight: number): CropSelection => {
  const x = clamp(Math.floor(selection.x), 0, Math.max(0, sourceWidth - 1));
  const y = clamp(Math.floor(selection.y), 0, Math.max(0, sourceHeight - 1));
  const width = clamp(Math.floor(selection.width), 1, Math.max(1, sourceWidth - x));
  const height = clamp(Math.floor(selection.height), 1, Math.max(1, sourceHeight - y));
  return { x, y, width, height };
};

const getHandleAtPoint = (
  point: { x: number; y: number },
  selection: CropSelection,
  sourceWidth: number,
  sourceHeight: number,
  viewport: CanvasViewport,
): ResizeHandle | null => {
  const toleranceX = (12 / Math.max(1, viewport.drawWidth)) * sourceWidth;
  const toleranceY = (12 / Math.max(1, viewport.drawHeight)) * sourceHeight;
  const tolerance = Math.max(2, Math.max(toleranceX, toleranceY));
  const left = selection.x;
  const top = selection.y;
  const right = selection.x + selection.width;
  const bottom = selection.y + selection.height;

  const nearLeft = Math.abs(point.x - left) <= tolerance;
  const nearRight = Math.abs(point.x - right) <= tolerance;
  const nearTop = Math.abs(point.y - top) <= tolerance;
  const nearBottom = Math.abs(point.y - bottom) <= tolerance;

  if (nearLeft && nearTop) return "nw";
  if (nearRight && nearTop) return "ne";
  if (nearLeft && nearBottom) return "sw";
  if (nearRight && nearBottom) return "se";
  return null;
};

const resizeSelectionFromHandle = (
  selection: CropSelection,
  handle: ResizeHandle,
  point: { x: number; y: number },
  sourceWidth: number,
  sourceHeight: number,
): CropSelection => {
  const left = selection.x;
  const top = selection.y;
  const right = selection.x + selection.width;
  const bottom = selection.y + selection.height;

  if (handle === "nw") {
    const nextX = clamp(Math.floor(point.x), 0, right - 1);
    const nextY = clamp(Math.floor(point.y), 0, bottom - 1);
    return normalizeSelection({ x: nextX, y: nextY, width: right - nextX, height: bottom - nextY }, sourceWidth, sourceHeight);
  }

  if (handle === "ne") {
    const nextRight = clamp(Math.floor(point.x), left + 1, sourceWidth);
    const nextY = clamp(Math.floor(point.y), 0, bottom - 1);
    return normalizeSelection({ x: left, y: nextY, width: nextRight - left, height: bottom - nextY }, sourceWidth, sourceHeight);
  }

  if (handle === "sw") {
    const nextX = clamp(Math.floor(point.x), 0, right - 1);
    const nextBottom = clamp(Math.floor(point.y), top + 1, sourceHeight);
    return normalizeSelection({ x: nextX, y: top, width: right - nextX, height: nextBottom - top }, sourceWidth, sourceHeight);
  }

  const nextRight = clamp(Math.floor(point.x), left + 1, sourceWidth);
  const nextBottom = clamp(Math.floor(point.y), top + 1, sourceHeight);
  return normalizeSelection({ x: left, y: top, width: nextRight - left, height: nextBottom - top }, sourceWidth, sourceHeight);
};

export const ImageCropFlipField = ({
  value,
  onChange,
  flipHorizontalValue,
  onFlipHorizontalChange,
  label = "Imagem",
}: ImageCropFlipFieldProps) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [staticImage, setStaticImage] = useState<HTMLImageElement | null>(null);
  const [animatedFrames, setAnimatedFrames] = useState<AnimatedFrame[] | null>(null);
  const [selection, setSelection] = useState<CropSelection | null>(null);
  const [flipHorizontal, setFlipHorizontal] = useState(true);
  const [loadingImage, setLoadingImage] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<CanvasViewport>({ drawX: 0, drawY: 0, drawWidth: 0, drawHeight: 0 });
  const dragStateRef = useRef<DragInteraction | null>(null);
  const animationRef = useRef({ index: 0, lastAt: 0, elapsed: 0 });

  useEffect(() => {
    if (editorOpen) {
      return;
    }
    setSourceImage(value ?? null);
  }, [editorOpen, value]);

  useEffect(() => {
    if (typeof flipHorizontalValue === "boolean") {
      setFlipHorizontal(flipHorizontalValue);
    }
  }, [flipHorizontalValue]);

  const syncFlipHorizontal = (nextValue: boolean) => {
    setFlipHorizontal(nextValue);
    onFlipHorizontalChange?.(nextValue);
  };

  const ensureImageReady = async (nextSource: string) => {
    const mimeType = getDataUrlMime(nextSource);

    if (mimeType.includes("gif")) {
      const decoded = decodeGifFrames(nextSource);
      setAnimatedFrames(decoded.frames);
      setStaticImage(null);
      setSourceSize({ width: decoded.width, height: decoded.height });
      setSelection({ x: 0, y: 0, width: decoded.width, height: decoded.height });
      animationRef.current = { index: 0, lastAt: 0, elapsed: 0 };
      return;
    }

    const image = await loadImage(nextSource);
    setStaticImage(image);
    setAnimatedFrames(null);
    setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
    setSelection({ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight });
    animationRef.current = { index: 0, lastAt: 0, elapsed: 0 };
  };

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas || sourceSize.width <= 0 || sourceSize.height <= 0) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const viewport = viewportRef.current;

    const pointerCanvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const pointerCanvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;

    const constrainedX = clamp(pointerCanvasX, viewport.drawX, viewport.drawX + viewport.drawWidth);
    const constrainedY = clamp(pointerCanvasY, viewport.drawY, viewport.drawY + viewport.drawHeight);

    const imageX = ((constrainedX - viewport.drawX) / viewport.drawWidth) * sourceSize.width;
    const imageY = ((constrainedY - viewport.drawY) / viewport.drawHeight) * sourceSize.height;
    return {
      x: clamp(imageX, 0, sourceSize.width),
      y: clamp(imageY, 0, sourceSize.height),
    };
  };

  useEffect(() => {
    if (!editorOpen || !selection || sourceSize.width <= 0 || sourceSize.height <= 0) {
      return;
    }

    let frame = 0;

    const draw = (now: number) => {
      const editorCanvas = editorCanvasRef.current;
      const previewCanvas = previewCanvasRef.current;
      if (!editorCanvas || !previewCanvas) {
        frame = requestAnimationFrame(draw);
        return;
      }

      let sourceFrame: CanvasImageSource | null = staticImage;
      if (animatedFrames && animatedFrames.length > 0) {
        if (animationRef.current.lastAt === 0) {
          animationRef.current.lastAt = now;
        }

        const delta = now - animationRef.current.lastAt;
        animationRef.current.lastAt = now;
        animationRef.current.elapsed += delta;

        let current = animatedFrames[animationRef.current.index] ?? animatedFrames[0];
        while (animationRef.current.elapsed >= current.delayMs) {
          animationRef.current.elapsed -= current.delayMs;
          animationRef.current.index = (animationRef.current.index + 1) % animatedFrames.length;
          current = animatedFrames[animationRef.current.index] ?? animatedFrames[0];
        }

        sourceFrame = current.canvas;
      }

      if (!sourceFrame) {
        frame = requestAnimationFrame(draw);
        return;
      }

      const editorContext = editorCanvas.getContext("2d");
      if (editorContext) {
        const canvasWidth = 960;
        const canvasHeight = 520;
        if (editorCanvas.width !== canvasWidth || editorCanvas.height !== canvasHeight) {
          editorCanvas.width = canvasWidth;
          editorCanvas.height = canvasHeight;
        }

        const scale = Math.min(canvasWidth / sourceSize.width, canvasHeight / sourceSize.height);
        const drawWidth = sourceSize.width * scale;
        const drawHeight = sourceSize.height * scale;
        const drawX = (canvasWidth - drawWidth) / 2;
        const drawY = (canvasHeight - drawHeight) / 2;
        viewportRef.current = { drawX, drawY, drawWidth, drawHeight };

        editorContext.clearRect(0, 0, canvasWidth, canvasHeight);
        editorContext.fillStyle = "#101112";
        editorContext.fillRect(0, 0, canvasWidth, canvasHeight);
        editorContext.drawImage(sourceFrame, drawX, drawY, drawWidth, drawHeight);

        const viewSelX = drawX + (selection.x / sourceSize.width) * drawWidth;
        const viewSelY = drawY + (selection.y / sourceSize.height) * drawHeight;
        const viewSelW = (selection.width / sourceSize.width) * drawWidth;
        const viewSelH = (selection.height / sourceSize.height) * drawHeight;

        editorContext.fillStyle = "rgba(0, 0, 0, 0.45)";
        editorContext.fillRect(drawX, drawY, drawWidth, drawHeight);
        editorContext.drawImage(sourceFrame, selection.x, selection.y, selection.width, selection.height, viewSelX, viewSelY, viewSelW, viewSelH);

        editorContext.strokeStyle = "rgba(255, 255, 255, 0.95)";
        editorContext.lineWidth = 2;
        editorContext.strokeRect(viewSelX, viewSelY, viewSelW, viewSelH);

        const handleSize = 9;
        editorContext.fillStyle = "rgba(255, 255, 255, 0.95)";
        editorContext.fillRect(viewSelX - handleSize / 2, viewSelY - handleSize / 2, handleSize, handleSize);
        editorContext.fillRect(viewSelX + viewSelW - handleSize / 2, viewSelY - handleSize / 2, handleSize, handleSize);
        editorContext.fillRect(viewSelX - handleSize / 2, viewSelY + viewSelH - handleSize / 2, handleSize, handleSize);
        editorContext.fillRect(viewSelX + viewSelW - handleSize / 2, viewSelY + viewSelH - handleSize / 2, handleSize, handleSize);
      }

      const previewContext = previewCanvas.getContext("2d");
      if (previewContext) {
        const maxPreview = 280;
        const ratio = selection.width / selection.height;
        const previewWidth = selection.width >= selection.height ? maxPreview : Math.max(120, Math.floor(maxPreview * ratio));
        const previewHeight = selection.height > selection.width ? maxPreview : Math.max(120, Math.floor(maxPreview / ratio));

        if (previewCanvas.width !== previewWidth || previewCanvas.height !== previewHeight) {
          previewCanvas.width = previewWidth;
          previewCanvas.height = previewHeight;
        }

        previewContext.clearRect(0, 0, previewWidth, previewHeight);
        previewContext.save();
        if (flipHorizontal) {
          previewContext.translate(previewWidth, 0);
          previewContext.scale(-1, 1);
        }
        previewContext.drawImage(sourceFrame, selection.x, selection.y, selection.width, selection.height, 0, 0, previewWidth, previewHeight);
        previewContext.restore();
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [animatedFrames, editorOpen, flipHorizontal, selection, sourceSize, staticImage]);

  const applyAndSave = () => {
    if (!selection || !sourceImage) {
      return;
    }

    try {
      const mimeType = getDataUrlMime(sourceImage);
      const output = mimeType.includes("gif")
        ? drawGifToDataUrl(sourceImage, selection, flipHorizontal)
        : staticImage
          ? drawStaticToDataUrl(staticImage, selection, flipHorizontal, mimeType)
          : null;

      if (!output) {
        throw new Error("Nao foi possivel gerar imagem final.");
      }

      setSourceImage(output);
      onChange(output);
      setEditorOpen(false);
      setEditorError(null);
    } catch {
      setEditorError("Nao foi possivel aplicar recorte/flip para esta imagem.");
    }
  };

  const imageMeta = sourceSize.width > 0 ? `${sourceSize.width}x${sourceSize.height}` : "-";

  useEffect(() => {
    if (editorOpen) {
      return;
    }
    dragStateRef.current = null;
  }, [editorOpen]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
              const data = String(reader.result);
              setSourceImage(data);
              syncFlipHorizontal(true);
              setEditorError(null);
              setLoadingImage(true);
              void ensureImageReady(data)
                .then(() => setEditorOpen(true))
                .catch(() => setEditorError("Nao foi possivel abrir a imagem selecionada."))
                .finally(() => setLoadingImage(false));
            };
            reader.onerror = () => setEditorError("Falha ao carregar arquivo.");
            reader.readAsDataURL(file);
            event.currentTarget.value = "";
          }}
        />

        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={!sourceImage && !value}
              onClick={() => {
                const imageToOpen = value ?? sourceImage;
                if (!imageToOpen) return;
                setEditorError(null);
                setSourceImage(imageToOpen);
                setLoadingImage(true);
                void ensureImageReady(imageToOpen)
                  .catch(() => setEditorError("Nao foi possivel abrir a imagem selecionada."))
                  .finally(() => setLoadingImage(false));
              }}
            >
              Recortar / Flipar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Editar imagem</DialogTitle>
              <DialogDescription>Arraste no canvas para recortar. No GIF, o recorte e preview ficam animados durante a edicao.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Arraste para criar recorte. Arraste dentro para mover. Use os cantos para redimensionar.</p>
                <div className="overflow-hidden rounded-md border bg-muted/20 p-2">
                  {loadingImage ? <p className="p-6 text-center text-sm text-muted-foreground">Carregando imagem...</p> : null}
                  <canvas
                    ref={editorCanvasRef}
                    className={`mx-auto block h-auto w-full max-w-[960px] rounded-sm touch-none ${loadingImage ? "pointer-events-none opacity-30" : "cursor-crosshair"}`}
                    onPointerDown={(event) => {
                      if (loadingImage) return;
                      const point = getCanvasPoint(event);
                      if (!point) {
                        return;
                      }

                      (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
                      const currentSelection = selection ?? {
                        x: 0,
                        y: 0,
                        width: sourceSize.width,
                        height: sourceSize.height,
                      };

                      if (currentSelection.width > 0 && currentSelection.height > 0) {
                        const handle = getHandleAtPoint(point, currentSelection, sourceSize.width, sourceSize.height, viewportRef.current);
                        if (handle) {
                          dragStateRef.current = { mode: "resize", handle };
                          return;
                        }

                        const insideSelection =
                          point.x >= currentSelection.x &&
                          point.x <= currentSelection.x + currentSelection.width &&
                          point.y >= currentSelection.y &&
                          point.y <= currentSelection.y + currentSelection.height;

                        if (insideSelection) {
                          dragStateRef.current = {
                            mode: "move",
                            offsetX: point.x - currentSelection.x,
                            offsetY: point.y - currentSelection.y,
                          };
                          return;
                        }
                      }

                      dragStateRef.current = { mode: "new", anchorX: point.x, anchorY: point.y };
                      setSelection(normalizeSelection({ x: point.x, y: point.y, width: 1, height: 1 }, sourceSize.width, sourceSize.height));
                    }}
                    onPointerMove={(event) => {
                      const point = getCanvasPoint(event);
                      const dragState = dragStateRef.current;
                      if (!point || !dragState || sourceSize.width <= 0 || sourceSize.height <= 0) {
                        return;
                      }

                      if (dragState.mode === "new") {
                        const x = Math.min(dragState.anchorX, point.x);
                        const y = Math.min(dragState.anchorY, point.y);
                        const width = Math.abs(point.x - dragState.anchorX);
                        const height = Math.abs(point.y - dragState.anchorY);
                        setSelection(normalizeSelection({ x, y, width, height }, sourceSize.width, sourceSize.height));
                        return;
                      }

                      if (dragState.mode === "move") {
                        setSelection((previous) => {
                          if (!previous) {
                            return previous;
                          }
                          const nextX = clamp(Math.floor(point.x - dragState.offsetX), 0, sourceSize.width - previous.width);
                          const nextY = clamp(Math.floor(point.y - dragState.offsetY), 0, sourceSize.height - previous.height);
                          return { ...previous, x: nextX, y: nextY };
                        });
                        return;
                      }

                      setSelection((previous) => {
                        if (!previous) {
                          return previous;
                        }
                        return resizeSelectionFromHandle(previous, dragState.handle, point, sourceSize.width, sourceSize.height);
                      });
                    }}
                    onPointerUp={(event) => {
                      if ((event.currentTarget as HTMLCanvasElement).hasPointerCapture(event.pointerId)) {
                        (event.currentTarget as HTMLCanvasElement).releasePointerCapture(event.pointerId);
                      }
                      dragStateRef.current = null;
                    }}
                    onPointerLeave={() => {
                      dragStateRef.current = null;
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="mb-2 text-xs text-muted-foreground">Configurações</p>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={flipHorizontal}
                      onChange={(event) => syncFlipHorizontal(event.target.checked)}
                      className="h-4 w-4"
                    />
                    Flip horizontal
                  </label>
                  <p className="mt-2 text-xs text-muted-foreground">Imagem original: {imageMeta}</p>
                  <p className="text-xs text-muted-foreground">
                    Corte:{" "}
                    {selection ? `${selection.width}x${selection.height} @ (${selection.x}, ${selection.y})` : "-"}
                  </p>
                </div>

                <div className="rounded-md border bg-muted/20 p-2">
                  <p className="mb-1 text-xs text-muted-foreground">Preview final (animado para GIF)</p>
                  <canvas ref={previewCanvasRef} className="mx-auto block max-h-[280px] max-w-full rounded-sm" />
                </div>

                {editorError ? <p className="text-xs text-red-500">{editorError}</p> : null}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={applyAndSave} disabled={loadingImage || !selection}>
                Aplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onChange(null);
            setSourceImage(null);
            setStaticImage(null);
            setAnimatedFrames(null);
            setSelection(null);
            setSourceSize({ width: 0, height: 0 });
            setLoadingImage(false);
            syncFlipHorizontal(true);
          }}
          disabled={!value}
        >
          Remover
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">Padrao recomendado: manter flip horizontal marcado para esquerda.</p>
      {value ? (
        <div className="rounded-md border bg-muted/20 p-2">
          <img src={value} alt="Preview imagem editada" className="h-20 w-20 rounded object-cover" />
        </div>
      ) : null}
    </div>
  );
};
