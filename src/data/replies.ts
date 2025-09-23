export type PandaReply = {
  id: number;
  src: string;
  translation: string;
  tags: string[];
};

export const PANDA_REPLIES: PandaReply[] = [
  {
    id: 1,
    src: "/sounds/red_panda_voice1.mp3",
    translation: "おなかすいたなぁ…🍎 りんごあるかな？",
    tags: ["お腹","はらぺこ","ごはん","food","りんご","なに食べる"],
  },
  {
    id: 2,
    src: "/sounds/red_panda_voice2.mp3",
    translation: "あそぼう！いっしょにおさんぽしたいな🐾",
    tags: ["遊ぶ","あそぼ","元気","たのしい","play"],
  },
  {
    id: 3,
    src: "/sounds/red_panda_voice3.mp3",
    translation: "こんにちは！きょうもげんきだよ〜🍀",
    tags: ["こんにちは","やあ","hello","hi","はじめまして"],
  },
];

// 返信選択ロジック
export function selectPandaReply(input: string): PandaReply {
  const lowerInput = input.toLowerCase();
  const scores = PANDA_REPLIES.map(reply => {
    let score = 0;
    reply.tags.forEach(tag => {
      if (lowerInput.includes(tag.toLowerCase())) {
        score += 1;
      }
    });
    return { reply, score };
  });

  // 最大スコアを取得
  const maxScore = Math.max(...scores.map(s => s.score));

  // 最大スコアが0（一致なし）の場合はランダム
  if (maxScore === 0) {
    const randomIndex = Math.floor(Math.random() * PANDA_REPLIES.length);
    return PANDA_REPLIES[randomIndex];
  }

  // 最大スコアのものから選択（複数ある場合はランダム）
  const topScores = scores.filter(s => s.score === maxScore);
  const randomTop = topScores[Math.floor(Math.random() * topScores.length)];
  return randomTop.reply;
}