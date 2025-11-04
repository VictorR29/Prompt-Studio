import React from 'react';

export const LightbulbIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    {...props}
    >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-11.36a6.01 6.01 0 00-3 0m1.5 11.36v.003M12 18h.01M12 3a6.01 6.01 0 00-1.5 11.36m0 0a6.01 6.01 0 003 0M12 3v1.172a6.01 6.01 0 011.5 11.36m-3 0a6.01 6.01 0 01-1.5-11.36M12 3a6.01 6.01 0 011.5 11.36m0 0a6.01 6.01 0 01-3 0m0 0a6.01 6.01 0 01-1.5-11.36" />
  </svg>
);
