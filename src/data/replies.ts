export type PandaReply = {
  id: number;
  src: string;
};

// 音声ファイルのリスト（翻訳はINTENT_TRANSLATIONSで管理）
export const PANDA_REPLIES: PandaReply[] = [
  { id: 1, src: "/sounds/red_panda_voice1.mp3" },
  { id: 2, src: "/sounds/red_panda_voice2.mp3" },
  { id: 3, src: "/sounds/red_panda_voice3.mp3" },
];

// 音声ファイルをランダム選択
export function selectPandaReply(): PandaReply {
  const randomIndex = Math.floor(Math.random() * PANDA_REPLIES.length);
  return PANDA_REPLIES[randomIndex];
}