
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { ImageDimensions } from './types';
import FileDropzone from './components/FileDropzone';
import Button from './components/Button';
import Spinner from './components/Spinner';
import { DownloadIcon, XCircleIcon, RefreshIcon } from './components/icons';

const TARGET_WIDTH = 1040;
const TARGET_HEIGHT = 1040;

/**
 * Calculates the average color from the border pixels of an image.
 * @param img The HTMLImageElement to process.
 * @returns An RGB color string (e.g., "rgb(123, 45, 67)").
 */
const getAverageBorderColor = (img: HTMLImageElement): string => {
    const canvas = document.createElement('canvas');
    const { width, height } = img;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx || width === 0 || height === 0) {
        return 'rgb(0, 0, 0)';
    }

    ctx.drawImage(img, 0, 0, width, height);
    
    try {
        const imageData = ctx.getImageData(0, 0, width, height).data;
        let r = 0, g = 0, b = 0;
        let count = 0;

        // Top and bottom edges
        for (let x = 0; x < width; x++) {
            let iTop = (0 * width + x) * 4;
            r += imageData[iTop];
            g += imageData[iTop + 1];
            b += imageData[iTop + 2];
            
            let iBottom = ((height - 1) * width + x) * 4;
            r += imageData[iBottom];
            g += imageData[iBottom + 1];
            b += imageData[iBottom + 2];
        }
        count += width * 2;

        // Left and right edges (excluding corners already counted)
        for (let y = 1; y < height - 1; y++) {
            let iLeft = (y * width + 0) * 4;
            r += imageData[iLeft];
            g += imageData[iLeft + 1];
            b += imageData[iLeft + 2];

            let iRight = (y * width + (width - 1)) * 4;
            r += imageData[iRight];
            g += imageData[iRight + 1];
            b += imageData[iRight + 2];
        }
        count += (height - 2) * 2;
        
        if (count === 0) {
             if(imageData.length >= 3) return `rgb(${imageData[0]}, ${imageData[1]}, ${imageData[2]})`;
             return 'rgb(0, 0, 0)';
        }

        const avgR = Math.floor(r / count);
        const avgG = Math.floor(g / count);
        const avgB = Math.floor(b / count);
        
        return `rgb(${avgR}, ${avgG}, ${avgB})`;

    } catch (e) {
        console.error("Error getting image data for border color:", e);
        return 'rgb(0, 0, 0)';
    }
};

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<ImageDimensions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // State for interactive canvas
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Refs for managing canvas and interaction state
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialFit = useRef<{ scale: number; x: number; y: number }>({ scale: 1, x: 0, y: 0 });
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetState = useCallback(() => {
    setImageFile(null);
    setOriginalDimensions(null);
    setError(null);
    setIsProcessing(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    imageRef.current = null;
    if (originalSrc) {
      URL.revokeObjectURL(originalSrc);
    }
    setOriginalSrc(null);
  }, [originalSrc]);
  
  // Effect to load the image and set initial state
  useEffect(() => {
    if (!imageFile) return;

    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target?.result as string;
      
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setOriginalDimensions({ width: img.width, height: img.height });
        
        const scaleFactor = Math.min(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height);
        initialFit.current = {
            scale: scaleFactor,
            x: (TARGET_WIDTH - img.width * scaleFactor) / 2,
            y: (TARGET_HEIGHT - img.height * scaleFactor) / 2,
        };
        
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setOriginalSrc(imgSrc); // Set src here to trigger redraw effect
        setIsProcessing(false);
      };
      img.onerror = () => {
        setError("ไม่สามารถโหลดไฟล์รูปภาพได้ อาจเป็นไฟล์ที่เสียหายหรือไม่ใช่รูปภาพ");
        setIsProcessing(false);
      };
      img.src = imgSrc;
    };
    reader.onerror = () => {
        setError("เกิดข้อผิดพลาดในการอ่านไฟล์");
        setIsProcessing(false);
    };
    reader.readAsDataURL(imageFile);
  }, [imageFile]);


  // Effect to redraw canvas when image, zoom, or pan changes
  useEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !originalSrc) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentScale = initialFit.current.scale * zoom;
    const scaledWidth = img.width * currentScale;
    const scaledHeight = img.height * currentScale;

    const maxPanX = Math.max(0, (scaledWidth - TARGET_WIDTH) / 2);
    const maxPanY = Math.max(0, (scaledHeight - TARGET_HEIGHT) / 2);
    
    const clampedPan = {
        x: Math.max(-maxPanX, Math.min(maxPanX, pan.x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, pan.y)),
    };
    
    if (clampedPan.x !== pan.x || clampedPan.y !== pan.y) {
        setPan(clampedPan);
        return; // Let the re-render with new pan value handle the drawing
    }

    const backgroundColor = getAverageBorderColor(img);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

    const drawX = initialFit.current.x + clampedPan.x - (scaledWidth - initialFit.current.scale * img.width) / 2;
    const drawY = initialFit.current.y + clampedPan.y - (scaledHeight - initialFit.current.scale * img.height) / 2;

    ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);

  }, [zoom, pan, originalSrc]);


  const handleDownload = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageFile) return;

    // Use a temporary canvas to draw the full-quality image for download
    const downloadCanvas = document.createElement('canvas');
    downloadCanvas.width = TARGET_WIDTH;
    downloadCanvas.height = TARGET_HEIGHT;
    const ctx = downloadCanvas.getContext('2d');
    if (!ctx) return;
    
    // Perform the same drawing operations as the preview
    const backgroundColor = getAverageBorderColor(img);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

    const currentScale = initialFit.current.scale * zoom;
    const scaledWidth = img.width * currentScale;
    const scaledHeight = img.height * currentScale;
    const drawX = initialFit.current.x + pan.x - (scaledWidth - initialFit.current.scale * img.width) / 2;
    const drawY = initialFit.current.y + pan.y - (scaledHeight - initialFit.current.scale * img.height) / 2;

    ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);

    const link = document.createElement('a');
    link.href = downloadCanvas.toDataURL('image/jpeg', 1.0);
    const nameWithoutExtension = imageFile.name.split('.').slice(0, -1).join('.');
    link.download = `${nameWithoutExtension}_${TARGET_WIDTH}x${TARGET_HEIGHT}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (file: File) => {
    resetState();
    setImageFile(file);
  };

  const renderContent = () => {
    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-center h-96">
          <Spinner />
          <p className="text-lg font-medium text-slate-300">กำลังประมวลผลรูปภาพ...</p>
          <p className="text-sm text-slate-400">โปรดรอสักครู่</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-center bg-red-900/20 border-2 border-red-500/50 rounded-xl p-8">
          <XCircleIcon className="w-16 h-16 text-red-500" />
          <h3 className="text-xl font-bold text-red-400">เกิดข้อผิดพลาด</h3>
          <p className="max-w-md text-slate-300">{error}</p>
          <Button onClick={resetState} variant="secondary" Icon={RefreshIcon}>
            ลองอีกครั้ง
          </Button>
        </div>
      );
    }

    if (originalSrc) {
      return (
        <div className="w-full flex flex-col gap-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ImagePreview title="ต้นฉบับ" src={originalSrc} dimensions={originalDimensions} />
            <InteractiveCanvas
              zoom={zoom}
              setZoom={setZoom}
              pan={pan}
              setPan={setPan}
              canvasRef={canvasRef}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={handleDownload} Icon={DownloadIcon}>
              ดาวน์โหลดรูปภาพ
            </Button>
            <Button onClick={resetState} variant="secondary" Icon={RefreshIcon}>
              ปรับขนาดรูปภาพอื่น
            </Button>
          </div>
        </div>
      );
    }

    return <FileDropzone onFileSelect={handleFileSelect} disabled={isProcessing} />;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <main className="w-full max-w-7xl mx-auto flex flex-col items-center gap-6">
        <header className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">เครื่องมือปรับขนาดรูปภาพ</h1>
            <p className="mt-3 text-lg text-slate-400 max-w-3xl">
              ปรับขนาดรูปภาพให้พอดีกับกรอบขนาด <strong className="text-white">{TARGET_WIDTH} x {TARGET_HEIGHT} พิกเซล</strong> คุณสามารถลากเพื่อย้ายและซูมภาพก่อนบันทึกได้
            </p>
        </header>
        <div className="w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 sm:p-8 mt-4 shadow-2xl shadow-slate-900/50">
          {renderContent()}
        </div>
        <footer className="text-center text-slate-500 text-sm mt-4">
            <p>สร้างโดย BigBundit</p>
        </footer>
      </main>
    </div>
  );
};

interface ImagePreviewProps {
    title: string;
    src: string;
    dimensions: ImageDimensions | null;
}
const ImagePreview: React.FC<ImagePreviewProps> = ({ title, src, dimensions }) => (
    <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-slate-300">{title}</h3>
        <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
            <img src={src} alt={title} className="w-full h-auto rounded-md object-contain" />
        </div>
        {dimensions && (
            <div className="text-center text-sm text-slate-400 bg-slate-800 rounded-full px-3 py-1 self-center">
                {dimensions.width} x {dimensions.height} px
            </div>
        )}
    </div>
);

interface InteractiveCanvasProps {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}
const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({ zoom, setZoom, pan, setPan, canvasRef }) => {
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleInteractionStart = (clientX: number, clientY: number) => {
    isDragging.current = true;
    dragStart.current = { x: clientX, y: clientY };
    lastPan.current = pan;
  };

  const handleInteractionMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;
    setPan({
      x: lastPan.current.x + dx,
      y: lastPan.current.y + dy,
    });
  };

  const handleInteractionEnd = () => {
    isDragging.current = false;
  };
  
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomAmount = e.deltaY * -0.01;
    setZoom(prevZoom => Math.max(1, Math.min(prevZoom + zoomAmount, 10)));
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-sky-400">ปรับขนาดแล้ว</h3>
      <div 
        className="bg-slate-900 p-2 rounded-lg border border-slate-700 touch-none cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => handleInteractionStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleInteractionMove(e.clientX, e.clientY)}
        onMouseUp={handleInteractionEnd}
        onMouseLeave={handleInteractionEnd}
        onTouchStart={(e) => handleInteractionStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleInteractionMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleInteractionEnd}
      >
        <canvas
          ref={canvasRef}
          width={TARGET_WIDTH}
          height={TARGET_HEIGHT}
          className="w-full h-auto rounded-md"
          onWheel={handleWheel}
        />
      </div>
      <div className="flex items-center gap-3 px-1 text-slate-400 text-sm">
        <label htmlFor="zoom-slider" className="whitespace-nowrap">ซูม ({zoom.toFixed(1)}x)</label>
        <input
          id="zoom-slider"
          type="range"
          min="1"
          max="10"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          aria-label="Zoom slider"
        />
      </div>
      <div className="text-center text-sm text-slate-400 bg-slate-800 rounded-full px-3 py-1 self-center">
        {TARGET_WIDTH} x {TARGET_HEIGHT} px
      </div>
    </div>
  );
};

export default App;
