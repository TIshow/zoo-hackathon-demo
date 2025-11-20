// AnalyserNode integration with existing audio pipeline

import type { AnalyserConfig, AnalyserBridge } from '@/types/audio'
import { createTypedArray } from './audioContextHelper'

const DEFAULT_ANALYSER_CONFIG: AnalyserConfig = {
  fftSize: 1024,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10
}

export function createAnalyser(
  context: AudioContext,
  config: Partial<AnalyserConfig> = {}
): AnalyserBridge {
  const analyser = context.createAnalyser()
  const finalConfig = { ...DEFAULT_ANALYSER_CONFIG, ...config }

  // Configure analyser
  analyser.fftSize = finalConfig.fftSize
  analyser.smoothingTimeConstant = finalConfig.smoothingTimeConstant
  analyser.minDecibels = finalConfig.minDecibels
  analyser.maxDecibels = finalConfig.maxDecibels

  // Create properly typed arrays
  const frequencyBinCount = analyser.frequencyBinCount
  const frequencyData = createTypedArray(frequencyBinCount)
  const timeData = createTypedArray(analyser.fftSize)

  return {
    analyser,
    frequencyData,
    timeData,

    getFrequencyFrame(): Uint8Array {
      analyser.getByteFrequencyData(frequencyData)
      return frequencyData
    },

    getTimeFrame(): Uint8Array {
      analyser.getByteTimeDomainData(timeData)
      return timeData
    },

    cleanup(): void {
      // No explicit cleanup needed for AnalyserNode
      // Will be garbage collected with context
    }
  }
}

// Insert analyser into existing audio chain
export function insertAnalyserIntoChain(
  sourceNode: AudioNode,
  destinationNode: AudioNode,
  analyserBridge: AnalyserBridge
): void {
  // Disconnect existing connection
  sourceNode.disconnect(destinationNode)

  // Insert analyser: source -> analyser -> destination
  sourceNode.connect(analyserBridge.analyser)
  analyserBridge.analyser.connect(destinationNode)
}

// Remove analyser from chain (restore direct connection)
export function removeAnalyserFromChain(
  sourceNode: AudioNode,
  destinationNode: AudioNode,
  analyserBridge: AnalyserBridge
): void {
  // Disconnect through analyser
  sourceNode.disconnect(analyserBridge.analyser)
  analyserBridge.analyser.disconnect(destinationNode)

  // Restore direct connection
  sourceNode.connect(destinationNode)
}