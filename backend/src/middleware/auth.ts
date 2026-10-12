import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { prisma } from "../lib/prisma.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    let token = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.__session) {
      token = req.cookies.__session;
    }

    if (!token) {
      // In development, support mock / test user header if clerk token is missing
      const devUserId = req.headers["x-dev-user-id"] as string;
      const devUserEmail = req.headers["x-dev-user-email"] as string;

      if (process.env.NODE_ENV !== "production" && devUserId && devUserEmail) {
        let user = await prisma.user.findUnique({ where: { id: devUserId } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              id: devUserId,
              email: devUserEmail,
              name: (req.headers["x-dev-user-name"] as string) || devUserEmail.split("@")[0],
            },
          });
        }
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          avatarUrl: user.avatarUrl ?? undefined,
        };
        return next();
      }

      return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    }

    // Verify token with Clerk
    const secretKey = process.env.CLERK_SECRET_KEY;
    const verified = await verifyToken(token, {
      secretKey,
    });

    if (!verified || !verified.sub) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const userId = verified.sub;
    // Extract email from verified payload or find user in DB
    const claims = verified as Record<string, any>;
    let email = claims.email || claims.email_address || claims.primary_email_address || (req.headers["x-user-email"] as string) || "";
    let name = claims.name || claims.first_name || (req.headers["x-user-name"] as string) || (email ? email.split("@")[0] : `User_${userId.slice(-6)}`);
    let avatar = claims.image_url || claims.picture || (req.headers["x-user-avatar"] as string) || "";

    let dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: userId,
          email: email || `${userId}@user.clerk`,
          name: name || "Collaborator",
          avatarUrl: avatar || null,
        },
      });
    } else if (
      (name && (!dbUser.name || dbUser.name === "Collaborator" || dbUser.name !== name)) ||
      (avatar && dbUser.avatarUrl !== avatar)
    ) {
      dbUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name && { name }),
          ...(avatar && { avatarUrl: avatar }),
        },
      });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name ?? undefined,
      avatarUrl: dbUser.avatarUrl ?? undefined,
    };

    next();
  } catch (error) {
    console.error("[Auth Middleware] Verification error:", error);
    return res.status(401).json({ error: "Unauthorized: Token verification failed" });
  }
}
