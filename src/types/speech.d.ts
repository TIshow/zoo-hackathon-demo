// src/types/speech.d.ts

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  0: SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  0: SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

/** ---- ここを“空”から最小実装に修正 ---- */
interface SpeechGrammar {
  /** 文法のソース（JSGFなど） */
  src: string;
  /** 重み（0.0〜1.0 想定） */
  weight: number;
}

interface SpeechGrammarList {
  length: number;
  /** 文字列の文法を追加 */
  addFromString(string: string, weight?: number): void;
  /** URI から文法を追加 */
  addFromURI(src: string, weight?: number): void;
  /** インデックスで取得 */
  item(index: number): SpeechGrammar;
  /** 配列風アクセス */
  [index: number]: SpeechGrammar;
}
/** -------------------------------------- */

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  grammars: SpeechGrammarList;

  start(): void;
  stop(): void;
  abort(): void;

  onaudiostart: ((ev: Event) => void) | null;
  onsoundstart: ((ev: Event) => void) | null;
  onspeechstart: ((ev: Event) => void) | null;
  onspeechend: ((ev: Event) => void) | null;
  onsoundend: ((ev: Event) => void) | null;
  onaudioend: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onnomatch: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
}

declare let SpeechRecognition: { new (): SpeechRecognition };
declare let webkitSpeechRecognition: { new (): SpeechRecognition };

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognition };
    webkitSpeechRecognition?: { new (): SpeechRecognition };
  }
}
export {};
