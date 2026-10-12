"use client";

import { useOthers } from "@liveblocks/react";

export function LiveCursors() {
  const others = useOthers();

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {others.map(({ connectionId, presence, info }: any) => {
        if (!presence?.cursor) return null;

        const name = info?.name || "Collaborator";
        const color = info?.color || "#2563eb";

        return (
          <div
            key={connectionId}
            className="pointer-events-none absolute transition-transform duration-100 ease-out will-change-transform"
            style={{
              top: 0,
              left: 0,
              transform: `translate(${presence.cursor.x}px, ${presence.cursor.y}px)`,
            }}
          >
            {/* Live Cursor Pointer Arrow */}
            <svg
              className="h-5 w-5 drop-shadow-sm filter"
              viewBox="0 0 24 24"
              fill={color}
              stroke="#ffffff"
              strokeWidth="1.5"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" />
            </svg>

            {/* Collaborator Name Tag */}
            <div
              className="ml-2.5 -mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white shadow-sm flex items-center space-x-1.5 whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              <span>{name}</span>
              {presence.isTyping && (
                <span className="flex space-x-0.5 items-center pl-0.5">
                  <span className="h-1 w-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-1 w-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-1 w-1 bg-white rounded-full animate-bounce"></span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
