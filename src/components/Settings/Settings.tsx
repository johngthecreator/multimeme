import { useState } from "react";
import { X, Trash2 } from "lucide-react";

interface SettingsProps {
  onClose: () => void;
  onCleanupImages: () => Promise<number>;
}

export default function Settings({ onClose, onCleanupImages }: SettingsProps) {
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanup = async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    try {
      const count = await onCleanupImages();
      setCleanupResult(
        count > 0
          ? `Removed ${count} unused image${count !== 1 ? "s" : ""}`
          : "No unused images found",
      );
    } catch {
      setCleanupResult("Failed to clean up images");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-80 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCleanup}
            disabled={isCleaning}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-gray-700 text-sm transition-colors"
          >
            <Trash2 size={16} />
            {isCleaning ? "Cleaning up..." : "Clean up unused images"}
          </button>

          {cleanupResult && (
            <p className="text-sm text-gray-500 px-1">{cleanupResult}</p>
          )}
        </div>
      </div>
    </div>
  );
}
