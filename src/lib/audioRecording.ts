// Web Audio API による音声録音システム
// 粒合成されたパンダ音声をリアルタイムで録音・保存

export interface RecordingResult {
  audioBlob: Blob
  duration: number
  waveformData: number[]
  format: string
}

export class PandaVoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private analyser: AnalyserNode | null = null
  private dataArray: Uint8Array | null = null

  constructor(private audioContext: AudioContext) {}

  // 録音準備
  async setupRecording(): Promise<void> {
    try {
      // AudioContext の出力先を作成
      const destination = this.audioContext.createMediaStreamDestination()

      // アナライザーで波形データを取得
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.connect(destination)

      const bufferLength = this.analyser.frequencyBinCount
      const ab = new ArrayBuffer(bufferLength);
      this.dataArray = new Uint8Array(ab);

      // MediaRecorder を設定
      const options = {
        mimeType: this.getSupportedMimeType(),
        audioBitsPerSecond: 128000
      }

      this.mediaRecorder = new MediaRecorder(destination.stream, options)
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

    } catch (error) {
      console.error('Recording setup failed:', error)
      throw error
    }
  }

  // 録音開始
  startRecording(): void {
    if (!this.mediaRecorder) {
      throw new Error('Recording not set up. Call setupRecording() first.')
    }

    this.recordedChunks = []
    this.mediaRecorder.start(100) // 100ms ごとにデータを取得
  }

  // 録音停止して結果を返す
  async stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'))
        return
      }

      const startTime = Date.now()

      this.mediaRecorder.onstop = async () => {
        try {
          const duration = (Date.now() - startTime) / 1000
          const audioBlob = new Blob(this.recordedChunks, {
            type: this.getSupportedMimeType()
          })

          // 波形データを取得
          const waveformData = this.getWaveformData()

          resolve({
            audioBlob,
            duration,
            waveformData,
            format: this.getSupportedMimeType()
          })
        } catch (error) {
          reject(error)
        }
      }

      this.mediaRecorder.onerror = (event) => {
        reject(new Error(`Recording failed: ${event}`))
      }

      this.mediaRecorder.stop()
    })
  }

  // Web Audio ノードを録音システムに接続
  connectAudioNode(sourceNode: AudioNode): void {
    if (!this.analyser) {
      throw new Error('Recording not set up')
    }
    sourceNode.connect(this.analyser)
  }

  // 波形データを取得
  private getWaveformData(): number[] {
    if (!this.analyser || !this.dataArray) {
      return []
    }

    this.analyser.getByteFrequencyData(this.dataArray as Uint8Array);
    return Array.from(this.dataArray).map(value => value / 255) // 0-1に正規化
  }

  // サポートされている MIME タイプを取得
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return 'audio/webm' // フォールバック
  }

  // クリーンアップ
  cleanup(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    this.mediaRecorder = null
    this.analyser = null
    this.dataArray = null
    this.recordedChunks = []
  }
}

// 粒合成音声を録音する高レベル関数
export async function recordPandaSpeech(
  audioContext: AudioContext,
  audioUrl: string,
  speechParams: { grainCount?: number; pitchVariation?: number; useReverb?: boolean }
): Promise<RecordingResult> {

  const recorder = new PandaVoiceRecorder(audioContext)

  try {
    await recorder.setupRecording()

    // 録音用に改造された粒合成関数を呼び出し

    // 録音開始
    recorder.startRecording()

    // 粒合成音声を録音中に再生
    // 注意: speakLikePanda を録音可能な形に変更する必要がある
    await speakLikePandaForRecording(audioContext, audioUrl, speechParams, recorder)

    // 録音停止（音声再生完了後）
    const result = await recorder.stopRecording()

    return result

  } catch (error) {
    console.error('Panda speech recording failed:', error)
    throw error
  } finally {
    recorder.cleanup()
  }
}

// 録音用に改造された粒合成関数
async function speakLikePandaForRecording(
  context: AudioContext,
  audioUrl: string,
  params: { grainCount?: number; pitchVariation?: number; useReverb?: boolean },
  recorder: PandaVoiceRecorder
): Promise<void> {

  const { loadAudioBuffer } = await import('./pandaSpeech')

  try {
    const audioBuffer = await loadAudioBuffer(context, audioUrl)
    const grainCount = Math.floor(Math.random() * 4) + 2

    // 各粒の再生をPromiseで管理
    const grainPromises: Promise<void>[] = []

    for (let i = 0; i < grainCount; i++) {
      const delay = i * (Math.random() * 0.14 + 0.06) * 1000 // 60-200ms

      const grainPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          createRecordableGrain(context, audioBuffer, params, recorder, resolve)
        }, delay)
      })

      grainPromises.push(grainPromise)
    }

    // すべての粒の再生完了を待機
    await Promise.all(grainPromises)

  } catch (error) {
    console.error('Recordable panda speech failed:', error)
    throw error
  }
}

// 録音可能な粒を作成
function createRecordableGrain(
  context: AudioContext,
  audioBuffer: AudioBuffer,
  params: { grainCount?: number; pitchVariation?: number; useReverb?: boolean },
  recorder: PandaVoiceRecorder,
  onComplete: () => void
): void {

  try {
    const source = context.createBufferSource()
    source.buffer = audioBuffer

    // ランダムパラメータ
    const startTime = Math.random() * Math.max(0, audioBuffer.duration - 0.6)
    const pitchSemitones = (Math.random() - 0.5) * 6 // ±3半音
    const speed = 0.85 + Math.random() * 0.3 // 0.85-1.15
    const grainLength = 0.25 + Math.random() * 0.35 // 0.25-0.6秒

    source.playbackRate.value = speed * Math.pow(2, pitchSemitones / 12)

    // ゲインノード
    const gainNode = context.createGain()
    const currentTime = context.currentTime

    // フェード設定
    gainNode.gain.setValueAtTime(0, currentTime)
    gainNode.gain.linearRampToValueAtTime(0.7, currentTime + 0.01)
    gainNode.gain.setValueAtTime(0.7, currentTime + grainLength - 0.01)
    gainNode.gain.linearRampToValueAtTime(0, currentTime + grainLength)

    // 録音システムに接続
    source.connect(gainNode)
    recorder.connectAudioNode(gainNode)

    // 音声終了時のコールバック
    source.onended = onComplete

    // 再生開始
    source.start(currentTime, startTime)
    source.stop(currentTime + grainLength)

  } catch (error) {
    console.error('Recordable grain creation failed:', error)
    onComplete()
  }
}

// Blob を Data URL に変換
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 音声の長さを取得
export function getAudioDuration(audioBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const url = URL.createObjectURL(audioBlob)

    audio.onloadedmetadata = () => {
      resolve(audio.duration)
      URL.revokeObjectURL(url)
    }

    audio.onerror = () => {
      reject(new Error('Failed to load audio for duration calculation'))
      URL.revokeObjectURL(url)
    }

    audio.src = url
  })
}