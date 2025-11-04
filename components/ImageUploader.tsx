import React, { useState, useCallback } from 'react';
import { CloseIcon } from './icons/CloseIcon';

interface ImageUploaderProps {
  onImagesUpload: (files: File[]) => void;
  onImageRemove: (index: number) => void;
  images: { url: string }[];
  maxImages: number;
  isLoading?: boolean;
}

const UploadIcon: React.FC = () => (
    <svg className="w-10 h-10 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
    </svg>
);


export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesUpload, onImageRemove, images, maxImages, isLoading = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [inputId] = useState(() => `dropzone-file-${Math.random().toString(36).substring(2, 9)}`);
  const isSingleMode = maxImages === 1;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onImagesUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      onImagesUpload(Array.from(e.dataTransfer.files));
    }
  }, [onImagesUpload]);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col justify-start items-center space-y-4">
      <div className={isSingleMode ? "flex justify-center" : "w-full"}>
        {images.length > 0 ? (
          <div className={isSingleMode ? "" : "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3"}>
            {images.map((image, index) => (
              <div key={index} className={`relative aspect-square group animate-scale-in-center ${isSingleMode ? 'w-48' : ''}`}>
                <img src={image.url} alt={`Preview ${index + 1}`} className={`w-full h-full object-cover rounded-lg shadow-md transition-opacity ${isLoading ? 'opacity-30' : ''}`} />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
                <button 
                  onClick={() => onImageRemove(index)}
                  className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-1 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
                  aria-label="Eliminar imagen"
                  disabled={isLoading}
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
                 {isLoading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <svg className="animate-spin h-6 w-6 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          !isSingleMode && (
            <div className="text-center text-gray-500 py-4">
              <p>Las imágenes que subas aparecerán aquí.</p>
            </div>
          )
        )}
      </div>

      {images.length < maxImages && (
        <label
          htmlFor={inputId}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isSingleMode ? 'w-48 h-48' : 'w-full min-h-[10rem]'} ${isDragging ? 'border-teal-500 bg-teal-500/10' : 'border-gray-600/50 bg-gray-900/50 hover:bg-white/5 hover:border-gray-500'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            <UploadIcon />
            <p className="mb-2 text-sm text-gray-400">
              <span className="font-semibold text-teal-400">Haz clic para subir</span> o arrastra
            </p>
            <p className="text-xs text-gray-500">
              {maxImages - images.length} restante(s) | PNG, JPG, WEBP
            </p>
          </div>
          <input id={inputId} type="file" className="hidden" multiple={!isSingleMode} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" />
        </label>
      )}
    </div>
  );
};