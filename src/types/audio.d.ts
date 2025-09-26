// Audio analysis and feature extraction types

export interface FeatureSample {
  rms: number
  centroid: number
  zcr?: number
}

export interface FeatureAggregate {
  rmsAvg: number
  rmsMax: number
  centroidAvg: number
  centroidMax: number
  zcrAvg?: number
  sampleCount: number
}

export type IntentLabel = 'greeting' | 'playful' | 'hungry'

export interface IntentResult {
  intent: IntentLabel
  confidence: number
  features: FeatureAggregate
}

export interface ClassifierThresholds {
  centroidLow: number
  centroidHigh: number
  rmsLow: number
  rmsHigh: number
  zcrHigh?: number
}

export interface AnalyserConfig {
  fftSize: number
  smoothingTimeConstant: number
  minDecibels: number
  maxDecibels: number
}

export interface AnalyserBridge {
  analyser: AnalyserNode
  frequencyData: Uint8Array
  timeData: Uint8Array
  getFrequencyFrame(): Uint8Array
  getTimeFrame(): Uint8Array
  cleanup(): void
}

export interface GrainTimeline {
  grainIndex: number
  startTime: number
  duration: number
}

export interface PandaPhrase {
  grains: string[]
  translation: string
  timeline: GrainTimeline[]
}