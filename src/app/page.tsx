'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export default function ComingSoon() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black flex items-center justify-center">
      {/* Subtle glow behind logo */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(255,45,45,0.3) 0%, transparent 70%)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <Image
            src="/logo.png"
            alt="Boo Privacy"
            width={140}
            height={140}
            className="drop-shadow-2xl"
            priority
          />
        </motion.div>

        {/* Brand name */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-8 text-3xl sm:text-4xl font-bold text-white tracking-tight"
        >
          Boo Privacy
        </motion.h1>

        {/* Mysterious headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-4 text-lg sm:text-xl text-gray-400 max-w-md"
        >
          Something is watching over you.
        </motion.p>

        {/* Coming Soon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-10"
        >
          <span className="text-sm text-gray-600 uppercase tracking-widest">
            Coming Soon
          </span>
        </motion.div>
      </div>
    </main>
  )
}
