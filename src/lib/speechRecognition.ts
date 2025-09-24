// src/lib/speechRecognition.ts
// Web Speech API による音声認識システム（自己完結・any不使用）

/* ====== 1) ローカル最小型（SpeechRecognition系） ====== */
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  isFinal: boolean;
  length: number;
  0: SRAlternative;
  [index: number]: SRAlternative;
}
interface SRResultList {
  length: number;
  0: SRResult;
  [index: number]: SRResult;
}
interface SREvent extends Event {
  results: SRResultList;
  resultIndex: number;
}
interface SRErrorEvent extends Event {
  error: string;
  message?: string;
}
interface SRGrammarList {
  length: number;
  addFromString(source: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): { src: string; weight: number };
  [index: number]: { src: string; weight: number };
}
interface SR extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  grammars: SRGrammarList;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((ev: Event) => void) | null;
  onsoundstart: ((ev: Event) => void) | null;
  onspeechstart: ((ev: Event) => void) | null;
  onspeechend: ((ev: Event) => void) | null;
  onsoundend: ((ev: Event) => void) | null;
  onaudioend: ((ev: Event) => void) | null;
  onresult: ((ev: SREvent) => void) | null;
  onnomatch: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
}
type SRCtor = new () => SR;

/** window/globalThis から SR コンストラクタを安全に取得 */
function getSpeechRecognitionCtor(): SRCtor | undefined {
  const g = globalThis as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition;
}

/* ====== 2) 公開用の軽量結果型 ====== */
export interface SpeechRecognitionResultLite {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export type SpeechRecognitionResult = SpeechRecognitionResultLite;

export interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

/* ====== 3) 音声認識マネージャ ====== */
export class VoiceInputManager {
  private recognition: SR | null = null;
  private isListening = false;

  private onResult: ((result: SpeechRecognitionResultLite) => void) | null = null;
  private onError: ((error: string) => void) | null = null;
  private onStart: (() => void) | null = null;
  private onEnd: (() => void) | null = null;

  constructor() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      console.warn('Speech Recognition API not supported');
      return;
    }
    this.recognition = new Ctor();
    this.setupRecognition();
  }

  private setupRecognition(): void {
    const rec = this.recognition;
    if (!rec) return;

    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.isListening = true;
      this.onStart?.();
    };
    rec.onend = () => {
      this.isListening = false;
      this.onEnd?.();
    };

    rec.onresult = (event: SREvent) => {
      const { results, resultIndex } = event;
      for (let i = resultIndex; i < results.length; i++) {
        const res = results[i];
        const alt0 = res[0];
        this.onResult?.({
          transcript: (alt0?.transcript ?? '').trim(),
          confidence: alt0?.confidence ?? 0,
          isFinal: res.isFinal,
        });
      }
    };

    rec.onerror = (event: SRErrorEvent) => {
      this.onError?.(this.getErrorMessage(event.error));
    };
    rec.onnomatch = () => this.onError?.('音声を認識できませんでした');
  }

  async startListening(
    onResult: (result: SpeechRecognitionResultLite) => void,
    onError?: (error: string) => void,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    const rec = this.recognition;
    if (!rec) throw new Error('Speech Recognition not supported');

    if (this.isListening) this.stopListening();

    this.onResult = onResult;
    this.onError = onError ?? null;
    this.onStart = onStart ?? null;
    this.onEnd = onEnd ?? null;

    try {
      rec.start();
    } catch {
      throw new Error('Failed to start speech recognition');
    }
  }

  stopListening(): void {
    const rec = this.recognition;
    if (rec && this.isListening) rec.stop();
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  static isSupported(): boolean {
    return !!getSpeechRecognitionCtor();
  }

  static async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  private getErrorMessage(error: string): string {
    switch (error) {
      case 'no-speech':
        return '音声が検出されませんでした';
      case 'audio-capture':
        return 'マイクにアクセスできません';
      case 'not-allowed':
        return 'マイクの使用が許可されていません';
      case 'network':
        return 'ネットワークエラーが発生しました';
      case 'aborted':
        return '音声認識が中断されました';
      default:
        return `音声認識エラー: ${error}`;
    }
  }
}

/* ====== 4) 音声レベルモニタ ====== */
function getAudioContextCtor():
  | (new (contextOptions?: AudioContextOptions) => AudioContext)
  | undefined {
  const g = globalThis as unknown as {
    AudioContext?: new (contextOptions?: AudioContextOptions) => AudioContext;
    webkitAudioContext?: new (contextOptions?: AudioContextOptions) => AudioContext;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

export class VoiceLevelMonitor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private animationFrame: number | null = null;
  private stream: MediaStream | null = null;

  async initialize(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const Ctor = getAudioContextCtor();
      if (!Ctor) throw new Error('Web Audio API not supported');
      const ctx = new Ctor();
      this.audioContext = ctx;

      if (!this.stream) throw new Error('No audio stream');

      const analyser = ctx.createAnalyser();
      const microphone = ctx.createMediaStreamSource(this.stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      // ★ ArrayBuffer を明示してから Uint8Array を作る（型を ArrayBuffer に固定）
      const ab: ArrayBuffer = new ArrayBuffer(bufferLength);
      const dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(ab);

      // すべて揃ってからフィールドに反映（null検査を通す）
      this.analyser = analyser;
      this.microphone = microphone;
      this.dataArray = dataArray;
    } catch {
      throw new Error('Failed to initialize voice level monitor');
    }
  }

  startMonitoring(onLevelUpdate: (level: number) => void): void {
    const analyser = this.analyser;
    const dataArray = this.dataArray;
    if (!analyser || !dataArray) return;

    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);

      // 音量レベルを計算 (0-100)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const average = sum / dataArray.length;
      const level = Math.min(100, (average / 255) * 200); // 感度調整

      onLevelUpdate(level);
      this.animationFrame = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  stopMonitoring(): void {
    const raf = this.animationFrame;
    if (raf) {
      cancelAnimationFrame(raf);
      this.animationFrame = null;
    }
  }

  cleanup(): void {
    this.stopMonitoring();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
  }
}

/* ====== 5) バッファリング＆デバウンス ====== */
export class SpeechBuffer {
  private buffer = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onFinalResult: ((text: string) => void) | null = null;

  constructor(
    private debounceMs: number = 1500,
    private minLength: number = 2
  ) {}

  addResult(result: SpeechRecognitionResultLite): void {
    if (result.isFinal) {
      const finalText = result.transcript.trim();
      if (finalText.length >= this.minLength) this.flushBuffer(finalText);
    } else {
      this.buffer = result.transcript.trim();
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.buffer.length >= this.minLength) this.flushBuffer(this.buffer);
    }, this.debounceMs);
  }

  private flushBuffer(text: string): void {
    if (this.onFinalResult && text.length >= this.minLength) {
      this.onFinalResult(text);
    }
    this.buffer = '';
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  setOnFinalResult(callback: (text: string) => void): void {
    this.onFinalResult = callback;
  }

  getCurrentBuffer(): string {
    return this.buffer;
  }

  clear(): void {
    this.buffer = '';
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  cleanup(): void {
    this.clear();
    this.onFinalResult = null;
  }
}
