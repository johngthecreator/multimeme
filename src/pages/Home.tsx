import { useState, useRef, useEffect, useCallback } from "react";
import Toolbar from "../components/Toolbar/Toolbar";
import Canvas from "../components/Canvas/Canvas";
import Settings from "../components/Settings/Settings";
import type { CanvasElementData } from "../components/Canvas/CanvasElement";
import { useDexieElements } from "../hooks/useDexieElements";
import { db } from "../db";

interface StatusState {
  message: string;
  type: "info" | "success" | "error" | "warning";
}

interface DragState {
  elementIds: string[];
  startX: number;
  startY: number;
  elementStarts: Map<string, { x: number; y: number }>;
}

interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface RotateState {
  elementId: string;
  centerX: number;
  centerY: number;
  startAngle: number;
  startDistance: number;
  elementStartRotation: number;
  elementStartWidth?: number;
  elementStartHeight?: number;
  elementStartFontSize?: number;
}

export type { MarqueeState };

export default function Home() {
  const [elements, setElements] = useState<CanvasElementData[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(
    new Set(),
  );
  const [statusState, setStatusState] = useState<StatusState>({
    message: "Ready",
    type: "info",
  });
  const [history, setHistory] = useState<CanvasElementData[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragPositionsRef = useRef<Map<
    string,
    { x: number; y: number }
  > | null>(null);
  const draggedElementsRef = useRef<HTMLElement[]>([]);
  const marqueeJustEndedRef = useRef(false);
  const rotateStateRef = useRef<RotateState | null>(null);
  const pendingRotationRef = useRef<number | null>(null);
  const pendingSizeRef = useRef<{
    width?: number;
    height?: number;
    fontSize?: number;
  } | null>(null);

  // Update status
  const updateStatus = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info",
  ) => {
    setStatusState({ message, type });
  };

  // Load elements from Dexie on mount
  const handleLoadElements = useCallback(
    (loadedElements: CanvasElementData[]) => {
      setElements(loadedElements);
      setHistory([loadedElements]);
      setHistoryIndex(0);
    },
    [],
  );

  const { saveElements } = useDexieElements(elements, handleLoadElements);

  // Cleanup unreferenced images (images in Dexie not referenced by any history entry)
  const handleCleanupUnreferencedImages = useCallback(async () => {
    // Collect all image IDs referenced across every history entry
    const referencedIds = new Set<string>();
    for (const entry of history) {
      for (const el of entry) {
        if (el.type === "image") {
          referencedIds.add(el.id);
        }
      }
    }

    // Get all stored blobs
    const storedBlobs = await db.imageBlobs.toArray();
    let cleanedCount = 0;

    for (const blob of storedBlobs) {
      if (!referencedIds.has(blob.id)) {
        // Revoke any object URL that might exist for this blob
        // (find it from current elements or history entries)
        for (const entry of history) {
          const el = entry.find((e) => e.id === blob.id);
          if (el?.src?.startsWith("blob:")) {
            URL.revokeObjectURL(el.src);
          }
        }
        try {
          await db.imageBlobs.delete(blob.id);
          cleanedCount++;
        } catch (error) {
          console.error("Failed to delete image blob:", error);
        }
      }
    }

    return cleanedCount;
  }, [history]);

  // Add a new textbox
  const handleAddTextbox = () => {
    const newId = `textbox-${Date.now()}`;

    // Calculate center of current viewport
    const canvas = canvasRef.current;
    const x = canvas
      ? canvas.scrollLeft + canvas.clientWidth / 2
      : 5000 + elements.length * 10;
    const y = canvas
      ? canvas.scrollTop + canvas.clientHeight / 2
      : 5000 + elements.length * 10;

    const newElement: CanvasElementData = {
      id: newId,
      type: "textbox",
      x,
      y,
      content: "Edit this text",
      rotation: 0,
      fontSize: 16,
    };

    const newElements = [...elements, newElement];
    updateElementsWithHistory(newElements);
    setSelectedElementIds(new Set([newId]));
    updateStatus("Textbox added", "success");
  };

  // Clear all elements
  const handleClearAll = () => {
    if (elements.length === 0) {
      updateStatus("Canvas is already empty", "info");
      return;
    }

    if (window.confirm("Are you sure you want to clear all elements?")) {
      updateElementsWithHistory([]);
      setSelectedElementIds(new Set());
      updateStatus("Canvas cleared", "success");
    }
  };

  // Handle element content change
  const handleElementContentChange = (id: string, content: string) => {
    const newElements = elements.map((el) =>
      el.id === id ? { ...el, content } : el,
    );
    setElements(newElements);
  };

  // Handle element focus
  const handleElementFocus = (id: string) => {
    setSelectedElementIds(new Set([id]));
  };

  // Handle element blur - delete empty textboxes
  const handleElementBlur = (id: string) => {
    const element = elements.find((el) => el.id === id);

    // Delete if empty textbox
    if (element && element.type === "textbox" && !element.content?.trim()) {
      const newElements = elements.filter((el) => el.id !== id);
      updateElementsWithHistory(newElements);
      updateStatus("Empty textbox deleted", "info");

      if (selectedElementIds.has(id)) {
        const next = new Set(selectedElementIds);
        next.delete(id);
        setSelectedElementIds(next);
      }
    }
  };

  // Handle element selection (for images and canvas clicks)
  const handleElementSelect = (id: string) => {
    setSelectedElementIds(new Set([id]));
  };

  // Handle font toggle
  const handleToggleFont = (id: string) => {
    const newElements = elements.map((el) => {
      if (el.id === id) {
        const current = el.fontFamily || "sans";
        return {
          ...el,
          fontFamily:
            current === "sans"
              ? ("comic-sans" as const)
              : ("sans" as const),
        };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
  };

  // Handle italic toggle
  const handleToggleItalic = (id: string) => {
    const newElements = elements.map((el) => {
      if (el.id === id) {
        return { ...el, italic: !el.italic };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
  };

  // Handle text color toggle
  const handleToggleTextColor = (id: string) => {
    const newElements = elements.map((el) => {
      if (el.id === id) {
        const current = el.textColor || "black";
        return {
          ...el,
          textColor:
            current === "black" ? ("white" as const) : ("black" as const),
        };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
  };

  // Handle canvas click to deselect (skip if a real marquee just finished)
  const handleCanvasClick = () => {
    if (marqueeJustEndedRef.current) {
      marqueeJustEndedRef.current = false;
      return;
    }
    setSelectedElementIds(new Set());
  };

  // Handle paste event for images
  const handlePaste = (e: ClipboardEvent) => {
    const clipboardItems = e.clipboardData?.items || [];

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];

      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        handlePasteImage(item);
        break;
      }
    }
  };

  // Handle pasting image from clipboard
  const handlePasteImage = async (item: DataTransferItem) => {
    updateStatus("Processing image...", "info");

    try {
      const file = item.getAsFile();
      if (!file) throw new Error("Could not extract file");

      const newId = `image-${Date.now()}`;

      // Store blob in Dexie
      await db.imageBlobs.put({
        id: newId,
        blob: file,
        storedAt: Date.now(),
      });

      // Create object URL for rendering (lightweight!)
      const objectUrl = URL.createObjectURL(file);

      // Create image element to get dimensions
      const img = new Image();
      img.onload = () => {
        const newElement: CanvasElementData = {
          id: newId,
          type: "image",
          x: cursorPosition.x,
          y: cursorPosition.y,
          width: Math.min(img.naturalWidth, 400),
          height: Math.min(img.naturalHeight, 300),
          rotation: 0,
          src: objectUrl, // Use object URL instead of data URL
        };

        const newElements = [...elements, newElement];
        updateElementsWithHistory(newElements);
        setSelectedElementIds(new Set([newElement.id]));
        updateStatus("Image pasted successfully", "success");
      };
      img.src = objectUrl;
    } catch (err) {
      updateStatus("Failed to paste image", "error");
    }
  };

  // Update elements and manage history
  const updateElementsWithHistory = (newElements: CanvasElementData[]) => {
    // Remove future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(newElements);
  };

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementIds(new Set());
      updateStatus("Undone", "info");
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementIds(new Set());
      updateStatus("Redone", "info");
    }
  };

  // Handle delete key
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete selected elements
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      selectedElementIds.size > 0
    ) {
      // Don't delete if user is editing text in a contentEditable
      const activeEl = document.activeElement;
      if (activeEl && (activeEl as HTMLElement).isContentEditable) return;

      e.preventDefault();
      const newElements = elements.filter(
        (el) => !selectedElementIds.has(el.id),
      );
      updateElementsWithHistory(newElements);
      setSelectedElementIds(new Set());
      updateStatus(
        selectedElementIds.size === 1
          ? "Element deleted"
          : `${selectedElementIds.size} elements deleted`,
        "success",
      );
      return;
    }

    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Ctrl+Shift+Z or Cmd+Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Ctrl+Y or Cmd+Y for redo
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      handleRedo();
      return;
    }
  };

  // Setup keyboard event listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementIds, elements, historyIndex, history]);

  // Setup paste event listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [elements, cursorPosition]);

  // Load canvas scroll position from URL or center by default
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const params = new URLSearchParams(window.location.search);
      const scrollX = params.get("scrollX");
      const scrollY = params.get("scrollY");

      if (scrollX && scrollY) {
        // Restore from URL
        canvas.scrollLeft = parseInt(scrollX, 10);
        canvas.scrollTop = parseInt(scrollY, 10);
      } else {
        // Default to center of the large canvas
        canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2;
        canvas.scrollTop = (canvas.scrollHeight - canvas.clientHeight) / 2;
      }
    }
  }, []);

  // Save canvas scroll position to URL query params (debounced)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let timeoutId: number;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        params.set("scrollX", Math.round(canvas.scrollLeft).toString());
        params.set("scrollY", Math.round(canvas.scrollTop).toString());

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, "", newUrl);
      }, 500);
    };

    canvas.addEventListener("scroll", handleScroll);
    return () => {
      canvas.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  // Prevent trackpad swipe-to-navigate gestures at scroll boundaries
  useEffect(() => {
    const preventSwipeNavigation = (e: WheelEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const atLeftEdge = canvas.scrollLeft === 0 && e.deltaX < 0;
      const atRightEdge =
        canvas.scrollLeft >= canvas.scrollWidth - canvas.clientWidth &&
        e.deltaX > 0;

      // Only prevent default at scroll boundaries to stop browser navigation
      if (atLeftEdge || atRightEdge) {
        e.preventDefault();
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      // Use passive: false to allow preventDefault
      canvas.addEventListener("wheel", preventSwipeNavigation, {
        passive: false,
      });
      return () => canvas.removeEventListener("wheel", preventSwipeNavigation);
    }
  }, []);

  // Disable text selection while actively dragging or marquee-selecting
  useEffect(() => {
    if (isDragging || marqueeState) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
    return () => {
      document.body.style.userSelect = "";
    };
  }, [isDragging, marqueeState]);

  // Helper: get canvas-relative coordinates from mouse event
  const getCanvasCoords = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + canvas.scrollLeft,
      y: e.clientY - rect.top + canvas.scrollTop,
    };
  }, []);

  // Helper: compute marquee rect (normalized so x/y is top-left)
  const getMarqueeRect = useCallback((m: MarqueeState) => {
    const x = Math.min(m.startX, m.currentX);
    const y = Math.min(m.startY, m.currentY);
    const w = Math.abs(m.currentX - m.startX);
    const h = Math.abs(m.currentY - m.startY);
    return { x, y, w, h };
  }, []);

  // Helper: check if element intersects marquee rect
  const elementIntersectsRect = useCallback(
    (
      el: CanvasElementData,
      rect: { x: number; y: number; w: number; h: number },
    ) => {
      let elW = el.width;
      let elH = el.height;

      // For textboxes without explicit width/height, try DOM measurement
      if (!elW || !elH) {
        const domEl = document.querySelector(
          `[data-element-id="${el.id}"]`,
        ) as HTMLElement;
        if (domEl) {
          const domRect = domEl.getBoundingClientRect();
          elW = elW || domRect.width;
          elH = elH || domRect.height;
        } else {
          elW = elW || 100;
          elH = elH || 30;
        }
      }

      // AABB intersection test
      return !(
        el.x + elW < rect.x ||
        el.x > rect.x + rect.w ||
        el.y + elH < rect.y ||
        el.y > rect.y + rect.h
      );
    },
    [],
  );

  // Track cursor position and handle dragging/marquee with single event listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle rotation and resize drag
      if (rotateStateRef.current) {
        const rs = rotateStateRef.current;
        const currentAngle = Math.atan2(
          e.clientY - rs.centerY,
          e.clientX - rs.centerX,
        );
        const currentDistance = Math.sqrt(
          Math.pow(e.clientX - rs.centerX, 2) +
            Math.pow(e.clientY - rs.centerY, 2),
        );

        // Calculate rotation
        const deltaAngle = (currentAngle - rs.startAngle) * (180 / Math.PI);
        const newRotation = rs.elementStartRotation + deltaAngle;

        // Calculate size scale factor
        const scaleFactor = currentDistance / rs.startDistance;

        const element = elements.find((el) => el.id === rs.elementId);
        if (!element) return;

        const domEl = document.querySelector(
          `[data-element-id="${rs.elementId}"]`,
        ) as HTMLElement;

        if (element.type === "image") {
          // Scale image dimensions
          const newWidth = Math.max(
            50,
            (rs.elementStartWidth || 200) * scaleFactor,
          );
          const newHeight = Math.max(
            50,
            (rs.elementStartHeight || 200) * scaleFactor,
          );

          if (domEl) {
            domEl.style.transform = `rotate(${newRotation}deg)`;
            domEl.style.width = `${newWidth}px`;
            domEl.style.height = `${newHeight}px`;
          }

          pendingSizeRef.current = { width: newWidth, height: newHeight };
        } else if (element.type === "textbox") {
          // Scale font size
          const newFontSize = Math.max(
            8,
            Math.min(200, (rs.elementStartFontSize || 16) * scaleFactor),
          );

          if (domEl) {
            domEl.style.transform = `rotate(${newRotation}deg)`;
            const contentDiv = domEl.querySelector(
              "[contenteditable]",
            ) as HTMLElement;
            if (contentDiv) {
              contentDiv.style.fontSize = `${newFontSize}px`;
            }
          }

          pendingSizeRef.current = { fontSize: newFontSize };
        }

        pendingRotationRef.current = newRotation;
        return;
      }

      // Handle marquee drag
      if (marqueeState) {
        const coords = getCanvasCoords(e);
        const newMarquee = {
          ...marqueeState,
          currentX: coords.x,
          currentY: coords.y,
        };
        setMarqueeState(newMarquee);

        // Compute which elements intersect the marquee
        const rect = getMarqueeRect(newMarquee);
        const intersecting = new Set<string>();
        for (const el of elements) {
          if (elementIntersectsRect(el, rect)) {
            intersecting.add(el.id);
          }
        }
        setSelectedElementIds(intersecting);
        return;
      }

      // Drag threshold: only start dragging if moved more than 5 pixels
      if (dragState && !isDragging) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Only activate drag if threshold exceeded
        if (distance > 5) {
          setIsDragging(true);
        } else {
          // Below threshold, just update cursor position
          if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            setCursorPosition({
              x: e.clientX - rect.left + canvasRef.current.scrollLeft,
              y: e.clientY - rect.top + canvasRef.current.scrollTop,
            });
          }
          return;
        }
      }

      // Handle multi-drag with smooth mousemove
      if (isDragging && dragState) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        // Check if this is a mixed text+image drag (images have CSS transition-all)
        const hasImages = dragState.elementIds.some((id) => {
          const el = elements.find((e) => e.id === id);
          return el?.type === "image";
        });

        // Apply CSS transform to all dragged elements for instant visual feedback
        const newPositions = new Map<string, { x: number; y: number }>();
        for (const id of dragState.elementIds) {
          const start = dragState.elementStarts.get(id);
          if (!start) continue;

          const domEl = document.querySelector(
            `[data-element-id="${id}"]`,
          ) as HTMLElement;
          if (domEl) {
            const element = elements.find((el) => el.id === id);
            const rotation = element?.rotation || 0;
            // Match image transition lag for textboxes in mixed selections
            if (hasImages && element?.type === "textbox") {
              domEl.style.transition =
                "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)";
            }
            domEl.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotation}deg)`;
            if (!draggedElementsRef.current.includes(domEl)) {
              draggedElementsRef.current.push(domEl);
            }
          }

          newPositions.set(id, {
            x: Math.max(0, start.x + deltaX),
            y: Math.max(0, start.y + deltaY),
          });
        }

        dragPositionsRef.current = newPositions;
      } else if (!dragState && !marqueeState) {
        // Only update cursor position when NOT waiting to drag
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          setCursorPosition({
            x: e.clientX - rect.left + canvasRef.current.scrollLeft,
            y: e.clientY - rect.top + canvasRef.current.scrollTop,
          });
        }
      }
    };

    const handleMouseUp = () => {
      // Commit rotation and resize if rotating/resizing
      if (rotateStateRef.current && pendingRotationRef.current !== null) {
        const rs = rotateStateRef.current;
        const finalRotation = pendingRotationRef.current % 360;
        const newElements = elements.map((el) => {
          if (el.id === rs.elementId) {
            const updates: Partial<CanvasElementData> = {
              rotation: finalRotation,
            };
            if (pendingSizeRef.current) {
              if (pendingSizeRef.current.width !== undefined) {
                updates.width = pendingSizeRef.current.width;
              }
              if (pendingSizeRef.current.height !== undefined) {
                updates.height = pendingSizeRef.current.height;
              }
              if (pendingSizeRef.current.fontSize !== undefined) {
                updates.fontSize = pendingSizeRef.current.fontSize;
              }
            }
            return { ...el, ...updates };
          }
          return el;
        });
        updateElementsWithHistory(newElements);
        updateStatus("Element transformed", "success");

        // Clean up DOM overrides
        const domEl = document.querySelector(
          `[data-element-id="${rs.elementId}"]`,
        ) as HTMLElement;
        if (domEl) {
          domEl.style.width = "";
          domEl.style.height = "";
          const contentDiv = domEl.querySelector(
            "[contenteditable]",
          ) as HTMLElement;
          if (contentDiv) {
            contentDiv.style.fontSize = "";
          }
        }

        rotateStateRef.current = null;
        pendingRotationRef.current = null;
        pendingSizeRef.current = null;
        return;
      }
      if (rotateStateRef.current) {
        rotateStateRef.current = null;
        pendingRotationRef.current = null;
        pendingSizeRef.current = null;
        return;
      }

      // Finalize marquee selection
      if (marqueeState) {
        const rect = getMarqueeRect(marqueeState);
        if (rect.w > 3 || rect.h > 3) {
          marqueeJustEndedRef.current = true;
        }
        setMarqueeState(null);
        // selectedElementIds already set live during mousemove
        return;
      }

      if (isDragging && dragState && dragPositionsRef.current) {
        // Restore rotation-only transforms and clear inline transition on all dragged elements
        for (const domEl of draggedElementsRef.current) {
          const id = domEl.getAttribute("data-element-id");
          const element = id ? elements.find((el) => el.id === id) : null;
          const rotation = element?.rotation || 0;
          domEl.style.transform = `rotate(${rotation}deg)`;
          domEl.style.transition = "";
        }
        draggedElementsRef.current = [];

        // Move dragged elements to end (highest z-index) and update positions
        const positions = dragPositionsRef.current;
        const draggedIds = new Set(dragState.elementIds);
        const nonDragged = elements.filter((el) => !draggedIds.has(el.id));
        const dragged = elements.filter((el) => draggedIds.has(el.id));
        const updatedDragged = dragged.map((el) => {
          const pos = positions.get(el.id);
          return pos ? { ...el, x: pos.x, y: pos.y } : el;
        });

        const newElements = [...nonDragged, ...updatedDragged];
        updateElementsWithHistory(newElements);
        updateStatus(
          dragState.elementIds.length === 1
            ? "Element moved"
            : `${dragState.elementIds.length} elements moved`,
          "success",
        );

        setIsDragging(false);
        dragPositionsRef.current = null;
      }

      // Always clear dragState on mouseup (handles click-without-move on edges)
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragState, elements, marqueeState]);

  // Handle mouse down on element to start drag
  const handleElementMouseDown = (elementId: string) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      // Shift+click: toggle selection, don't start drag
      if (e.shiftKey) {
        const next = new Set(selectedElementIds);
        if (next.has(elementId)) {
          next.delete(elementId);
        } else {
          next.add(elementId);
        }
        setSelectedElementIds(next);
        return;
      }

      // If element is already selected, start drag for ALL selected elements
      if (selectedElementIds.has(elementId)) {
        const ids = Array.from(selectedElementIds);
        const starts = new Map<string, { x: number; y: number }>();
        for (const id of ids) {
          const el = elements.find((e) => e.id === id);
          if (el) starts.set(id, { x: el.x, y: el.y });
        }
        setDragState({
          elementIds: ids,
          startX: e.clientX,
          startY: e.clientY,
          elementStarts: starts,
        });
      } else {
        // Select only this element and start drag for it
        setSelectedElementIds(new Set([elementId]));
        setDragState({
          elementIds: [elementId],
          startX: e.clientX,
          startY: e.clientY,
          elementStarts: new Map([[elementId, { x: element.x, y: element.y }]]),
        });
      }
    };
  };

  // Handle mouse down on canvas background to start marquee
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start marquee on left click on empty canvas
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-element-id]")) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + canvas.scrollLeft;
    const y = e.clientY - rect.top + canvas.scrollTop;

    setMarqueeState({ startX: x, startY: y, currentX: x, currentY: y });
    setSelectedElementIds(new Set());
  };

  // Handle mouse down on rotate handle
  const handleRotateHandleMouseDown = (elementId: string) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      setSelectedElementIds(new Set([elementId]));

      const domEl = document.querySelector(
        `[data-element-id="${elementId}"]`,
      ) as HTMLElement;
      if (!domEl) return;

      const rect = domEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const startDistance = Math.sqrt(
        Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2),
      );

      rotateStateRef.current = {
        elementId,
        centerX,
        centerY,
        startAngle,
        startDistance,
        elementStartRotation: element.rotation || 0,
        elementStartWidth: element.width,
        elementStartHeight: element.height,
        elementStartFontSize: element.fontSize,
      };
    };
  };

  // Handle measurement update for textbox auto-sizing
  const handleMeasure = (
    _elementId: string,
    _width: number,
    _height: number,
  ) => {
    // Measurement callback for textbox auto-sizing (dimensions tracked via ResizeObserver)
  };

  // Handle rotation
  const handleRotate = (elementId: string, deltaRotation: number) => {
    const newElements = elements.map((el) => {
      if (el.id === elementId) {
        const currentRotation = el.rotation || 0;
        return {
          ...el,
          rotation: (currentRotation + deltaRotation) % 360,
        };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
    updateStatus("Element rotated", "success");
  };

  // Auto-save elements to Dexie whenever they change
  useEffect(() => {
    if (elements.length > 0) {
      const timeoutId = setTimeout(() => {
        saveElements(elements);
      }, 1000); // Debounce auto-save by 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [elements, saveElements]);

  // Cleanup: revoke object URLs and delete blobs when component unmounts
  useEffect(() => {
    return () => {
      elements.forEach((el) => {
        if (el.type === "image" && el.src?.startsWith("blob:")) {
          URL.revokeObjectURL(el.src);
        }
      });
    };
  }, []);

  return (
    <>
      <Toolbar
        onAddTextbox={handleAddTextbox}
        onClearAll={handleClearAll}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          onCleanupImages={handleCleanupUnreferencedImages}
        />
      )}

      <Canvas
        ref={canvasRef}
        elements={elements}
        selectedElementIds={selectedElementIds}
        onElementContentChange={handleElementContentChange}
        onElementFocus={handleElementFocus}
        onElementBlur={handleElementBlur}
        onElementSelect={handleElementSelect}
        onCanvasClick={handleCanvasClick}
        onCanvasMouseDown={handleCanvasMouseDown}
        onElementMouseDown={handleElementMouseDown}
        onRotateHandleMouseDown={handleRotateHandleMouseDown}
        onMeasure={handleMeasure}
        onRotate={handleRotate}
        onToggleFont={handleToggleFont}
        onToggleItalic={handleToggleItalic}
        onToggleTextColor={handleToggleTextColor}
        isDragging={isDragging}
        marqueeState={marqueeState}
      />
    </>
  );
}
