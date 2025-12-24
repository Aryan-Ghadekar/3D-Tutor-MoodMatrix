"use client";
import Draggable from "react-draggable";
import { useRef } from "react";

export function DraggableWrapper({ children, defaultPosition = { x: 0, y: 0 }, className = "" }) {
    const nodeRef = useRef(null);

    return (
        <Draggable
            nodeRef={nodeRef}
            defaultPosition={defaultPosition}
            bounds="parent"
            handle=".drag-handle"
        >
            <div
                ref={nodeRef}
                className={`absolute cursor-move select-none ${className}`}
                style={{ touchAction: 'none' }}
            >
                <div className="drag-handle absolute -top-3 -left-3 p-1 rounded-full bg-blue-500 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                </div>
                {children}
            </div>
        </Draggable>
    );
}
