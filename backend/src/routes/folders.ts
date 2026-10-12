import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

const folderSchema = z.object({
  name: z.string().min(1),
});

// GET /api/folders - List user folders with document counts
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return res.json({ folders });
  } catch (error) {
    console.error("[Folders List] Error:", error);
    return res.status(500).json({ error: "Failed to fetch folders" });
  }
});

// POST /api/folders - Create new folder
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const validated = folderSchema.parse(req.body);

    const folder = await prisma.folder.create({
      data: {
        name: validated.name,
        userId: user.id,
      },
    });

    return res.status(201).json({ folder });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    console.error("[Folder Create] Error:", error);
    return res.status(500).json({ error: "Failed to create folder" });
  }
});

// PATCH /api/folders/:id - Rename folder
router.patch("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = req.params.id as string;
    const validated = folderSchema.parse(req.body);

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== user.id) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { name: validated.name },
    });

    return res.json({ folder: updated });
  } catch (error) {
    console.error("[Folder Update] Error:", error);
    return res.status(500).json({ error: "Failed to update folder" });
  }
});

// DELETE /api/folders/:id - Delete folder
router.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = req.params.id as string;

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== user.id) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Set folderId of documents in this folder to null
    await prisma.document.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });

    await prisma.folder.delete({ where: { id } });

    return res.json({ success: true, message: "Folder deleted" });
  } catch (error) {
    console.error("[Folder Delete] Error:", error);
    return res.status(500).json({ error: "Failed to delete folder" });
  }
});

export default router;
