import React, { ReactNode } from 'react';
import { Mail, Facebook, Link as LinkIcon } from 'lucide-react';

interface AppFooterProps {
  className?: string;
  children?: ReactNode;
}

export function AppFooter({ className = '', children }: AppFooterProps) {
  return (
    <footer className={`bg-gray-900 border-t-4 border-yellow-500 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm">
          {/* Email */}
          <a 
            href="mailto:ulis@ust-legazpi.edu.ph" 
            className="flex items-center space-x-2 text-gray-300 hover:text-yellow-500 transition-colors"
          >
            <Mail className="w-4 h-4" />
            <span>ulis@ust-legazpi.edu.ph</span>
          </a>
          <span className="text-gray-600">|</span>
          
          {/* Facebook - UST-L ULIS */}
          <a 
            href="https://facebook.com/USTL-ULIS" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-gray-300 hover:text-yellow-500 transition-colors"
          >
            <Facebook className="w-4 h-4" />
            <span>UST-L - ULIS</span>
          </a>
          <span className="text-gray-600">|</span>
          
          {/* Website Link */}
          <a 
            href="https://library.ust-legazpi.edu.ph/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-gray-300 hover:text-yellow-500 transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            <span>library.ust-legazpi.edu.ph</span>
          </a>
        </div>
        {children && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {children}
          </div>
        )}
      </div>
    </footer>
  );
}
