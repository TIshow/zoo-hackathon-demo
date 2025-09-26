// Audio feature extraction functions

import type { FeatureSample, FeatureAggregate } from '@/types/audio'

// Root Mean Square (振幅平均) - Uint8Array版
export function getRMS(timeData: Uint8Array): number {
  let sum = 0
  const length = timeData.length

  for (let i = 0; i < length; i++) {
    // Convert from unsigned [0-255] to signed [-1, 1]
    const sample = (timeData[i] - 128) / 128
    sum += sample * sample
  }

  return Math.sqrt(sum / length)
}

// Spectral Centroid (スペクトル重心) - Uint8Array版
export function getCentroid(frequencyData: Uint8Array, sampleRate: number = 44100): number {
  const nyquist = sampleRate / 2
  const binCount = frequencyData.length
  const binWidth = nyquist / binCount

  let weightedSum = 0
  let magnitudeSum = 0

  for (let i = 0; i < binCount; i++) {
    const frequency = i * binWidth
    const magnitude = frequencyData[i] / 255 // Normalize to [0, 1]

    weightedSum += frequency * magnitude
    magnitudeSum += magnitude
  }

  return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0
}

// Zero Crossing Rate (ゼロ交差率) - Uint8Array版
export function getZCR(timeData: Uint8Array): number {
  let crossings = 0
  const length = timeData.length

  for (let i = 1; i < length; i++) {
    // Convert to signed values
    const current = (timeData[i] - 128) / 128
    const previous = (timeData[i - 1] - 128) / 128

    // Check for zero crossing
    if ((current >= 0 && previous < 0) || (current < 0 && previous >= 0)) {
      crossings++
    }
  }

  return crossings / (length - 1)
}

// Extract features from current frame
export function extractFeatures(
  frequencyData: Uint8Array,
  timeData: Uint8Array,
  sampleRate: number = 44100
): FeatureSample {
  return {
    rms: getRMS(timeData),
    centroid: getCentroid(frequencyData, sampleRate),
    zcr: getZCR(timeData)
  }
}

// Aggregate multiple feature samples
export class FeatureAggregator {
  private samples: FeatureSample[] = []

  addSample(sample: FeatureSample): void {
    this.samples.push(sample)
  }

  getAggregate(): FeatureAggregate {
    if (this.samples.length === 0) {
      return {
        rmsAvg: 0,
        rmsMax: 0,
        centroidAvg: 0,
        centroidMax: 0,
        zcrAvg: 0,
        sampleCount: 0
      }
    }

    const rmsValues = this.samples.map(s => s.rms)
    const centroidValues = this.samples.map(s => s.centroid)
    const zcrValues = this.samples.map(s => s.zcr || 0).filter(v => v > 0)

    return {
      rmsAvg: rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length,
      rmsMax: Math.max(...rmsValues),
      centroidAvg: centroidValues.reduce((a, b) => a + b, 0) / centroidValues.length,
      centroidMax: Math.max(...centroidValues),
      zcrAvg: zcrValues.length > 0 ? zcrValues.reduce((a, b) => a + b, 0) / zcrValues.length : undefined,
      sampleCount: this.samples.length
    }
  }

  clear(): void {
    this.samples = []
  }

  getSampleCount(): number {
    return this.samples.length
  }
}