"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Shield, Zap, Timer } from "lucide-react"
import OptimizedSphere from "@/components/optimized-sphere"

interface QuantumPreviewModalProps {
  onComplete: () => void
}

export default function QuantumPreviewModal({ onComplete }: QuantumPreviewModalProps) {
  const [timeLeft, setTimeLeft] = useState(30)
  const [isActive, setIsActive] = useState(false)
  const [showWarning, setShowWarning] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const startPreview = () => {
    setShowWarning(false)
    setIsActive(true)

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsActive(false)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  if (showWarning) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900/95 border border-amber-700/50 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-light text-white mb-4">Quantum Energy Protection</h2>

          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4 mb-6">
            <p className="text-amber-200 text-sm leading-relaxed">
              You are about to access the quantum breathing fractal grid system. To protect the energy field from
              contamination, you will receive exactly <strong>30 seconds</strong> of exposure to the 12 cranial nerve
              node core technology.
            </p>
          </div>

          <div className="space-y-3 text-left text-sm text-slate-300 mb-6">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Real-time fractal breathing visualization</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Quantum sphere responds to your breath</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Experience the cranial nerve mapping</span>
            </div>
          </div>

          <Button
            onClick={startPreview}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3 rounded-xl"
          >
            <Shield className="w-4 h-4 mr-2" />
            Activate 30-Second Preview
          </Button>

          <p className="text-xs text-slate-500 mt-4">After preview, subscribe for unlimited quantum access</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Timer Overlay */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-amber-900/80 border border-amber-700/50 rounded-full px-6 py-3 flex items-center space-x-3">
          <Timer className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 font-mono text-lg">{timeLeft}s</span>
          <span className="text-amber-200 text-sm">Quantum Preview</span>
        </div>
      </div>

      {/* Quantum Breathing Sphere */}
      <OptimizedSphere breathingMode="microphone" />

      {/* Energy Field Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-cyan-900/80 border border-cyan-700/50 rounded-lg px-4 py-2 text-center">
          <p className="text-cyan-300 text-sm">🌀 Quantum Field Active</p>
          <p className="text-cyan-200/80 text-xs">Breathe naturally to interact with the sphere</p>
        </div>
      </div>
    </div>
  )
}
