import AddTextboxButton from "./AddTextboxButton";
import ClearButton from "./ClearButton";
import UndoRedoButtons from "./UndoRedoButtons";

interface ToolbarProps {
  onAddTextbox: () => void;
  onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  status?: string;
  statusType?: "info" | "success" | "error" | "warning";
}

export default function Toolbar({
  onAddTextbox,
  onClearAll,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: ToolbarProps) {
  return (
    <header
      className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-white text-gray-800 rounded-full px-8 py-4 shadow-xl"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)",
      }}
    >
      <nav className="flex items-center justify-center gap-6">
        <AddTextboxButton onClick={onAddTextbox} />
        <div className="h-6 w-px bg-gray-300"></div>
        <ClearButton onClick={onClearAll} />
        <div className="h-6 w-px bg-gray-300"></div>
        <UndoRedoButtons
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </nav>
    </header>
  );
}
