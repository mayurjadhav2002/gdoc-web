import { Router, Response } from "express";
import { Liveblocks } from "@liveblocks/node";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

const liveblocksSecret = process.env.LIVEBLOCK_SECRET_KEY || "";
const liveblocks = new Liveblocks({
  secret: liveblocksSecret,
});

router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { room } = req.body;

    if (!room) {
      return res.status(400).json({ error: "Missing room parameter" });
    }

    // Verify user has access to this room (documentId)
    const doc = await prisma.document.findUnique({
      where: { id: room },
      include: {
        collaborators: true,
      },
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const isOwner = doc.ownerId === user.id;
    const collaborator = doc.collaborators.find((c) => c.userId === user.id);

    if (!isOwner && !collaborator) {
      return res.status(403).json({ error: "Forbidden: You do not have access to this document" });
    }

    // Determine permissions
    const role = isOwner ? "OWNER" : collaborator?.role || "VIEWER";
    const canWrite = role === "OWNER" || role === "EDITOR";

    // Prepare Liveblocks session
    const session = liveblocks.prepareSession(user.id, {
      userInfo: {
        name: user.name || user.email.split("@")[0],
        email: user.email,
        avatar: user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || user.email)}`,
        color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
      },
    });

    // Grant room access with read or full write permission
    if (canWrite) {
      session.allow(room, session.FULL_ACCESS);
    } else {
      session.allow(room, session.READ_ACCESS);
    }

    const { status, body } = await session.authorize();
    return res.status(status).end(body);
  } catch (error) {
    console.error("[Liveblocks Auth] Error:", error);
    return res.status(500).json({ error: "Failed to authorize Liveblocks session" });
  }
});

// Resolve users for Liveblocks Comments & Threads
router.get("/resolve-users", async (req, res) => {
  try {
    const ids = ((req.query.ids as string) || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const result = ids.map((id) => {
      const u = userMap.get(id);
      if (u) {
        return {
          name: u.name || u.email.split("@")[0],
          avatar:
            u.avatarUrl ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name || u.email)}`,
        };
      }
      return {
        name: "Collaborator",
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error("[Liveblocks Resolve Users] Error:", error);
    return res.status(500).json({ error: "Failed to resolve users" });
  }
});

// Resolve mention suggestions for comments
router.get("/mention-suggestions", async (req, res) => {
  try {
    const text = (req.query.text as string) || "";
    const users = await prisma.user.findMany({
      where: text
        ? {
            OR: [
              { name: { contains: text, mode: "insensitive" } },
              { email: { contains: text, mode: "insensitive" } },
            ],
          }
        : undefined,
      take: 10,
      select: { id: true },
    });

    return res.json(users.map((u) => u.id));
  } catch (error) {
    console.error("[Liveblocks Mention Suggestions] Error:", error);
    return res.json([]);
  }
});

export default router;
