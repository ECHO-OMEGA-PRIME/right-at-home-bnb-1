'use client';

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'maroon' | 'white' | 'outline';
  showText?: boolean;
  className?: string;
}

/**
 * RAH Logo - Baseball Style Lettering
 * Texas A&M Aggies Colors: Maroon #500000 + White
 */
export function Logo({
  size = 'md',
  variant = 'maroon',
  showText = true,
  className = ''
}: LogoProps) {
  const sizes = {
    sm: { logo: 'text-2xl', text: 'text-xs' },
    md: { logo: 'text-4xl', text: 'text-sm' },
    lg: { logo: 'text-6xl', text: 'text-base' },
    xl: { logo: 'text-8xl', text: 'text-xl' },
  };

  const variants = {
    maroon: {
      primary: '#500000',
      secondary: '#FFFFFF',
      stroke: '#500000',
    },
    white: {
      primary: '#FFFFFF',
      secondary: '#500000',
      stroke: '#FFFFFF',
    },
    outline: {
      primary: 'transparent',
      secondary: '#500000',
      stroke: '#500000',
    },
  };

  const colors = variants[variant];
  const { logo: logoSize, text: textSize } = sizes[size];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Baseball-Style RAH Logo */}
      <div className="relative">
        <svg
          viewBox="0 0 200 80"
          className={`${logoSize === 'text-2xl' ? 'w-20 h-8' :
                       logoSize === 'text-4xl' ? 'w-32 h-12' :
                       logoSize === 'text-6xl' ? 'w-48 h-20' : 'w-64 h-24'}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background plate for visibility */}
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.3"/>
            </filter>
          </defs>

          {/* RAH Text - Baseball Script Style */}
          <text
            x="100"
            y="55"
            textAnchor="middle"
            fontFamily="'Impact', 'Arial Black', sans-serif"
            fontSize="56"
            fontWeight="900"
            fontStyle="italic"
            fill={colors.primary}
            stroke={colors.stroke}
            strokeWidth="3"
            filter="url(#shadow)"
            letterSpacing="2"
          >
            RAH
          </text>

          {/* Underline swoosh */}
          <path
            d="M 25 65 Q 100 75 175 65"
            fill="none"
            stroke={colors.stroke}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Full Name Text */}
      {showText && (
        <div className={`${textSize} font-bold tracking-wider mt-1`}
             style={{ color: colors.stroke }}>
          RIGHT AT HOME
        </div>
      )}
    </div>
  );
}

/**
 * Simple RAH Text Logo (CSS-based, no SVG)
 */
export function RAHTextLogo({
  size = 'md',
  variant = 'maroon',
  className = ''
}: Omit<LogoProps, 'showText'>) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
    xl: 'text-7xl',
  };

  const colors = {
    maroon: 'text-[#500000]',
    white: 'text-white',
    outline: 'text-transparent',
  };

  const strokeColors = {
    maroon: '',
    white: '',
    outline: 'text-stroke-maroon',
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <span
        className={`
          ${sizes[size]}
          ${colors[variant]}
          font-black italic tracking-wide
          drop-shadow-lg
        `}
        style={{
          fontFamily: "'Impact', 'Arial Black', sans-serif",
          textShadow: variant === 'maroon'
            ? '2px 2px 0 #fff, -1px -1px 0 #fff'
            : '2px 2px 0 #500000',
          WebkitTextStroke: variant === 'outline' ? '2px #500000' : undefined,
        }}
      >
        RAH
      </span>
      <span
        className="text-xs font-bold tracking-[0.2em] mt-0.5"
        style={{ color: variant === 'white' ? '#fff' : '#500000' }}
      >
        RIGHT AT HOME
      </span>
    </div>
  );
}

/**
 * Favicon/Icon version of RAH logo
 */
export function RAHIcon({
  size = 32,
  className = ''
}: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Maroon Circle Background */}
      <circle cx="32" cy="32" r="30" fill="#500000" />

      {/* White RAH Text */}
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fontFamily="'Impact', 'Arial Black', sans-serif"
        fontSize="24"
        fontWeight="900"
        fontStyle="italic"
        fill="#FFFFFF"
        letterSpacing="1"
      >
        RAH
      </text>
    </svg>
  );
}

export default Logo;
