// AudioContext constructor detection helper

export function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  // Standard AudioContext
  if ('AudioContext' in window) {
    return window.AudioContext
  }

  // Safari/older webkit
  if ('webkitAudioContext' in window) {
    return (window as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  }

  return null
}

export async function createSafeAudioContext(): Promise<AudioContext | null> {
  const AudioContextConstructor = getAudioContextConstructor()

  if (!AudioContextConstructor) {
    return null
  }

  try {
    const context = new AudioContextConstructor()

    // iOS Safari対応: suspended状態の場合は resume
    if (context.state === 'suspended') {
      await context.resume()
    }

    return context
  } catch (error) {
    console.error('Failed to create AudioContext:', error)
    return null
  }
}

// ArrayBuffer-backed Uint8Array creation
export function createTypedArray(length: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(length)
  return new Uint8Array(buffer) as Uint8Array<ArrayBuffer>
}

// Float32Array for time domain data
export function createFloat32Array(length: number): Float32Array {
  const buffer = new ArrayBuffer(length * 4) // 4 bytes per float32
  return new Float32Array(buffer)
}