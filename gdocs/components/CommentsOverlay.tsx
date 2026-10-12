"use client";

import { useThreads } from "@liveblocks/react";
import { Thread, Composer } from "@liveblocks/react-ui";
import { MessageSquare, X } from "lucide-react";

interface CommentsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommentsOverlay({ isOpen, onClose }: CommentsOverlayProps) {
  const { threads } = useThreads();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Comments & Discussions</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* New comment composer */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <p className="text-xs font-semibold text-slate-600 mb-2">Leave a comment or reaction</p>
        <Composer />
      </div>

      {/* Threads list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!threads || threads.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500">No comments yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Type above to start a discussion thread or reply to collaborators.
            </p>
          </div>
        ) : (
          threads.map((thread) => (
            <div
              key={thread.id}
              className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
            >
              <Thread thread={thread} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
