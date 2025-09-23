// Web Audio API による粒合成風パンダ発話システム
// 毎回少し違う鳴き方を生成して「生成っぽさ」を演出

export interface SpeechParams {
  grainCount?: number;      // 粒数: 2-5
  pitchVariation?: number;  // ピッチ変化: ±3半音
  speedVariation?: [number, number]; // 再生速度: 0.85-1.15倍
  grainDuration?: [number, number];  // 各粒の長さ: 0.25-0.6秒
  grainInterval?: [number, number];  // 粒間隔: 60-200ms
  useReverb?: boolean;      // 簡易リバーブ使用
}

const DEFAULT_PARAMS: Required<SpeechParams> = {
  grainCount: 3,
  pitchVariation: 3,
  speedVariation: [0.85, 1.15],
  grainDuration: [0.25, 0.6],
  grainInterval: [0.06, 0.2],
  useReverb: true,
};

// 半音をplaybackRateに変換
function semitoneToRate(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

// 範囲内のランダム値
function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// 簡易リバーブ用のインパルス応答を生成
function createImpulseResponse(context: AudioContext, duration: number = 0.5): AudioBuffer {
  const length = context.sampleRate * duration;
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2);
      channelData[i] = (Math.random() * 2 - 1) * decay * 0.3;
    }
  }

  return impulse;
}

// AudioBufferを読み込む
export async function loadAudioBuffer(context: AudioContext, url: string): Promise<AudioBuffer> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error('Audio loading failed:', error);
    throw error;
  }
}

// 粒合成風発話のメイン関数
export async function speakLikePanda(
  context: AudioContext,
  audioUrl: string,
  params: SpeechParams = {}
): Promise<void> {
  const config = { ...DEFAULT_PARAMS, ...params };

  try {
    // AudioBufferを読み込み
    const audioBuffer = await loadAudioBuffer(context, audioUrl);
    const bufferDuration = audioBuffer.duration;

    // 粒数をランダム決定
    const grainCount = Math.floor(randomInRange(2, config.grainCount + 1));

    // 簡易リバーブの準備
    let convolver: ConvolverNode | null = null;
    if (config.useReverb) {
      convolver = context.createConvolver();
      convolver.buffer = createImpulseResponse(context);
      convolver.connect(context.destination);
    }

    // 各粒を生成・再生
    for (let i = 0; i < grainCount; i++) {
      setTimeout(() => {
        createAndPlayGrain(context, audioBuffer, bufferDuration, config, convolver);
      }, i * randomInRange(config.grainInterval[0], config.grainInterval[1]) * 1000);
    }

  } catch (error) {
    console.error('Panda speech synthesis failed:', error);
    throw error;
  }
}

// 個別の粒を作成・再生
function createAndPlayGrain(
  context: AudioContext,
  audioBuffer: AudioBuffer,
  bufferDuration: number,
  config: Required<SpeechParams>,
  convolver: ConvolverNode | null
): void {
  try {
    // BufferSourceを作成
    const source = context.createBufferSource();
    source.buffer = audioBuffer;

    // ランダムなオフセット位置を決定
    const maxOffset = Math.max(0, bufferDuration - config.grainDuration[1]);
    const startTime = randomInRange(0, maxOffset);

    // ランダムなピッチ変化を適用
    const pitchSemitones = randomInRange(-config.pitchVariation, config.pitchVariation);
    const basePlaybackRate = randomInRange(config.speedVariation[0], config.speedVariation[1]);
    source.playbackRate.value = basePlaybackRate * semitoneToRate(pitchSemitones);

    // 粒の長さを決定
    const grainLength = randomInRange(config.grainDuration[0], config.grainDuration[1]);

    // フェード用のGainNodeを作成
    const gainNode = context.createGain();
    const currentTime = context.currentTime;
    const fadeTime = 0.01; // 10ms のフェード

    // フェードイン・アウト設定
    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(0.7, currentTime + fadeTime);
    gainNode.gain.setValueAtTime(0.7, currentTime + grainLength - fadeTime);
    gainNode.gain.linearRampToValueAtTime(0, currentTime + grainLength);

    // オーディオグラフを接続
    source.connect(gainNode);

    if (convolver) {
      // リバーブありの場合: ドライ70% + ウェット30%
      const dryGain = context.createGain();
      const wetGain = context.createGain();
      dryGain.gain.value = 0.7;
      wetGain.gain.value = 0.3;

      gainNode.connect(dryGain);
      gainNode.connect(wetGain);
      dryGain.connect(context.destination);
      wetGain.connect(convolver);
    } else {
      gainNode.connect(context.destination);
    }

    // 再生開始・停止
    source.start(currentTime, startTime);
    source.stop(currentTime + grainLength);

  } catch (error) {
    console.error('Grain creation failed:', error);
  }
}

// AudioContextの初期化とユーザー操作による解放
export async function initializeAudioContext(): Promise<AudioContext> {
  const AudioContextConstructor = window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('Web Audio API is not supported in this browser');
  }

  const context = new AudioContextConstructor();

  // iOS Safariなどで必要なユーザー操作による解放
  if (context.state === 'suspended') {
    await context.resume();
  }

  return context;
}

// 意図分類とランダムパラメータを組み合わせた発話
export function createVariedSpeechParams(intent: 'greeting' | 'hungry' | 'playful' | 'random'): SpeechParams {
  const baseParams: SpeechParams = {
    grainCount: Math.floor(randomInRange(2, 6)),
    useReverb: Math.random() > 0.3, // 70%の確率でリバーブ使用
  };

  switch (intent) {
    case 'greeting':
      return {
        ...baseParams,
        pitchVariation: randomInRange(1, 2), // 穏やかなピッチ変化
        speedVariation: [0.9, 1.1], // 落ち着いた速度
        grainDuration: [0.3, 0.5], // やや長めの粒
      };

    case 'hungry':
      return {
        ...baseParams,
        pitchVariation: randomInRange(0.5, 1.5), // 低めのピッチ
        speedVariation: [0.85, 1.0], // やや遅めの速度
        grainDuration: [0.4, 0.6], // 長めの粒で切ない感じ
      };

    case 'playful':
      return {
        ...baseParams,
        pitchVariation: randomInRange(2, 3), // 大きなピッチ変化
        speedVariation: [1.0, 1.15], // 速めの速度
        grainDuration: [0.25, 0.4], // 短めの粒で活発な感じ
        grainInterval: [0.05, 0.15], // 短い間隔
      };

    default: // random
      return {
        ...baseParams,
        pitchVariation: randomInRange(1, 3),
        speedVariation: [randomInRange(0.85, 0.95), randomInRange(1.05, 1.15)],
        grainDuration: [randomInRange(0.25, 0.35), randomInRange(0.45, 0.6)],
      };
  }
}