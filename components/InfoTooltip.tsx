'use client';

import { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
}

export default function InfoTooltip({ content, children }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      setPosition(spaceAbove > spaceBelow ? 'top' : 'bottom');
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isOpen]);

  return (
    <span className="relative inline-flex items-center">
      {children}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="ml-1 info-icon"
        type="button"
      >
        i
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className={`
            absolute z-50 min-w-[200px] max-w-[280px] px-3 py-2
            bg-boo-card border border-boo-border rounded-lg shadow-xl
            text-xs text-boo-dim animate-scale-in
            ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            left-1/2 -translate-x-1/2
          `}
        >
          {/* Arrow */}
          <div
            className={`
              absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45
              bg-boo-card border-boo-border
              ${position === 'top'
                ? 'bottom-0 translate-y-1/2 border-r border-b'
                : 'top-0 -translate-y-1/2 border-l border-t'
              }
            `}
          />
          <div className="relative">{content}</div>
        </div>
      )}
    </span>
  );
}
