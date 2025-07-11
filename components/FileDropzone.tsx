import React, { useState, useCallback } from 'react';
import { UploadIcon, PhotoIcon } from './icons';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        onFileSelect(file);
    }
  }, [onFileSelect, disabled]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const baseBorder = 'border-2 border-dashed rounded-xl transition-colors duration-300';
  const borderColor = isDragging ? 'border-sky-500 bg-sky-900/20' : 'border-slate-600 hover:border-sky-600';

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-8 sm:p-12 text-center cursor-pointer ${baseBorder} ${borderColor}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-4 text-slate-400">
        <PhotoIcon className="w-16 h-16" />
        <p className="text-lg font-semibold text-slate-300">
          <span className="text-sky-500">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวาง
        </p>
        <p className="text-sm">รองรับไฟล์ PNG, JPG, WEBP</p>
      </div>
    </div>
  );
};

export default FileDropzone;
