"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  AnchoredThreads,
  FloatingComposer,
  FloatingThreads,
  FloatingToolbar,
  useLiveblocksExtension,
} from "@liveblocks/react-tiptap";
import { useThreads, useUpdateMyPresence } from "@liveblocks/react";
import { LiveCursors } from "./LiveCursors";
import { EditorView } from "@tiptap/pm/view";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Table as TableIcon,
  Undo,
  Redo,
  MessageSquare,
} from "lucide-react";

// Prevents a matchesNode error on hot reloading
if (typeof window !== "undefined" && EditorView.prototype) {
  // @ts-ignore
  EditorView.prototype.updateState = function updateState(state: any) {
    // @ts-ignore
    if (!this.docView) return;
    // @ts-ignore
    this.updateStateInner(state, this.state.plugins != state.plugins);
  };
}

interface EditorProps {
  initialContent?: any;
  rawHtml?: string;
  onContentChange?: (content: any, plainText: string) => void;
  editable?: boolean;
}

function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function subscribe(callback: () => void) {
  const query = window.matchMedia("(max-width: 1279px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1279px)").matches;
}

function Threads({ editor }: { editor: any }) {
  const { threads } = useThreads();
  const isMobile = useIsMobile();

  if (!threads || !editor) {
    return null;
  }

  if (isMobile) {
    return <FloatingThreads threads={threads} editor={editor} />;
  }

  return (
    <div className="w-[350px] shrink-0 ml-8 sticky top-16 self-start">
      {threads.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs text-left">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span>No comments yet</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Create an inline comment by highlighting any text in the document and clicking the{" "}
            <strong className="text-slate-700">Comment</strong> button in the floating toolbar.
          </p>
        </div>
      ) : (
        <AnchoredThreads threads={threads} editor={editor} style={{ width: 350 }} />
      )}
    </div>
  );
}

export function TipTapEditor({
  initialContent,
  rawHtml,
  onContentChange,
  editable = true,
}: EditorProps) {
  const isInternalChange = useRef(false);
  const liveblocks = useLiveblocksExtension();
  const updateMyPresence = useUpdateMyPresence();
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    updateMyPresence({
      cursor: {
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
      },
    });
  };

  const handlePointerLeave = () => {
    updateMyPresence({ cursor: null });
  };

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    editorProps: {
      attributes: {
        class: "tiptap outline-none min-h-[850px] focus:outline-none",
      },
    },
    extensions: [
      liveblocks,
      StarterKit.configure({
        undoRedo: false, // Liveblocks handles collaborative history
        blockquote: {
          HTMLAttributes: {
            class: "tiptap-blockquote",
          },
        },
        code: {
          HTMLAttributes: {
            class: "tiptap-code",
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: "tiptap-code-block",
          },
        },
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: "tiptap-heading",
          },
        },
        horizontalRule: {
          HTMLAttributes: {
            class: "tiptap-hr",
          },
        },
        listItem: {
          HTMLAttributes: {
            class: "tiptap-list-item",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "tiptap-ordered-list",
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: "tiptap-paragraph",
          },
        },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: "Start typing your document…",
        emptyEditorClass: "tiptap-empty",
      }),
    ],
    content: rawHtml || initialContent || "",
    onUpdate: ({ editor }) => {
      isInternalChange.current = true;
      updateMyPresence({ isTyping: true });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        updateMyPresence({ isTyping: false });
      }, 1000);

      if (onContentChange) {
        onContentChange(editor.getJSON(), editor.getText());
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (rawHtml) {
      editor.commands.setContent(rawHtml);
    } else if (initialContent && !isInternalChange.current) {
      editor.commands.setContent(initialContent);
    }
  }, [rawHtml, initialContent, editor]);

  if (!editor) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        Loading editor toolbar and collaborative canvas...
      </div>
    );
  }

  const btnClass = (active: boolean) =>
    `p-1.5 rounded transition hover:bg-slate-200 text-slate-700 ${
      active ? "bg-blue-100 text-blue-600 font-semibold" : ""
    }`;

  return (
    <div className="flex flex-col w-full bg-slate-50 min-h-screen relative">
      {/* Sticky Formatting Toolbar */}
      {editable && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-2 shadow-xs">
          <div className="flex items-center space-x-1 border-r border-slate-200 pr-2">
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className={`${btnClass(false)} disabled:opacity-40`}
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className={`${btnClass(false)} disabled:opacity-40`}
              title="Redo"
            >
              <Redo className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1 border-r border-slate-200 pr-2">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={btnClass(editor.isActive("heading", { level: 1 }))}
              title="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={btnClass(editor.isActive("heading", { level: 2 }))}
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={btnClass(editor.isActive("heading", { level: 3 }))}
              title="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1 border-r border-slate-200 pr-2">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={btnClass(editor.isActive("bold"))}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={btnClass(editor.isActive("italic"))}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={btnClass(editor.isActive("underline"))}
              title="Underline"
            >
              <UnderlineIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={btnClass(editor.isActive("strike"))}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={btnClass(editor.isActive("code"))}
              title="Inline Code"
            >
              <Code className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              className={btnClass(editor.isActive("highlight"))}
              title="Highlight"
            >
              <Highlighter className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1 border-r border-slate-200 pr-2">
            <button
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className={btnClass(editor.isActive({ textAlign: "left" }))}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              className={btnClass(editor.isActive({ textAlign: "center" }))}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              className={btnClass(editor.isActive({ textAlign: "right" }))}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1 border-r border-slate-200 pr-2">
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={btnClass(editor.isActive("bulletList"))}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={btnClass(editor.isActive("orderedList"))}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={btnClass(editor.isActive("blockquote"))}
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              className={btnClass(false)}
              title="Insert 3x3 Table"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Toolbar on Text Selection */}
      <FloatingToolbar editor={editor} />

      {/* Main Document & Anchored Comments Layout */}
      <div className="flex-1 py-10 px-4 flex justify-center items-start">
        <div className="relative flex justify-center items-start w-full max-w-[1280px]">
          {/* Document Sheet Canvas */}
          <div
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            className="relative w-full max-w-[850px] min-h-[1050px] bg-white rounded-lg shadow-md border border-slate-200/80 px-16 py-14"
          >
            {/* Real-time Multiplayer Cursors */}
            <LiveCursors />

            <EditorContent editor={editor} />
            {/* Floating Composer appears beside highlighted text */}
            <FloatingComposer editor={editor} style={{ width: 350 }} />
          </div>

          {/* Threads: Anchored on desktop beside document sheet, floating on mobile */}
          <Threads editor={editor} />
        </div>
      </div>
    </div>
  );
}
