import React from 'react';
import logoPath from '../../assets/doorpro-logo.png';

interface LogoProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  type?: 'png' | 'svg';
}

export const DoorProLogo: React.FC<LogoProps> = ({ 
  className = "", 
  size = 'medium',
  type = 'png'
}) => {
  let sizeClass = "h-8 w-auto";
  
  if (size === 'small') {
    sizeClass = "h-6 w-auto";
  } else if (size === 'large') {
    sizeClass = "h-20 w-auto";
  }
  
  // Import path to use with Vite bundling
  const importedLogoPath = logoPath;
  
  // Public path for direct browser access
  const publicLogoPath = type === 'svg' 
    ? `/images/doorpro-logo${size === 'large' ? '-large' : ''}.svg`
    : `/images/doorpro-logo${size === 'large' ? '-large' : ''}.png`;
  
  return (
    <img 
      src={importedLogoPath} 
      alt="DoorPro CRM Logo" 
      className={`${sizeClass} ${className}`}
      onError={(e) => {
        // If the imported path fails, fall back to the public path
        const target = e.target as HTMLImageElement;
        target.onerror = null; // Prevent infinite fallback loop
        target.src = publicLogoPath;
      }}
    />
  );
};