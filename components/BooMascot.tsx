'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useCelebration, CelebrationType } from '@/lib/celebration-context';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  emoji?: string;
}

const CELEBRATION_COLORS: Record<CelebrationType, string[]> = {
  shield: ['#ef4444', '#f97316', '#fbbf24'],
  unshield: ['#22c55e', '#10b981', '#14b8a6'],
  swap: ['#8b5cf6', '#a855f7', '#d946ef'],
  fund: ['#ef4444', '#f97316', '#fbbf24', '#22c55e'],
  success: ['#22c55e', '#10b981', '#fbbf24'],
  epic: ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#8b5cf6', '#d946ef'],
};

const CELEBRATION_EMOJIS: Record<CelebrationType, string[]> = {
  shield: ['🛡️', '🔐', '✨'],
  unshield: ['💰', '✨', '🎉'],
  swap: ['🔄', '✨', '💫'],
  fund: ['👻', '💸', '🎯', '✨', '🔥'],
  success: ['✅', '🎉', '✨'],
  epic: ['👻', '🔥', '💸', '🎯', '✨', '🚀', '💎'],
};

export default function BooMascot({ size = 'large' }: { size?: 'small' | 'medium' | 'large' }) {
  const { isAnimating, celebrationType, intensity } = useCelebration();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [eyeGlow, setEyeGlow] = useState(false);
  const [shake, setShake] = useState(false);
  const [float, setFloat] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const particleIdRef = useRef(0);

  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-40 h-40',
  };

  const imageSizes = {
    small: 64,
    medium: 96,
    large: 160,
  };

  // Handle celebration animations
  useEffect(() => {
    if (!isAnimating || !celebrationType) {
      setShake(false);
      return;
    }

    // Start shake animation
    setShake(true);
    setEyeGlow(true);

    // Create particles
    const colors = CELEBRATION_COLORS[celebrationType];
    const emojis = CELEBRATION_EMOJIS[celebrationType];
    const particleCount = intensity * 5;

    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 3 + Math.random() * 5 * (intensity / 5);
      const useEmoji = Math.random() > 0.6;

      newParticles.push({
        id: particleIdRef.current++,
        x: 50,
        y: 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: useEmoji ? 20 : 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        emoji: useEmoji ? emojis[Math.floor(Math.random() * emojis.length)] : undefined,
      });
    }

    setParticles(prev => [...prev, ...newParticles]);

    // Cleanup
    return () => {
      setShake(false);
      setTimeout(() => setEyeGlow(false), 500);
    };
  }, [isAnimating, celebrationType, intensity]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev => {
        const updated = prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15, // gravity
          life: p.life - 0.02,
        })).filter(p => p.life > 0);

        return updated;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [particles.length > 0]);

  return (
    <div
      ref={containerRef}
      className={`relative ${sizeClasses[size]} select-none`}
    >
      {/* Particle effects */}
      <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 100 }}>
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute transition-opacity"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              transform: 'translate(-50%, -50%)',
              opacity: particle.life,
            }}
          >
            {particle.emoji ? (
              <span style={{ fontSize: particle.size }}>{particle.emoji}</span>
            ) : (
              <div
                className="rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Glow ring when animating */}
      {isAnimating && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: `radial-gradient(circle, ${CELEBRATION_COLORS[celebrationType || 'success'][0]}40 0%, transparent 70%)`,
            animationDuration: '1s',
          }}
        />
      )}

      {/* Boo container with animations */}
      <div
        className={`
          relative transition-all duration-300
          ${float && !shake ? 'animate-float' : ''}
          ${shake ? 'animate-shake' : ''}
          ${eyeGlow ? 'boo-eyes-intense' : 'boo-eyes-glow'}
        `}
      >
        {/* Outer glow */}
        <div
          className={`
            absolute inset-0 rounded-full blur-xl transition-all duration-500
            ${eyeGlow ? 'opacity-60' : 'opacity-20'}
          `}
          style={{
            background: eyeGlow
              ? 'radial-gradient(circle, #ef4444 0%, #ff6b6b 50%, transparent 70%)'
              : 'radial-gradient(circle, #ef4444 0%, transparent 70%)',
          }}
        />

        {/* Boo image */}
        <Image
          src="/boo-privacy.png"
          alt="Boo"
          width={imageSizes[size]}
          height={imageSizes[size]}
          className={`
            relative z-10 drop-shadow-2xl transition-transform duration-200
            ${shake ? 'scale-110' : ''}
          `}
          style={{
            filter: eyeGlow
              ? 'drop-shadow(0 0 20px #ef4444) drop-shadow(0 0 40px #ff6b6b)'
              : 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.5))',
          }}
          priority
        />
      </div>

      {/* Success message */}
      {isAnimating && celebrationType === 'fund' && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap animate-bounce-in">
          <span className="text-sm font-bold text-green-400 drop-shadow-glow">
            Privately Funded!
          </span>
        </div>
      )}
    </div>
  );
}
