// Audio analysis configuration constants

export const ANALYSIS_CONFIG = {
  // サンプリング設定
  SAMPLING_INTERVAL_MS: 50,  // 20Hz サンプリング
  SAMPLING_RATE: 44100,

  // AnalyserNode設定
  FFT_SIZE: 1024,
  SMOOTHING_TIME_CONSTANT: 0.8,
  MIN_DECIBELS: -90,
  MAX_DECIBELS: -10,

  // タイミング設定
  THINKING_DELAY_MS: 250,
  ANALYSIS_END_DELAY_MS: 500,
  CAPTION_HIDE_DELAY_MS: 1000,

  // UI設定
  SPECTRUM_PANEL_HEIGHT: 'h-32',
  CAPTION_MIN_HEIGHT: 'min-h-[160px]',
} as const

export const DEBUG_CONFIG = {
  ENABLE_PERFORMANCE_LOGS: process.env.NODE_ENV === 'development',
  ENABLE_ANALYSIS_LOGS: process.env.NODE_ENV === 'development',
  ENABLE_STATE_LOGS: process.env.NODE_ENV === 'development',
} as const