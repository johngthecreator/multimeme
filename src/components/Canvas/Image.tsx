interface ImageProps {
  id: string;
  src: string;
  onSelect: (id: string) => void;
  isSelected?: boolean;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  onRotate?: (id: string, deltaRotation: number) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotateHandleMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}

export default function Image({
  id,
  src,
  onSelect,
  isSelected = false,
  x,
  y,
  width = 200,
  height = 200,
  rotation = 0,
  onRotate,
  onMouseDown,
  onRotateHandleMouseDown,
  isDragging = false,
}: ImageProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  // Handle keyboard rotation (arrow keys)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isSelected && onRotate) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onRotate(id, -5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onRotate(id, 5);
      }
    }
  };

  return (
    <div
      className={`absolute group transition-all select-none ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-400'
      } rounded ${isDragging ? 'opacity-70' : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: `rotate(${rotation}deg)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        willChange: isDragging ? 'transform' : 'auto',
      }}
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-element-id={id}
      data-element-type="image"
    >
      {/* Rotation badge */}
      {rotation !== 0 && (
        <div className="absolute -top-6 right-0 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          {Math.round(rotation)}°
        </div>
      )}

      <img
        src={src}
        alt="Canvas element"
        className="w-full h-full object-cover rounded"
        draggable={false}
      />

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute inset-0">
          {/* Rotate handle at bottom-right */}
          <div
            className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-full -mr-1.5 -mb-1.5 cursor-grab pointer-events-auto"
            onMouseDown={(e) => {
              e.stopPropagation();
              onRotateHandleMouseDown?.(e);
            }}
          />
        </div>
      )}
    </div>
  );
}
