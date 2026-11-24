import { useCallback, useEffect, useRef } from 'react';

export type InkTool = 'pen' | 'highlighter' | 'eraser';

type Options = {
    inkDataUrl?: string;
    color: string;
    strokeWidth: number;
    tool: InkTool;
    enabled: boolean;
    onInkChange: (dataUrl: string) => void;
};

export function useInkCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, options: Options) {
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const inkLoaded = useRef<string | undefined>(undefined);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            const ctx = canvas.getContext('2d');
            const prev = ctx ? canvas.toDataURL('image/png') : null;
            canvas.width = w;
            canvas.height = h;
            if (ctx && prev && prev.length > 32) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, w, h);
                };
                img.src = prev;
            }
        }
    }, [canvasRef]);

    const loadInk = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const src = options.inkDataUrl;
        if (!src) {
            if (inkLoaded.current) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                inkLoaded.current = undefined;
            }
            return;
        }
        if (inkLoaded.current === src) return;
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            inkLoaded.current = src;
        };
        img.src = src;
    }, [canvasRef, options.inkDataUrl]);

    useEffect(() => {
        resizeCanvas();
        loadInk();
    }, [resizeCanvas, loadInk, options.inkDataUrl]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => {
            resizeCanvas();
            loadInk();
        });
        ro.observe(canvas);
        return () => ro.disconnect();
    }, [canvasRef, resizeCanvas, loadInk]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return {
            x: (e.clientX - rect.left) * dpr,
            y: (e.clientY - rect.top) * dpr
        };
    };

    const strokeStyle = useCallback(() => {
        if (options.tool === 'eraser') return { mode: 'destination-out' as GlobalCompositeOperation, color: 'rgba(0,0,0,1)', width: options.strokeWidth * 2.2 };
        if (options.tool === 'highlighter') {
            return { mode: 'multiply' as GlobalCompositeOperation, color: options.color + '55', width: options.strokeWidth * 2.6 };
        }
        return { mode: 'source-over' as GlobalCompositeOperation, color: options.color, width: options.strokeWidth };
    }, [options.color, options.strokeWidth, options.tool]);

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!options.enabled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(e.pointerId);
        drawing.current = true;
        last.current = pointerPos(e);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current || !options.enabled) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !last.current) return;
        const next = pointerPos(e);
        const style = strokeStyle();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = style.mode;
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        last.current = next;
    };

    const endStroke = () => {
        if (!drawing.current) return;
        drawing.current = false;
        last.current = null;
        inkLoaded.current = undefined;
        const canvas = canvasRef.current;
        if (!canvas) return;
        options.onInkChange(canvas.toDataURL('image/png'));
    };

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp: endStroke,
        onPointerLeave: endStroke
    };
}