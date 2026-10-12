import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendCollaborationInviteEmail, sendPendingDocumentsSummaryEmail } from "../lib/mailer.js";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/invitations/search-users?q=email - Search users by email or name
router.get("/search-users", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { q } = req.query;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: user.id } },
          {
            OR: [
              { email: { contains: q.trim(), mode: "insensitive" } },
              { name: { contains: q.trim(), mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
      take: 10,
    });

    return res.json({ users });
  } catch (error) {
    console.error("[Search Users] Error:", error);
    return res.status(500).json({ error: "Failed to search users" });
  }
});

// GET /api/invitations/pending - Get pending invites for current user
router.get("/pending", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    const invites = await prisma.invitation.findMany({
      where: {
        email: { equals: user.email, mode: "insensitive" },
        status: "PENDING",
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ invitations: invites });
  } catch (error) {
    console.error("[Pending Invites] Error:", error);
    return res.status(500).json({ error: "Failed to fetch pending invitations" });
  }
});

const inviteSchema = z.object({
  documentId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["VIEWER", "COMMENTER", "EDITOR"]).default("VIEWER"),
});

// POST /api/invitations - Invite a user (registered or unregistered)
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const validated = inviteSchema.parse(req.body);
    const targetEmail = validated.email.trim().toLowerCase();

    // Check document ownership or editor access
    const doc = await prisma.document.findUnique({
      where: { id: validated.documentId },
      include: {
        owner: true,
        collaborators: true,
      },
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const isOwner = doc.ownerId === user.id;
    const isEditor = doc.collaborators.some(
      (c) => c.userId === user.id && (c.role === "EDITOR" || c.role === "OWNER")
    );

    if (!isOwner && !isEditor) {
      return res.status(403).json({ error: "Only owners and editors can invite collaborators" });
    }

    if (targetEmail === user.email.toLowerCase()) {
      return res.status(400).json({ error: "You cannot invite yourself" });
    }

    // Check if target is already a collaborator
    const existingUser = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    if (existingUser) {
      const alreadyCollab = doc.collaborators.find((c) => c.userId === existingUser.id);
      if (alreadyCollab) {
        return res.status(400).json({ error: "User is already a collaborator on this document" });
      }
    }

    // Upsert invitation
    let invitation = await prisma.invitation.findFirst({
      where: {
        documentId: validated.documentId,
        email: targetEmail,
        status: "PENDING",
      },
    });

    if (invitation) {
      invitation = await prisma.invitation.update({
        where: { id: invitation.id },
        data: { role: validated.role },
      });
    } else {
      invitation = await prisma.invitation.create({
        data: {
          documentId: validated.documentId,
          inviterId: user.id,
          email: targetEmail,
          inviteeId: existingUser ? existingUser.id : null,
          role: validated.role,
        },
      });
    }

    // Dispatch invitation email
    const emailResult = await sendCollaborationInviteEmail({
      to: targetEmail,
      inviterName: user.name || user.email,
      documentTitle: doc.title,
      role: validated.role,
      inviteToken: invitation.token,
      isRegisteredUser: !!existingUser,
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const inviteUrl = `${frontendUrl}/documents/invite?token=${invitation.token}`;

    return res.status(201).json({
      success: true,
      invitation,
      inviteUrl,
      emailDelivery: emailResult,
      message: existingUser
        ? `Invitation created for ${targetEmail}. Direct invite link is ready.`
        : `Invitation created for unregistered user ${targetEmail}. Direct invite link is ready.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    console.error("[Create Invitation] Error:", error);
    return res.status(500).json({ error: "Failed to send invitation" });
  }
});

// POST /api/invitations/:token/accept - Accept invitation
router.post("/:token/accept", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const token = req.params.token as string;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { document: true },
    });

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or invalid" });
    }

    if (invitation.status === "ACCEPTED") {
      return res.json({
        success: true,
        documentId: invitation.documentId,
        message: "Invitation already accepted",
      });
    }

    // Verify email match (case-insensitive)
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({
        error: "This invitation was sent to a different email address",
      });
    }

    // Upsert collaborator record
    await prisma.collaborator.upsert({
      where: {
        documentId_userId: {
          documentId: invitation.documentId,
          userId: user.id,
        },
      },
      update: {
        role: invitation.role,
      },
      create: {
        documentId: invitation.documentId,
        userId: user.id,
        role: invitation.role,
      },
    });

    // Mark invitation ACCEPTED
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        inviteeId: user.id,
      },
    });

    return res.json({
      success: true,
      documentId: invitation.documentId,
      message: "Invitation accepted successfully",
    });
  } catch (error) {
    console.error("[Accept Invitation] Error:", error);
    return res.status(500).json({ error: "Failed to accept invitation" });
  }
});

// POST /api/invitations/:token/decline - Decline invitation
router.post("/:token/decline", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const token = req.params.token as string;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ error: "This invitation was sent to another email" });
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "DECLINED" },
    });

    return res.json({ success: true, message: "Invitation declined" });
  } catch (error) {
    console.error("[Decline Invitation] Error:", error);
    return res.status(500).json({ error: "Failed to decline invitation" });
  }
});

// POST /api/invitations/on-signup - Triggered on new user registration to link pending invites & send summary mail
router.post("/on-signup", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    // Find any pending invitations for this user's email
    const pendingInvites = await prisma.invitation.findMany({
      where: {
        email: { equals: user.email, mode: "insensitive" },
        status: "PENDING",
      },
      include: {
        document: { select: { title: true } },
        inviter: { select: { name: true, email: true } },
      },
    });

    if (pendingInvites.length > 0) {
      // Associate inviteeId
      await prisma.invitation.updateMany({
        where: {
          email: { equals: user.email, mode: "insensitive" },
          status: "PENDING",
        },
        data: { inviteeId: user.id },
      });

      // Send summary email
      await sendPendingDocumentsSummaryEmail({
        to: user.email,
        userName: user.name || user.email.split("@")[0],
        pendingDocuments: pendingInvites.map((inv) => ({
          title: inv.document.title,
          inviterName: inv.inviter.name || inv.inviter.email,
          role: inv.role,
          token: inv.token,
        })),
      });
    }

    return res.json({
      success: true,
      count: pendingInvites.length,
      message: `Checked pending invitations. Found ${pendingInvites.length}.`,
    });
  } catch (error) {
    console.error("[On Signup Check] Error:", error);
    return res.status(500).json({ error: "Failed to process signup invitations check" });
  }
});

export default router;
