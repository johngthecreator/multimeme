import { forwardRef } from 'react';
import type { CanvasElementData } from './CanvasElement';
import CanvasElement from './CanvasElement';

interface CanvasProps {
  elements: CanvasElementData[];
  selectedElementId?: string;
  onElementContentChange: (id: string, content: string) => void;
  onElementFocus: (id: string) => void;
  onElementBlur: (id: string) => void;
  onElementSelect: (id: string) => void;
  onCanvasClick?: () => void;
  onElementMouseDown?: (elementId: string) => (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotateHandleMouseDown?: (elementId: string) => (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotate?: (elementId: string, deltaRotation: number) => void;
  onMeasure?: (elementId: string, width: number, height: number) => void;
  isDragging?: boolean;
}

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(function Canvas({
  elements,
  selectedElementId,
  onElementContentChange,
  onElementFocus,
  onElementBlur,
  onElementSelect,
  onCanvasClick,
  onElementMouseDown,
  onRotateHandleMouseDown,
  onRotate,
  onMeasure,
  isDragging = false,
}, ref) {
  const handleCanvasClick = () => {
    // Clicks on elements are stopped via stopPropagation,
    // so if we reach here it's a canvas background click
    onCanvasClick?.();
  };

  return (
    <div
      ref={ref}
      className={`w-screen h-screen relative bg-white overflow-auto cursor-default transition-opacity select-none ${
        isDragging ? 'opacity-90' : ''
      }`}
      onClick={handleCanvasClick}
      data-testid="canvas"
      role="main"
      aria-label="Canvas for adding and editing elements"
    >
      {/* Canvas background grid (optional visual aid) */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" />

      {/* Render all canvas elements */}
      <div className="relative w-full h-full min-h-screen">
        {elements.map((element) => (
          <CanvasElement
            key={element.id}
            {...element}
            isSelected={selectedElementId === element.id}
            onContentChange={onElementContentChange}
            onFocus={onElementFocus}
            onBlur={onElementBlur}
            onSelect={onElementSelect}
            onRotate={onRotate}
            onMeasure={onMeasure}
            onMouseDown={onElementMouseDown?.(element.id)}
            onRotateHandleMouseDown={onRotateHandleMouseDown?.(element.id)}
            isDragging={isDragging}
          />
        ))}
      </div>

      {/* Empty state message */}
      {elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <p className="text-lg font-semibold">Canvas is empty</p>
            <p className="text-sm">Click "Add Textbox" to get started</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default Canvas;
