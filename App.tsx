
import React, { useState, useCallback, useEffect } from 'react';
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
    
    // If context can't be created or image is too small, return black.
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
            // Top edge pixel
            let iTop = (0 * width + x) * 4;
            r += imageData[iTop];
            g += imageData[iTop + 1];
            b += imageData[iTop + 2];
            
            // Bottom edge pixel
            let iBottom = ((height - 1) * width + x) * 4;
            r += imageData[iBottom];
            g += imageData[iBottom + 1];
            b += imageData[iBottom + 2];
        }
        count += width * 2;

        // Left and right edges (excluding corners already counted)
        for (let y = 1; y < height - 1; y++) {
            // Left edge pixel
            let iLeft = (y * width + 0) * 4;
            r += imageData[iLeft];
            g += imageData[iLeft + 1];
            b += imageData[iLeft + 2];

            // Right edge pixel
            let iRight = (y * width + (width - 1)) * 4;
            r += imageData[iRight];
            g += imageData[iRight + 1];
            b += imageData[iRight + 2];
        }
        count += (height - 2) * 2;
        
        if (count === 0) { // Handles 1x1 image case
             if(imageData.length >= 3) return `rgb(${imageData[0]}, ${imageData[1]}, ${imageData[2]})`;
             return 'rgb(0, 0, 0)';
        }

        const avgR = Math.floor(r / count);
        const avgG = Math.floor(g / count);
        const avgB = Math.floor(b / count);
        
        return `rgb(${avgR}, ${avgG}, ${avgB})`;

    } catch (e) {
        console.error("Error getting image data for border color:", e);
        return 'rgb(0, 0, 0)'; // Fallback to black on error
    }
};


const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [resizedSrc, setResizedSrc] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<ImageDimensions | null>(null);
  const [resizedDimensions, setResizedDimensions] = useState<ImageDimensions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const resetState = useCallback(() => {
    setImageFile(null);
    setOriginalSrc(null);
    setResizedSrc(null);
    setOriginalDimensions(null);
    setResizedDimensions(null);
    setError(null);
    setIsProcessing(false);
    if (originalSrc) {
      URL.revokeObjectURL(originalSrc);
    }
  }, [originalSrc]);

  const processImage = useCallback((file: File) => {
    setIsProcessing(true);
    setError(null);
    setResizedSrc(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target?.result as string;
      setOriginalSrc(imgSrc);
      
      const img = new Image();
      img.onload = () => {
        setOriginalDimensions({ width: img.width, height: img.height });
        setResizedDimensions({ width: TARGET_WIDTH, height: TARGET_HEIGHT });

        const canvas = document.createElement('canvas');
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setError("ไม่สามารถสร้าง Canvas context ได้");
            setIsProcessing(false);
            return;
        }
        
        const backgroundColor = getAverageBorderColor(img);

        // Fill background with the determined average color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

        // Calculate dimensions to fit image within canvas while maintaining aspect ratio
        const scaleFactor = Math.min(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height);
        const newWidth = img.width * scaleFactor;
        const newHeight = img.height * scaleFactor;

        // Calculate position to center the image
        const dx = (TARGET_WIDTH - newWidth) / 2;
        const dy = (TARGET_HEIGHT - newHeight) / 2;

        // Draw the resized image onto the canvas
        ctx.drawImage(img, dx, dy, newWidth, newHeight);
        
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setResizedSrc(resizedDataUrl);
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

    reader.readAsDataURL(file);
  }, []);
  
  useEffect(() => {
    if (imageFile) {
      processImage(imageFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);


  const handleFileSelect = (file: File) => {
    resetState();
    setImageFile(file);
  };

  const handleDownload = () => {
    if (!resizedSrc || !imageFile) return;
    const link = document.createElement('a');
    link.href = resizedSrc;
    const nameWithoutExtension = imageFile.name.split('.').slice(0, -1).join('.');
    link.download = `${nameWithoutExtension}_${TARGET_WIDTH}x${TARGET_HEIGHT}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-center">
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

    if (resizedSrc && originalSrc) {
      return (
        <div className="w-full flex flex-col gap-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ImagePreview title="ต้นฉบับ" src={originalSrc} dimensions={originalDimensions} />
            <ImagePreview title="ปรับขนาดแล้ว" src={resizedSrc} dimensions={resizedDimensions} isSuccess={true} />
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
            <p className="mt-3 text-lg text-slate-400 max-w-2xl">
              ปรับขนาดรูปภาพให้พอดีกับกรอบขนาด <strong className="text-white">{TARGET_WIDTH} x {TARGET_HEIGHT} พิกเซล</strong> โดยคงสัดส่วนเดิมและเพิ่มพื้นที่ว่างโดยใช้สีเฉลี่ยจากขอบของรูปภาพ
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
    isSuccess?: boolean;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ title, src, dimensions, isSuccess = false }) => (
    <div className="flex flex-col gap-3">
        <h3 className={`text-lg font-semibold ${isSuccess ? 'text-sky-400' : 'text-slate-300'}`}>{title}</h3>
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


export default App;