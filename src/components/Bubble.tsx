interface BubbleProps {
  translation: string;
  isVisible: boolean;
}

export default function Bubble({ translation, isVisible }: BubbleProps) {
  if (!isVisible) return null;

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 mt-6 max-w-sm w-full">
      <div className="flex items-start space-x-3 p-4 bg-white rounded-2xl shadow-lg border border-orange-200">
        <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
          <span className="text-lg">🐼</span>
        </div>
        <div className="flex-1">
          <p className="text-gray-800 text-sm leading-relaxed">
            {translation}
          </p>
        </div>
      </div>
      <div className="ml-6 mt-1">
        <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white"></div>
      </div>
    </div>
  );
}