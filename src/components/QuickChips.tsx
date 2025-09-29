interface QuickChipsProps {
  onQuickQuestion: (question: string) => void;
  disabled?: boolean;
}

const QUICK_QUESTIONS = [
  { text: "こんにちは！", description: "あいさつ系" },
  { text: "ごはん何が好き？", description: "はらぺこ系" },
  { text: "あそぼ！", description: "あそぼ系" },
  { text: "おまかせで鳴く", description: "ランダム" },
];

export default function QuickChips({ onQuickQuestion, disabled = false }: QuickChipsProps) {
  return (
    <div className="w-full">
      <p className="text-sm text-gray-600 mb-3 text-center">よく使う質問</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {QUICK_QUESTIONS.map((question, index) => (
          <button
            key={index}
            onClick={() => !disabled && onQuickQuestion(question.text)}
            disabled={disabled}
            className="px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded-full border border-orange-200 hover:bg-orange-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed focus:ring-2 focus:ring-orange-300 focus:outline-none"
            aria-label={`${question.text}（${question.description}）をレッサーパンダに話しかける`}
          >
            {question.text}
          </button>
        ))}
      </div>
    </div>
  );
}