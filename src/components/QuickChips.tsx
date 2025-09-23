interface QuickChipsProps {
  onQuickQuestion: (question: string) => void;
}

const QUICK_QUESTIONS = [
  "こんにちは！",
  "ごはん何が好き？",
  "あそぼ！",
  "おまかせで鳴く"
];

export default function QuickChips({ onQuickQuestion }: QuickChipsProps) {
  return (
    <div className="w-full max-w-sm">
      <p className="text-sm text-gray-600 mb-3 text-center">よく使う質問</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {QUICK_QUESTIONS.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuickQuestion(question)}
            className="px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded-full border border-orange-200 hover:bg-orange-200 transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}