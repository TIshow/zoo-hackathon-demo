// Web Speech API による音声認識システム
// リアルタイム音声入力でパンダとの自然な会話を実現

// グローバル型定義を削除し、any型を使用してブラウザ互換性を優先

export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

export interface SpeechRecognitionConfig {
  language: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
}

export class VoiceInputManager {
  private recognition: any | null = null
  private isListening: boolean = false
  private onResult: ((result: SpeechRecognitionResult) => void) | null = null
  private onError: ((error: string) => void) | null = null
  private onStart: (() => void) | null = null
  private onEnd: (() => void) | null = null

  constructor() {
    // ブラウザの Speech Recognition API をチェック
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported')
      return
    }

    this.recognition = new SpeechRecognition()
    this.setupRecognition()
  }

  private setupRecognition(): void {
    if (!this.recognition) return

    // 基本設定
    this.recognition.lang = 'ja-JP'
    this.recognition.continuous = true  // 連続認識
    this.recognition.interimResults = true  // 中間結果も取得
    this.recognition.maxAlternatives = 1

    // イベントハンドラー
    this.recognition.onstart = () => {
      this.isListening = true
      this.onStart?.()
    }

    this.recognition.onend = () => {
      this.isListening = false
      this.onEnd?.()
    }

    this.recognition.onresult = (event: any) => {
      const results = Array.from(event.results)

      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i] as any
        const transcript = result[0].transcript

        this.onResult?.({
          transcript: transcript.trim(),
          confidence: result[0].confidence || 0,
          isFinal: result.isFinal
        })
      }
    }

    this.recognition.onerror = (event: any) => {
      const errorMessage = this.getErrorMessage(event.error)
      this.onError?.(errorMessage)
    }

    this.recognition.onnomatch = () => {
      this.onError?.('音声を認識できませんでした')
    }
  }

  // 音声認識開始
  async startListening(
    onResult: (result: SpeechRecognitionResult) => void,
    onError?: (error: string) => void,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech Recognition not supported')
    }

    if (this.isListening) {
      this.stopListening()
    }

    this.onResult = onResult
    this.onError = onError || null
    this.onStart = onStart || null
    this.onEnd = onEnd || null

    try {
      this.recognition.start()
    } catch {
      throw new Error('Failed to start speech recognition')
    }
  }

  // 音声認識停止
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
    }
  }

  // 認識状態の取得
  getIsListening(): boolean {
    return this.isListening
  }

  // 対応ブラウザチェック
  static isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  }

  // マイクへのアクセス権限をリクエスト
  static async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // 権限取得後はストリームを停止
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch {
      return false
    }
  }

  private getErrorMessage(error: string): string {
    switch (error) {
      case 'no-speech':
        return '音声が検出されませんでした'
      case 'audio-capture':
        return 'マイクにアクセスできません'
      case 'not-allowed':
        return 'マイクの使用が許可されていません'
      case 'network':
        return 'ネットワークエラーが発生しました'
      case 'aborted':
        return '音声認識が中断されました'
      default:
        return `音声認識エラー: ${error}`
    }
  }
}

// 音声の活性レベルを監視するクラス
export class VoiceLevelMonitor {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private dataArray: Uint8Array | null = null
  private animationFrame: number | null = null
  private stream: MediaStream | null = null

  async initialize(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.microphone = this.audioContext.createMediaStreamSource(this.stream)

      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8
      this.microphone.connect(this.analyser)

      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)
    } catch {
      throw new Error('Failed to initialize voice level monitor')
    }
  }

  startMonitoring(onLevelUpdate: (level: number) => void): void {
    if (!this.analyser || !this.dataArray) return

    const updateLevel = () => {
      this.analyser!.getByteFrequencyData(this.dataArray! as any)

      // 音量レベルを計算 (0-100)
      let sum = 0
      for (let i = 0; i < this.dataArray!.length; i++) {
        sum += this.dataArray![i]
      }
      const average = sum / this.dataArray!.length
      const level = Math.min(100, (average / 255) * 200) // 感度調整

      onLevelUpdate(level)
      this.animationFrame = requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }

  stopMonitoring(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  cleanup(): void {
    this.stopMonitoring()

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
    this.microphone = null
    this.dataArray = null
  }
}

// 音声入力のバッファリング・デバウンス処理
export class SpeechBuffer {
  private buffer: string = ''
  private debounceTimer: NodeJS.Timeout | null = null
  private onFinalResult: ((text: string) => void) | null = null

  constructor(
    private debounceMs: number = 1500, // 1.5秒で確定
    private minLength: number = 2 // 最小文字数
  ) {}

  addResult(result: SpeechRecognitionResult): void {
    if (result.isFinal) {
      // 最終結果の場合
      const finalText = result.transcript.trim()
      if (finalText.length >= this.minLength) {
        this.flushBuffer(finalText)
      }
    } else {
      // 中間結果の場合
      this.buffer = result.transcript.trim()
      this.scheduleFlush()
    }
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      if (this.buffer.length >= this.minLength) {
        this.flushBuffer(this.buffer)
      }
    }, this.debounceMs)
  }

  private flushBuffer(text: string): void {
    if (this.onFinalResult && text.length >= this.minLength) {
      this.onFinalResult(text)
    }
    this.buffer = ''
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  setOnFinalResult(callback: (text: string) => void): void {
    this.onFinalResult = callback
  }

  getCurrentBuffer(): string {
    return this.buffer
  }

  clear(): void {
    this.buffer = ''
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  cleanup(): void {
    this.clear()
    this.onFinalResult = null
  }
}