"use client";

import { ReactNode } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
} from "@liveblocks/react";

import { useAuth, useUser } from "@clerk/nextjs";

interface LiveblocksWrapperProps {
  children: ReactNode;
  roomId: string;
}

export function LiveblocksWrapper({ children, roomId }: LiveblocksWrapperProps) {
  const { getToken } = useAuth();
  const { user } = useUser();

  const authEndpoint = async (room?: string) => {
    const token = await getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      if (user?.primaryEmailAddress?.emailAddress) {
        headers["x-user-email"] = user.primaryEmailAddress.emailAddress;
      }
      if (user?.fullName) {
        headers["x-user-name"] = user.fullName;
      }
      if (user?.imageUrl) {
        headers["x-user-avatar"] = user.imageUrl;
      }
    } else {
      headers["x-dev-user-id"] = user?.id || "dev_editor";
      headers["x-dev-user-email"] = user?.primaryEmailAddress?.emailAddress || "editor@gdocs.app";
      headers["x-dev-user-name"] = user?.fullName || "Collaborator";
      if (user?.imageUrl) {
        headers["x-user-avatar"] = user.imageUrl;
      }
    }

    const res = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers,
      body: JSON.stringify({ room }),
    });
    return await res.json();
  };

  const resolveUsers = async ({ userIds }: { userIds: string[] }) => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `/api/liveblocks-auth/resolve-users?ids=${encodeURIComponent(userIds.join(","))}`,
        { headers }
      );
      if (res.ok) {
        const users = await res.json();
        return userIds.map((id, index) => {
          if (user && (id === user.id || id === "dev_editor")) {
            return {
              name: user.fullName || user.primaryEmailAddress?.emailAddress || "You",
              avatar:
                user.imageUrl ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName || user.id)}`,
            };
          }
          return (
            users[index] || {
              name: "Collaborator",
              avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`,
            }
          );
        });
      }
    } catch (err) {
      console.error("[Liveblocks] Error resolving users:", err);
    }

    return userIds.map((id) => {
      if (user && (id === user.id || id === "dev_editor")) {
        return {
          name: user.fullName || user.primaryEmailAddress?.emailAddress || "You",
          avatar:
            user.imageUrl ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName || user.id)}`,
        };
      }
      return {
        name: "Collaborator",
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`,
      };
    });
  };

  const resolveMentionSuggestions = async ({ text }: { text: string; roomId: string }) => {
    try {
      const res = await fetch(
        `/api/liveblocks-auth/mention-suggestions?text=${encodeURIComponent(text)}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("[Liveblocks] Error resolving mentions:", err);
    }
    return [];
  };

  return (
    <LiveblocksProvider
      authEndpoint={authEndpoint}
      resolveUsers={resolveUsers}
      resolveMentionSuggestions={resolveMentionSuggestions}
    >
      <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
        <ClientSideSuspense fallback={<div className="p-8 text-center text-slate-500">Connecting to collaborative room...</div>}>
          {() => children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
