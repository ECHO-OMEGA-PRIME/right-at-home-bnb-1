import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-maroon-900">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Logo */}
        <motion.div
          className="mb-6"
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-5xl font-logo text-white italic tracking-wider">
            RAH
          </h1>
          <div className="h-1 w-24 bg-white/50 mx-auto mt-2 rounded-full" />
        </motion.div>

        {/* App name */}
        <motion.p
          className="text-white/80 text-sm tracking-widest uppercase mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Right at Home BnB
        </motion.p>

        {/* Loading spinner */}
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="relative w-12 h-12">
            <motion.div
              className="absolute inset-0 border-4 border-white/20 rounded-full"
            />
            <motion.div
              className="absolute inset-0 border-4 border-transparent border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </motion.div>

        {/* Loading text */}
        <motion.p
          className="text-white/60 text-sm mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Loading your properties...
        </motion.p>
      </motion.div>
    </div>
  );
}
