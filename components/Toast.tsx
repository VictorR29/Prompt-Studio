
import React, { useEffect, useState } from 'react';
import { CheckIcon } from './icons/CheckIcon';
import { CloseIcon } from './icons/CloseIcon';
import { ExclamationIcon } from './icons/ExclamationIcon';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}

// A simple error icon for the toast
const ErrorIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);


export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 5000); // Auto close after 5 seconds (slightly longer for warnings)

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Wait for animation to finish
  };

  const getStyles = () => {
      switch (type) {
          case 'success':
              return 'bg-teal-600/90 text-white';
          case 'warning':
              return 'bg-amber-500/90 text-white'; // Yellow/Amber for warning
          case 'error':
          default:
              return 'bg-red-600/90 text-white';
      }
  };

  const getIcon = () => {
      switch (type) {
          case 'success':
              return <CheckIcon className="w-6 h-6" />;
          case 'warning':
              return <ExclamationIcon className="w-6 h-6" />;
          case 'error':
          default:
              return <ErrorIcon className="w-6 h-6" />;
      }
  };


  const containerClasses = `
    relative w-full max-w-sm p-4 pr-12 rounded-xl shadow-lg flex items-center space-x-3
    transition-all duration-300 ease-in-out
    ${getStyles()}
    ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
    animate-slide-in-right pointer-events-auto
  `;

  return (
    <>
      <div
        className={containerClasses}
        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        role="alert"
      >
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="flex-grow text-sm font-semibold">
          {message}
        </div>
        <button
          onClick={handleClose}
          className="absolute top-1/2 right-3 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Cerrar notificación"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
       <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
        }
      `}</style>
    </>
  );
};
