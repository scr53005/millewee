/**
 * Draggable Component
 * A wrapper component that makes its children draggable on the screen.
 * Supports both mouse and touch interactions with viewport constraints.
 *
 * Direct copy from croque-bedaine — pure React, no framework deps.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DraggableProps {
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  keepInViewport?: boolean;
  bottomInset?: number;
  onPositionChange?: (position: { x: number; y: number }) => void;
}

export default function Draggable({
  children,
  initialPosition = { x: 0, y: 0 },
  className = '',
  style = {},
  disabled = false,
  keepInViewport = false,
  bottomInset = 8,
  onPositionChange,
}: DraggableProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  // Constrain position to keep element center visible on screen
  const constrainPosition = (newX: number, newY: number) => {
    if (!elementRef.current) return { x: newX, y: newY };

    const rect = elementRef.current.getBoundingClientRect();
    const elementWidth = rect.width;
    const elementHeight = rect.height;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (keepInViewport) return {
      x: Math.max(8, Math.min(newX, viewportWidth - elementWidth - 8)),
      y: Math.max(8, Math.min(newY, viewportHeight - elementHeight - bottomInset)),
    };


    const minVisibleWidth = elementWidth * 0.4;
    const maxX = viewportWidth - minVisibleWidth;
    const minX = -(elementWidth - minVisibleWidth);

    const minVisibleHeight = elementHeight * 0.6;
    const maxY = viewportHeight - minVisibleHeight;
    const minY = -(elementHeight - minVisibleHeight);

    return {
      x: Math.max(minX, Math.min(maxX, newX)),
      y: Math.max(minY, Math.min(maxY, newY)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragOffset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const rawPosition = {
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        };
        const constrainedPosition = constrainPosition(rawPosition.x, rawPosition.y);
        setPosition(constrainedPosition);
        onPositionChange?.(constrainedPosition);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        const rawPosition = {
          x: e.touches[0].clientX - dragOffset.current.x,
          y: e.touches[0].clientY - dragOffset.current.y,
        };
        const constrainedPosition = constrainPosition(rawPosition.x, rawPosition.y);
        setPosition(constrainedPosition);
        onPositionChange?.(constrainedPosition);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, onPositionChange]);


  // MiniWallet grows when its actions open; move it up before it slips below the footer.
  useEffect(() => {
    if (!keepInViewport || !elementRef.current) return;
    const fit = () => {
      const rect = elementRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(previous => {
        const next = {
          x: Math.max(8, Math.min(previous.x, window.innerWidth - rect.width - 8)),
          y: Math.max(8, Math.min(previous.y, window.innerHeight - rect.height - bottomInset)),
        };
        return next.x === previous.x && next.y === previous.y ? previous : next;
      });
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(elementRef.current);
    window.addEventListener('resize', fit);
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); };
  }, [keepInViewport, bottomInset]);

  return (
    <div
      ref={elementRef}
      className={className}
      style={{
        ...style,
        position: 'fixed',
        left: position.x === 0 && !isDragging ? style.left : `${position.x}px`,
        top: position.y === 0 && !isDragging ? style.top : `${position.y}px`,
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {children}
    </div>
  );
}
