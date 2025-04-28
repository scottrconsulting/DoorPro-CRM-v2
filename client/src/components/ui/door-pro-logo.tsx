import React from 'react';
import logoPath from '../../assets/doorpro-logo.png';

interface LogoProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export const DoorProLogo: React.FC<LogoProps> = ({ 
  className = "", 
  size = 'medium' 
}) => {
  let sizeClass = "h-8 w-8";
  
  if (size === 'small') {
    sizeClass = "h-6 w-6";
  } else if (size === 'large') {
    sizeClass = "h-20 w-20";
  }
  
  return (
    <img 
      src={logoPath} 
      alt="DoorPro CRM Logo" 
      className={`${sizeClass} ${className}`}
    />
  );
};