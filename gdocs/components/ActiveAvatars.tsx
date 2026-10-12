"use client";

import { useOthers, useSelf } from "@liveblocks/react";
import { useState } from "react";
import { Users, Eye, Edit3 } from "lucide-react";

export function ActiveAvatars() {
  const others = useOthers();
  const self = useSelf();
  const [showDropdown, setShowDropdown] = useState(false);

  // Collect all collaborators currently active in the room (self + others)
  const allActive = [
    ...(self
      ? [
          {
            connectionId: self.connectionId,
            info: self.info,
            presence: self.presence,
            isSelf: true,
          },
        ]
      : []),
    ...others.map((o: any) => ({
      connectionId: o.connectionId,
      info: o.info,
      presence: o.presence,
      isSelf: false,
    })),
  ];

  const typingUser = others.find((o: any) => o.presence?.isTyping);

  return (
    <div className="relative flex items-center space-x-2">
      {/* Real-time typing or editing indicator banner */}
      {typingUser && (
        <div className="hidden lg:flex items-center space-x-1.5 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-medium animate-pulse">
          <Edit3 className="h-3 w-3" />
          <span>{typingUser.info?.name || "Collaborator"} is editing...</span>
        </div>
      )}

      {/* Avatar Stack Container */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        onMouseEnter={() => setShowDropdown(true)}
        onMouseLeave={() => setShowDropdown(false)}
        className="flex items-center space-x-2 rounded-full p-1 hover:bg-slate-100 transition cursor-pointer"
        title="View active collaborators"
      >
        <div className="flex items-center -space-x-2.5 overflow-hidden">
          {allActive.map((user: any, idx: number) => {
            const name = user.info?.name || (user.isSelf ? "You" : "Collaborator");
            const avatar = user.info?.avatar;
            const color = user.info?.color || (user.isSelf ? "#2563eb" : "#10b981");

            return (
              <div
                key={user.connectionId || idx}
                className="relative inline-block h-7 w-7 rounded-full ring-2 ring-white shadow-xs overflow-hidden shrink-0 group transition-transform hover:scale-110 hover:z-20"
                style={{ backgroundColor: color }}
              >
                {avatar ? (
                  <img src={avatar} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white uppercase">
                    {name.substring(0, 2)}
                  </div>
                )}
                {/* Online indicator dot on each avatar */}
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white bg-green-500" />
              </div>
            );
          })}
        </div>

        {/* Live count badge */}
        <div className="flex items-center space-x-1 pl-1 pr-1.5 text-xs text-slate-600 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-[11px] font-semibold text-slate-700">
            {allActive.length} active
          </span>
        </div>
      </button>

      {/* Collaborators Active Details Popover */}
      {showDropdown && (
        <div
          onMouseEnter={() => setShowDropdown(true)}
          onMouseLeave={() => setShowDropdown(false)}
          className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <span>In this document ({allActive.length})</span>
            </span>
            <span className="text-[10px] text-green-600 font-semibold flex items-center space-x-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
              <span>Live</span>
            </span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {allActive.map((user: any, idx: number) => {
              const name = user.info?.name || (user.isSelf ? "You" : "Collaborator");
              const avatar = user.info?.avatar;
              const color = user.info?.color || (user.isSelf ? "#2563eb" : "#10b981");

              return (
                <div
                  key={user.connectionId || idx}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-100"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <div className="relative shrink-0">
                      <div
                        className="h-7 w-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                        style={{ backgroundColor: color }}
                      >
                        {avatar ? (
                          <img src={avatar} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      {/* Both users in room are Active/Online */}
                      <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 border border-white" />
                    </div>
                    <div className="truncate min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {name} {user.isSelf && <span className="text-blue-600 font-medium">(You)</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {user.info?.email || (user.isSelf ? "Editing now" : "Collaborator")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 pl-2">
                    {/* Live Cursor Color indicator */}
                    <div
                      className="flex items-center space-x-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white shadow-2xs text-[10px] text-slate-500"
                      title={`Their live cursor pointer is rendered in this color`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[9px] font-medium text-slate-500">Cursor</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
