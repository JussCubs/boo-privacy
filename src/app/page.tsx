'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

// Floating particle component
function Particle({ delay }: { delay: number }) {
  const randomX = Math.random() * 100
  const randomDuration = 15 + Math.random() * 20
  const randomSize = 2 + Math.random() * 4

  return (
    <motion.div
      className="absolute rounded-full bg-boo-red/20"
      style={{
        left: `${randomX}%`,
        bottom: '-10px',
        width: randomSize,
        height: randomSize,
      }}
      initial={{ opacity: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [0, -window?.innerHeight || -800],
      }}
      transition={{
        duration: randomDuration,
        repeat: Infinity,
        delay,
        ease: 'linear',
      }}
    />
  )
}

// Glowing orb background effect
function GlowingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,45,45,0.15) 0%, transparent 70%)',
          top: '10%',
          left: '20%',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,45,45,0.1) 0%, transparent 70%)',
          bottom: '-20%',
          right: '-10%',
        }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}

// Email signup component
function EmailSignup() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setIsSubmitted(true)
      // Here you would typically send to your API
      console.log('Email submitted:', email)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.8 }}
      className="w-full max-w-md mx-auto"
    >
      <AnimatePresence mode="wait">
        {!isSubmitted ? (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            className="relative"
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div
              className="relative p-[2px] rounded-full overflow-hidden"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #ff2d2d, #ff6b6b, #ff2d2d)',
                  backgroundSize: '200% auto',
                }}
                animate={{
                  backgroundPosition: isHovered ? ['0% 50%', '200% 50%'] : '0% 50%',
                }}
                transition={{
                  duration: 1,
                  repeat: isHovered ? Infinity : 0,
                  ease: 'linear',
                }}
              />
              <div className="relative flex items-center bg-boo-black rounded-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email for early access"
                  className="flex-1 bg-transparent px-6 py-4 text-white placeholder-gray-500 focus:outline-none text-sm sm:text-base"
                  required
                />
                <button
                  type="submit"
                  className="m-1 px-6 py-3 bg-boo-red hover:bg-boo-red-glow text-white font-semibold rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-boo-red/30 text-sm sm:text-base whitespace-nowrap"
                >
                  Notify Me
                </button>
              </div>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200 }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-boo-gray/50 rounded-full border border-boo-red/30"
            >
              <svg className="w-5 h-5 text-boo-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">You&apos;re on the list! We&apos;ll be in touch.</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Feature card component
function FeatureCard({ icon, title, description, delay }: { icon: string; title: string; description: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-boo-red/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative p-6 bg-boo-gray/30 backdrop-blur-sm border border-white/5 rounded-2xl hover:border-boo-red/30 transition-all duration-300">
        <div className="text-3xl mb-4">{icon}</div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

export default function ComingSoon() {
  const [mounted, setMounted] = useState(false)
  const [particles, setParticles] = useState<number[]>([])

  useEffect(() => {
    setMounted(true)
    setParticles(Array.from({ length: 20 }, (_, i) => i))
  }, [])

  // Generate particles only on client
  const renderParticles = useCallback(() => {
    if (!mounted) return null
    return particles.map((i) => <Particle key={i} delay={i * 0.5} />)
  }, [mounted, particles])

  return (
    <main className="relative min-h-screen overflow-hidden bg-boo-black">
      {/* Background effects */}
      <div className="noise-overlay" />
      <div className="vignette" />
      <GlowingOrbs />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {renderParticles()}
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-16">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative mb-8"
        >
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <div className="relative">
              {/* Glow effect behind logo */}
              <motion.div
                className="absolute inset-0 blur-3xl"
                style={{
                  background: 'radial-gradient(circle, rgba(255,45,45,0.4) 0%, transparent 70%)',
                }}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <Image
                src="/logo.png"
                alt="Boo Privacy"
                width={180}
                height={180}
                className="relative z-10 drop-shadow-2xl"
                priority
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Coming Soon Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-boo-red/10 border border-boo-red/30 rounded-full text-sm font-medium text-boo-red">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-boo-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-boo-red"></span>
            </span>
            Coming Soon
          </span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold text-center mb-6 tracking-tight"
        >
          <span className="text-white">Your Digital</span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-boo-red to-red-400 glow-text">
            Guardian
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="text-lg sm:text-xl text-gray-400 text-center max-w-2xl mb-10 px-4 leading-relaxed"
        >
          We&apos;re building the next generation of privacy-first tools.
          Protect your digital identity, secure your data, and keep prying eyes away.
        </motion.p>

        {/* Email signup */}
        <EmailSignup />

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-4xl mx-auto px-4"
        >
          <FeatureCard
            icon="🔒"
            title="End-to-End Encryption"
            description="Military-grade encryption for all your sensitive data. What's yours stays yours."
            delay={1.7}
          />
          <FeatureCard
            icon="👻"
            title="Anonymous Browsing"
            description="Leave no trace. Browse the web without being tracked or profiled."
            delay={1.9}
          />
          <FeatureCard
            icon="🛡️"
            title="Data Protection"
            description="Take control of your personal information. Know who has access and revoke it instantly."
            delay={2.1}
          />
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.3, duration: 0.8 }}
          className="mt-20 text-center text-gray-500 text-sm"
        >
          <p>&copy; {new Date().getFullYear()} Boo Privacy. All rights reserved.</p>
          <p className="mt-2 text-gray-600">Your privacy is not a feature. It&apos;s a right.</p>
        </motion.footer>
      </div>
    </main>
  )
}
