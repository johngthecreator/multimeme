import { Type } from "lucide-react";

interface AddTextboxButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function AddTextboxButton({
  onClick,
  disabled = false,
}: AddTextboxButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      title="Add a new textbox to the canvas"
    >
      <Type />
    </button>
  );
}
