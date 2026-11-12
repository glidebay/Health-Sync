'use client';

import React from 'react';

export interface MacbookProProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  src?: string;
  children?: React.ReactNode;
}

const KEY_ROWS: { label: string; flex?: number }[][] = [
  [
    { label: 'esc', flex: 1.3 },
    { label: 'F1' },
    { label: 'F2' },
    { label: 'F3' },
    { label: 'F4' },
    { label: 'F5' },
    { label: 'F6' },
    { label: 'F7' },
    { label: 'F8' },
    { label: 'F9' },
    { label: 'F10' },
    { label: 'F11' },
    { label: 'F12' },
    { label: '⏻', flex: 1.1 },
  ],
  [
    { label: '`' },
    { label: '1' },
    { label: '2' },
    { label: '3' },
    { label: '4' },
    { label: '5' },
    { label: '6' },
    { label: '7' },
    { label: '8' },
    { label: '9' },
    { label: '0' },
    { label: '-' },
    { label: '=' },
    { label: 'delete', flex: 1.6 },
  ],
  [
    { label: 'tab', flex: 1.5 },
    { label: 'Q' },
    { label: 'W' },
    { label: 'E' },
    { label: 'R' },
    { label: 'T' },
    { label: 'Y' },
    { label: 'U' },
    { label: 'I' },
    { label: 'O' },
    { label: 'P' },
    { label: '[' },
    { label: ']' },
    { label: '\\', flex: 1.1 },
  ],
  [
    { label: 'caps', flex: 1.8 },
    { label: 'A' },
    { label: 'S' },
    { label: 'D' },
    { label: 'F' },
    { label: 'G' },
    { label: 'H' },
    { label: 'J' },
    { label: 'K' },
    { label: 'L' },
    { label: ';' },
    { label: "'" },
    { label: 'return', flex: 1.8 },
  ],
  [
    { label: 'shift', flex: 2.3 },
    { label: 'Z' },
    { label: 'X' },
    { label: 'C' },
    { label: 'V' },
    { label: 'B' },
    { label: 'N' },
    { label: 'M' },
    { label: ',' },
    { label: '.' },
    { label: '/' },
    { label: 'shift', flex: 2.3 },
  ],
  [
    { label: 'fn', flex: 1 },
    { label: 'ctrl', flex: 1 },
    { label: 'opt', flex: 1 },
    { label: 'cmd', flex: 1.3 },
    { label: '', flex: 5.2 },
    { label: 'cmd', flex: 1.3 },
    { label: 'opt', flex: 1 },
    { label: '◀', flex: 0.9 },
    { label: '▲▼', flex: 0.9 },
    { label: '▶', flex: 0.9 },
  ],
];

export function MacbookPro({
  width = '100%',
  src,
  children,
  className = '',
  style,
  ...props
}: MacbookProProps) {
  return (
    <div
      className={`relative select-none ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        perspective: '1400px',
        perspectiveOrigin: '48% 42%',
        ...style,
      }}
      {...props}
    >
      {/* 3D Tilted Assembly (Lid + Hinge + Base/Keyboard/Trackpad) */}
      <div
        className="relative w-full"
        style={{
          marginBottom: '31%',
          transformStyle: 'preserve-3d',
          transform: 'rotateY(16deg) rotateX(-2deg) rotateZ(-3deg)',
          transformOrigin: 'center center',
        }}
      >
        {/* Ground Contact Shadow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[2%] right-[2%] -bottom-[42%] h-[34%] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.16) 54%, transparent 80%)',
            filter: 'blur(12px)',
            transform: 'translateZ(-40px)',
          }}
        />

        {/* ============================================================ */}
        {/* UPPER DISPLAY LID                                            */}
        {/* ============================================================ */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: '16 / 10.3',
            borderRadius: '14px 14px 4px 4px',
            background:
              'linear-gradient(145deg, #d7dae0 0%, #9fa3ad 28%, #6d717c 65%, #b8bcc4 100%)',
            padding: '2px',
            boxShadow:
              '0 14px 36px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.65)',
            transformOrigin: 'bottom center',
            transform: 'rotateX(-4deg)',
            transformStyle: 'preserve-3d',
            zIndex: 20,
          }}
        >
          {/* Black Display Bezel */}
          <div
            className="relative w-full h-full flex flex-col"
            style={{
              background: 'linear-gradient(180deg, #0b0c10 0%, #050507 100%)',
              borderRadius: '12px 12px 3px 3px',
              padding: '2.2% 2.2% 3.4% 2.2%',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            {/* Camera Notch */}
            <div
              aria-hidden="true"
              className="absolute top-[2.1%] left-1/2 -translate-x-1/2 z-40 flex items-center justify-center gap-1.5"
              style={{
                width: '12%',
                height: '4.5%',
                minHeight: '8px',
                background: '#050507',
                borderRadius: '0 0 5px 5px',
              }}
            >
              <span
                className="rounded-full"
                style={{
                  width: '4px',
                  height: '4px',
                  background: '#0e1f3d',
                  boxShadow: 'inset 0 0 1px #38bdf8',
                }}
              />
              <span
                className="rounded-full"
                style={{
                  width: '2px',
                  height: '2px',
                  background: '#10b981',
                  opacity: 0.75,
                }}
              />
            </div>

            {/* Active Screen Display */}
            <div
              className="relative w-full h-full overflow-hidden bg-black"
              style={{
                borderRadius: '5px',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
              }}
            >
              {children ? (
                children
              ) : src ? (
                <img
                  src={src}
                  alt="MacBook Pro display"
                  className="w-full h-full object-cover block"
                />
              ) : null}
            </div>

            {/* Bottom Chin "MacBook Pro" subtle strip */}
            <div
              aria-hidden="true"
              className="absolute bottom-[0.6%] inset-x-0 text-center text-[7px] font-medium tracking-[0.2em] text-white/25 pointer-events-none"
            >
              MacBook Pro
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* LOWER UNIBODY BASE (HINGE + KEYBOARD + TRACKPAD + FRONT LIP) */}
        {/* ============================================================ */}
        <div
          className="absolute left-[-1.5%] w-[103%]"
          style={{
            top: 'calc(100% - 2px)',
            aspectRatio: '16 / 10.6',
            transformOrigin: 'top center',
            transform: 'rotateX(64deg)',
            transformStyle: 'preserve-3d',
            zIndex: 10,
          }}
        >
          {/* Aluminum Top Deck */}
          <div
            className="relative w-full h-full flex flex-col items-center justify-between"
            style={{
              background:
                'linear-gradient(180deg, #b8bcc6 0%, #d4d7e0 14%, #c7cbd4 62%, #aeb3be 100%)',
              borderRadius: '4px 4px 18px 18px',
              padding: '2.5% 4% 4.5% 4%',
              boxShadow:
                'inset 0 2px 3px rgba(255,255,255,0.75), inset 0 -2px 5px rgba(0,0,0,0.22), 0 18px 34px rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.55)',
            }}
          >
            {/* Dark Hinge Bar */}
            <div
              aria-hidden="true"
              style={{
                width: '76%',
                height: '3.2%',
                marginTop: '-2.5%',
                background: 'linear-gradient(180deg, #101216 0%, #262930 100%)',
                borderRadius: '0 0 4px 4px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            />

            {/* Keyboard Section with Speaker Grilles */}
            <div className="w-full flex items-stretch justify-between gap-[2.2%]" style={{ height: '54%' }}>
              {/* Left Speaker Grille */}
              <div
                aria-hidden="true"
                className="h-full rounded-[3px] opacity-35"
                style={{
                  width: '4.8%',
                  backgroundImage:
                    'radial-gradient(circle, #1f2937 0.7px, transparent 0.8px)',
                  backgroundSize: '3.5px 3.5px',
                }}
              />

              {/* Recessed Black Keyboard Well */}
              <div
                aria-hidden="true"
                className="flex-1 h-full flex flex-col justify-between"
                style={{
                  background: '#0d0f13',
                  borderRadius: '6px',
                  padding: '1.6% 1.6%',
                  gap: '2.4%',
                  boxShadow:
                    'inset 0 2px 5px rgba(0,0,0,0.95), 0 1px 0 rgba(255,255,255,0.4)',
                }}
              >
                {KEY_ROWS.map((row, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="flex w-full"
                    style={{
                      height: rowIdx === 0 ? '11.5%' : '15.8%',
                      gap: '1.1%',
                    }}
                  >
                    {row.map((key, keyIdx) => (
                      <div
                        key={keyIdx}
                        className="flex items-center justify-center text-white/75 font-medium"
                        style={{
                          flex: key.flex ?? 1,
                          background:
                            'linear-gradient(180deg, #252830 0%, #15171c 100%)',
                          borderRadius: '2.5px',
                          fontSize: 'clamp(4px, 0.45vw, 6.5px)',
                          lineHeight: 1,
                          boxShadow:
                            '0 1px 1.5px rgba(0,0,0,0.9), inset 0 0.5px 0 rgba(255,255,255,0.18)',
                        }}
                      >
                        {key.label}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Right Speaker Grille */}
              <div
                aria-hidden="true"
                className="h-full rounded-[3px] opacity-35"
                style={{
                  width: '4.8%',
                  backgroundImage:
                    'radial-gradient(circle, #1f2937 0.7px, transparent 0.8px)',
                  backgroundSize: '3.5px 3.5px',
                }}
              />
            </div>

            {/* Force Touch Glass Trackpad */}
            <div
              aria-hidden="true"
              style={{
                width: '38%',
                height: '33%',
                marginTop: '1.5%',
                background:
                  'linear-gradient(145deg, #c2c6d1 0%, #b4b9c5 55%, #a7acb9 100%)',
                borderRadius: '7px',
                boxShadow:
                  'inset 0 0 0 1px rgba(90,96,110,0.28), inset 0 1px 2px rgba(255,255,255,0.45)',
              }}
            />

            {/* Front Thumb Scoop */}
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              style={{
                width: '16%',
                height: '3.5%',
                background:
                  'linear-gradient(180deg, #8b909c 0%, #6d727e 100%)',
                borderRadius: '4px 4px 0 0',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
              }}
            />
          </div>

          {/* 3D Front Aluminum Chassis Thickness Edge */}
          <div
            aria-hidden="true"
            className="w-full"
            style={{
              height: '12px',
              marginTop: '-1px',
              background:
                'linear-gradient(180deg, #9da2ae 0%, #7d828e 65%, #5c606b 100%)',
              borderRadius: '0 0 10px 10px',
              transformOrigin: 'top center',
              transform: 'rotateX(-88deg)',
              boxShadow: '0 6px 14px rgba(0,0,0,0.45)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MacbookPro;
