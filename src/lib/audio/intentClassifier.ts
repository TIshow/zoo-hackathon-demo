// Intent classification based on audio features

import type { FeatureAggregate, IntentLabel, IntentResult, ClassifierThresholds } from '@/types/audio'

// Default classifier thresholds (adjustable)
export const DEFAULT_THRESHOLDS: ClassifierThresholds = {
  centroidLow: 800,    // Hz - below this is considered "low"
  centroidHigh: 2500,  // Hz - above this is considered "high"
  rmsLow: 0.1,         // RMS below this is "quiet"
  rmsHigh: 0.4,        // RMS above this is "loud"
  zcrHigh: 0.15        // ZCR above this indicates "noisy/active"
}

// Translation mappings for each intent
export const INTENT_TRANSLATIONS: Record<IntentLabel, string[]> = {
  greeting: [
    "こんにちは！",
    "やあ、会えて嬉しいよ！",
    "おはよう！元気だね",
    "こんばんは〜",
    "久しぶり！"
  ],
  playful: [
    "あそぼ〜！",
    "一緒に走ろうよ！",
    "楽しいことしない？",
    "遊びの時間だ〜",
    "わくわくするね！"
  ],
  hungry: [
    "お腹すいた〜",
    "ご飯まだかな？",
    "おやつほしい...",
    "何か美味しいものない？",
    "食べ物のにおいがする！"
  ]
}

// Panda sound patterns based on grain parameters
export const PANDA_SOUND_PATTERNS: Record<IntentLabel, string[]> = {
  greeting: [
    "キュッ・キュ〜",
    "クーン・クーン",
    "キュルル〜",
    "クック・キュ〜",
    "キューン"
  ],
  playful: [
    "キャッ・キャッ・キャ！",
    "キュキュキュ〜！",
    "クルルル〜♪",
    "キャキャ・キュー！",
    "クルクル〜"
  ],
  hungry: [
    "グルル...キュ〜",
    "クゥーン...クゥーン",
    "キューーーン",
    "グルグル〜キュ",
    "クーーーン"
  ]
}

export class IntentClassifier {
  private thresholds: ClassifierThresholds

  constructor(thresholds: Partial<ClassifierThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }
  }

  classify(features: FeatureAggregate): IntentResult {
    const { centroidAvg, rmsAvg, zcrAvg } = features
    const scores: Record<IntentLabel, number> = {
      greeting: 0,
      playful: 0,
      hungry: 0
    }

    // Rule-based classification logic

    // Playful: High centroid + High RMS + (optionally) High ZCR
    if (centroidAvg > this.thresholds.centroidHigh) {
      scores.playful += 0.4
    }
    if (rmsAvg > this.thresholds.rmsHigh) {
      scores.playful += 0.3
    }
    if (zcrAvg && zcrAvg > (this.thresholds.zcrHigh || 0.15)) {
      scores.playful += 0.3
    }

    // Greeting: Mid centroid + Mid RMS (balanced)
    if (centroidAvg >= this.thresholds.centroidLow && centroidAvg <= this.thresholds.centroidHigh) {
      scores.greeting += 0.4
    }
    if (rmsAvg >= this.thresholds.rmsLow && rmsAvg <= this.thresholds.rmsHigh) {
      scores.greeting += 0.4
    }
    // Prefer moderate ZCR for greeting
    if (zcrAvg && zcrAvg < (this.thresholds.zcrHigh || 0.15)) {
      scores.greeting += 0.2
    }

    // Hungry: Low centroid + Variable RMS (can be quiet pleading or loud demanding)
    if (centroidAvg < this.thresholds.centroidLow) {
      scores.hungry += 0.5
    }
    // Either very low RMS (pleading) or high RMS (demanding)
    if (rmsAvg < this.thresholds.rmsLow || rmsAvg > this.thresholds.rmsHigh) {
      scores.hungry += 0.3
    }
    // Lower ZCR for hungry (more tonal, less noisy)
    if (zcrAvg && zcrAvg < (this.thresholds.zcrHigh || 0.15) * 0.7) {
      scores.hungry += 0.2
    }

    // Find best match
    const intentLabels = Object.keys(scores) as IntentLabel[]
    const bestIntent = intentLabels.reduce((best, current) =>
      scores[current] > scores[best] ? current : best
    )

    // Calculate confidence (normalize to 0-1 range)
    const maxScore = Math.max(...Object.values(scores))
    const confidence = Math.min(maxScore, 1.0)

    // Minimum confidence threshold
    const finalConfidence = Math.max(confidence, 0.2)

    return {
      intent: bestIntent,
      confidence: finalConfidence,
      features
    }
  }

  // Get random translation for intent
  getRandomTranslation(intent: IntentLabel): string {
    const translations = INTENT_TRANSLATIONS[intent]
    const randomIndex = Math.floor(Math.random() * translations.length)
    return translations[randomIndex]
  }

  // Get random panda sound pattern for intent
  getRandomPandaSound(intent: IntentLabel): string {
    const patterns = PANDA_SOUND_PATTERNS[intent]
    const randomIndex = Math.floor(Math.random() * patterns.length)
    return patterns[randomIndex]
  }

  // Update thresholds (for UI adjustments)
  updateThresholds(newThresholds: Partial<ClassifierThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds }
  }

  // Get current thresholds
  getThresholds(): ClassifierThresholds {
    return { ...this.thresholds }
  }
}