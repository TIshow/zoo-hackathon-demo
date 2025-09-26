'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { AnalyserBridge } from '@/types/audio'

interface SpectrumPanelProps {
  analyserBridge: AnalyserBridge | null
  isActive: boolean
  className?: string
}

export default function SpectrumPanel({ analyserBridge, isActive, className = '' }: SpectrumPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)

  const drawSpectrum = useCallback(() => {
    if (!canvasRef.current || !analyserBridge || !isActive) {
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const frequencyData = analyserBridge.getFrequencyFrame()
    const binCount = frequencyData.length
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)

    // Draw spectrum bars
    const barWidth = width / binCount
    const hueBase = 200 // Blue base

    for (let i = 0; i < binCount; i++) {
      const value = frequencyData[i]
      const percent = value / 255
      const barHeight = percent * height * 0.8

      // Create gradient colors based on frequency and amplitude
      const hue = hueBase + (i / binCount) * 60 // Blue to cyan
      const saturation = 70 + percent * 30 // More saturated when louder
      const lightness = 40 + percent * 40 // Brighter when louder

      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`

      const x = i * barWidth
      const y = height - barHeight

      ctx.fillRect(x, y, barWidth - 1, barHeight)

      // Add glow effect for higher values
      if (percent > 0.6) {
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 10
        ctx.fillRect(x, y, barWidth - 1, barHeight)
        ctx.shadowBlur = 0
      }
    }

    // Draw center line for reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

  }, [analyserBridge, isActive])

  const startAnimation = useCallback(() => {
    if (isRunningRef.current || !isActive) return

    isRunningRef.current = true

    const animate = () => {
      if (!isRunningRef.current || !isActive) {
        return
      }

      drawSpectrum()
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [drawSpectrum, isActive])

  const stopAnimation = useCallback(() => {
    isRunningRef.current = false

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [])

  // Start/stop animation based on isActive prop
  useEffect(() => {
    if (isActive && analyserBridge) {
      startAnimation()
    } else {
      stopAnimation()
    }

    return () => {
      stopAnimation()
    }
  }, [isActive, analyserBridge, startAnimation, stopAnimation])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }

      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    updateCanvasSize()

    const resizeObserver = new ResizeObserver(updateCanvasSize)
    resizeObserver.observe(canvas)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className={`relative bg-slate-900 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="absolute top-2 left-2 z-10">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-xs text-white/80 font-mono">
            {isActive ? 'ANALYZING' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Overlay message when inactive */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white/60">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm font-medium">音声解析待機中</div>
            <div className="text-xs mt-1">パンダの声を解析中に表示されます</div>
          </div>
        </div>
      )}

      {/* AI analysis indicator */}
      {isActive && (
        <div className="absolute bottom-2 right-2 z-10">
          <div className="flex items-center space-x-1 bg-black/30 rounded-full px-2 py-1">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-xs text-white/80 font-mono">AI</span>
          </div>
        </div>
      )}
    </div>
  )
}