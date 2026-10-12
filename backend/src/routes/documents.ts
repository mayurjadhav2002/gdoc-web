import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getRedis } from "../lib/redis.js";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

const createDocSchema = z.object({
  title: z.string().min(1).default("Untitled Document"),
  content: z.any().optional(),
  folderId: z.string().optional().nullable(),
});

const updateDocSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.any().optional(),
  plainText: z.string().optional(),
  folderId: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
});

// GET /api/documents - List documents with search, folder filtering, and tab categorization
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { folderId, search, filter = "all", sortBy = "updatedAt", order = "desc" } = req.query;

    const whereClause: any = {};

    if (search && typeof search === "string") {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { plainText: { contains: search, mode: "insensitive" } },
      ];
    }

    if (folderId && typeof folderId === "string") {
      whereClause.folderId = folderId;
    }

    let documents;

    if (filter === "shared") {
      // Shared with user
      documents = await prisma.document.findMany({
        where: {
          ...whereClause,
          collaborators: {
            some: { userId: user.id },
          },
        },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          collaborators: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          folder: true,
        },
        orderBy: { [sortBy as string]: order as "asc" | "desc" },
      });
    } else if (filter === "owned") {
      // Owned by user
      documents = await prisma.document.findMany({
        where: {
          ...whereClause,
          ownerId: user.id,
        },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          collaborators: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          folder: true,
        },
        orderBy: { [sortBy as string]: order as "asc" | "desc" },
      });
    } else {
      // All accessible documents (owned OR collaborated)
      documents = await prisma.document.findMany({
        where: {
          ...whereClause,
          OR: [
            { ownerId: user.id },
            { collaborators: { some: { userId: user.id } } },
          ],
        },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          collaborators: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          folder: true,
        },
        orderBy: { [sortBy as string]: order as "asc" | "desc" },
      });
    }

    return res.json({ documents });
  } catch (error) {
    console.error("[Documents List] Error:", error);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// POST /api/documents - Create new document
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const validated = createDocSchema.parse(req.body);

    const doc = await prisma.document.create({
      data: {
        title: validated.title,
        content: validated.content || null,
        ownerId: user.id,
        folderId: validated.folderId || null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        folder: true,
      },
    });

    return res.status(201).json({ document: doc });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    console.error("[Document Create] Error:", error);
    return res.status(500).json({ error: "Failed to create document" });
  }
});

// GET /api/documents/:id - Get single document with role permission
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = req.params.id as string;

    // Check Redis cache first
    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get(`doc:${id}`);
        if (cached) {
          const doc = JSON.parse(cached);
          const isOwner = doc.ownerId === user.id;
          const collab = doc.collaborators?.find((c: any) => c.userId === user.id);
          if (isOwner || collab) {
            return res.json({
              document: doc,
              role: isOwner ? "OWNER" : collab.role,
            });
          }
        }
      } catch (e) {
        // Cache miss or parse error, fallback to DB
      }
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        collaborators: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        invitations: true,
        attachments: true,
        folder: true,
      },
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const isOwner = doc.ownerId === user.id;
    const collab = doc.collaborators.find((c: any) => c.userId === user.id);

    if (!isOwner && !collab) {
      return res.status(403).json({ error: "Access denied to document" });
    }

    const role = isOwner ? "OWNER" : collab?.role;

    // Cache in Redis for 60 seconds
    if (redis) {
      try {
        await redis.set(`doc:${id}`, JSON.stringify(doc), "EX", 60);
      } catch (e) {}
    }

    return res.json({ document: doc, role });
  } catch (error) {
    console.error("[Document Get] Error:", error);
    return res.status(500).json({ error: "Failed to fetch document" });
  }
});

// PATCH /api/documents/:id - Update document (title, content, folder, etc.)
router.patch("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = req.params.id as string;
    const validated = updateDocSchema.parse(req.body);

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { collaborators: true },
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const isOwner = doc.ownerId === user.id;
    const collab = doc.collaborators.find((c: any) => c.userId === user.id);

    if (!isOwner && (!collab || (collab.role !== "EDITOR" && collab.role !== "OWNER"))) {
      return res.status(403).json({ error: "Forbidden: You do not have edit permission" });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        ...(validated.title !== undefined && { title: validated.title }),
        ...(validated.content !== undefined && { content: validated.content }),
        ...(validated.plainText !== undefined && { plainText: validated.plainText }),
        ...(validated.folderId !== undefined && { folderId: validated.folderId }),
        ...(validated.isArchived !== undefined && { isArchived: validated.isArchived }),
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        folder: true,
      },
    });

    // Invalidate Redis cache
    const redis = getRedis();
    if (redis) {
      try {
        await redis.del(`doc:${id}`);
      } catch (e) {}
    }

    return res.json({ document: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    console.error("[Document Update] Error:", error);
    return res.status(500).json({ error: "Failed to update document" });
  }
});

// DELETE /api/documents/:id - Delete document (owner only)
router.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = req.params.id as string;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (doc.ownerId !== user.id) {
      return res.status(403).json({ error: "Only the owner can delete this document" });
    }

    await prisma.document.delete({ where: { id } });

    const redis = getRedis();
    if (redis) {
      try {
        await redis.del(`doc:${id}`);
      } catch (e) {}
    }

    return res.json({ success: true, message: "Document deleted" });
  } catch (error) {
    console.error("[Document Delete] Error:", error);
    return res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
