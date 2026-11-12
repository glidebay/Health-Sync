'use client';

import React from 'react';
import type { SVGProps } from 'react';

export interface IpadProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  src?: string;
  children?: React.ReactNode;
  svgProps?: SVGProps<SVGSVGElement>;
}

export function Ipad({
  width = 520,
  height = 400,
  src,
  children,
  className = '',
  style,
  svgProps,
  ...props
}: IpadProps) {
  return (
    <div
      className={`relative select-none ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        aspectRatio: '520 / 400',
        ...style,
      }}
      {...props}
    >
      {/* iPad Chassis SVG */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 520 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-full"
        {...svgProps}
      >
        {/* Outer Aluminum Frame & Buttons */}
        <path
          fill="#aaabac"
          d="M479.04,14.14H88.14v-.59c0-.16-.13-.3-.3-.3h-16.7c-.16,0-.3.13-.3.3v.59h-3.46v-.59c0-.16-.13-.3-.3-.3h-16.7c-.16,0-.3.13-.3.3v.59h-9.13c-13.4,0-24.27,10.78-24.45,24.14h-.48c-.16,0-.3.13-.3.3v20.07c0,.16.13.3.3.3h.47v303.38c0,13.51,10.95,24.45,24.45,24.45h438.08c13.51,0,24.45-10.95,24.45-24.45V38.6c0-13.51-10.95-24.45-24.45-24.45Z"
        />

        {/* Dark Screen Bezel */}
        <rect
          fill="#000"
          x="18.58"
          y="15.94"
          width="482.84"
          height="368.91"
          rx="23.29"
          ry="23.29"
        />

        {/* Screen Background Rectangle */}
        <rect
          fill="currentColor"
          x="31.37"
          y="28.47"
          width="457.25"
          height="342.87"
          rx="9.61"
          ry="9.61"
        />

        {/* Camera and Sensors */}
        <circle fill="#0a1054" cx="245.1" cy="22.23" r="2.44" />
        <circle fill="#333" cx="274.98" cy="22.23" r=".88" />

        {/* Image Source Fallback */}
        {src && !children && (
          <image
            href={src}
            x="31.37"
            y="28.47"
            width="457.25"
            height="342.87"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#ipadRoundedCorners)"
          />
        )}

        <defs>
          <clipPath id="ipadRoundedCorners">
            <rect
              fill="#ffffff"
              x="31.37"
              y="28.47"
              width="457.25"
              height="342.87"
              rx="9.61"
              ry="9.61"
            />
          </clipPath>
        </defs>
      </svg>

      {/* Screen Inset Area for Interactive Children: (31.37/520 = 6.03%, 28.47/400 = 7.12%) */}
      <div
        className="absolute overflow-hidden rounded-[10px] bg-white text-slate-800"
        style={{
          left: '6.0327%',
          top: '7.1175%',
          width: '87.9327%',
          height: '85.7175%',
        }}
      >
        {children ? (
          children
        ) : src ? (
          <img
            src={src}
            alt="iPad Screen Content"
            className="w-full h-full object-cover block"
          />
        ) : null}
      </div>
    </div>
  );
}

export default Ipad;

