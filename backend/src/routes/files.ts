import { Router, Response } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { Document as DocxDocument, Paragraph, TextRun, HeadingLevel, Packer } from "docx";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma.js";
import { uploadToSupabaseStorage } from "../lib/storage.js";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

function htmlToTipTapJSON(html: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: html.replace(/<[^>]+>/g, " ").trim(),
          },
        ],
      },
    ],
  };
}

// POST /api/files/convert - Upload .txt, .md, or .docx and convert to new editable document or draft
router.post(
  "/convert",
  authMiddleware,
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const file = req.file;
      const { createDocument = "true", folderId, title: customTitle } = req.body;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const originalName = file.originalname;
      const ext = originalName.split(".").pop()?.toLowerCase();
      let htmlContent = "";
      let plainText = "";

      if (ext === "docx") {
        const result = await mammoth.convertToHtml({ buffer: file.buffer });
        htmlContent = result.value;
        const textResult = await mammoth.extractRawText({ buffer: file.buffer });
        plainText = textResult.value;
      } else if (ext === "md" || ext === "txt") {
        plainText = file.buffer.toString("utf-8");
        // Simple Markdown paragraph wrapping
        htmlContent = plainText
          .split("\n\n")
          .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
          .join("");
      } else {
        return res.status(400).json({
          error: "Unsupported file type. Please upload a .docx, .md, or .txt file.",
        });
      }

      const docTitle =
        customTitle ||
        originalName.replace(/\.[^/.]+$/, "") ||
        "Imported Document";

      // If user requested to immediately create a new document
      if (createDocument === "true") {
        const doc = await prisma.document.create({
          data: {
            title: docTitle,
            plainText,
            content: {
              rawHtml: htmlContent,
            },
            ownerId: user.id,
            folderId: folderId || null,
          },
          include: {
            owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
            folder: true,
          },
        });

        return res.status(201).json({
          document: doc,
          htmlContent,
          plainText,
          message: "Document created successfully from file",
        });
      }

      // Otherwise return parsed content to be imported into an existing draft
      return res.json({
        title: docTitle,
        htmlContent,
        plainText,
        message: "File converted successfully",
      });
    } catch (error) {
      console.error("[File Convert] Error:", error);
      return res.status(500).json({ error: "Failed to convert file" });
    }
  }
);

// POST /api/files/attachment - Upload an attachment associated with a document
router.post(
  "/attachment",
  authMiddleware,
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const file = req.file;
      const { documentId } = req.body;

      if (!file || !documentId) {
        return res.status(400).json({ error: "File and documentId are required" });
      }

      // Check document access
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { collaborators: true },
      });

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const isOwner = doc.ownerId === user.id;
      const collab = doc.collaborators.find((c) => c.userId === user.id);

      if (!isOwner && (!collab || collab.role === "VIEWER")) {
        return res.status(403).json({ error: "Forbidden: You cannot attach files to this document" });
      }

      // Store in Supabase Blob Storage, fallback to base64 dataUri if Supabase key is not configured
      const storagePath = `${documentId}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const publicUrl = await uploadToSupabaseStorage({
        path: storagePath,
        buffer: file.buffer,
        contentType: file.mimetype,
      });

      const fileUrl = publicUrl || `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

      const attachment = await prisma.attachment.create({
        data: {
          documentId,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileUrl,
        },
      });

      return res.status(201).json({
        attachment: {
          id: attachment.id,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          createdAt: attachment.createdAt,
          fileUrl: attachment.fileUrl,
        },
      });
    } catch (error) {
      console.error("[Upload Attachment] Error:", error);
      return res.status(500).json({ error: "Failed to upload attachment" });
    }
  }
);

// GET /api/files/attachments/:documentId - List attachments for a document
router.get(
  "/attachments/:documentId",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const documentId = req.params.documentId as string;

      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { collaborators: true },
      });

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const isOwner = doc.ownerId === user.id;
      const collab = doc.collaborators.find((c: any) => c.userId === user.id);

      if (!isOwner && !collab) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      const attachments = await prisma.attachment.findMany({
        where: { documentId },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          fileUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json({ attachments });
    } catch (error) {
      console.error("[Get Attachments] Error:", error);
      return res.status(500).json({ error: "Failed to fetch attachments" });
    }
  }
);

// DELETE /api/files/attachments/:attachmentId - Delete an attachment
router.delete(
  "/attachments/:attachmentId",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const attachmentId = req.params.attachmentId as string;

      const attachment = await prisma.attachment.findUnique({
        where: { id: attachmentId },
        include: { document: { include: { collaborators: true } } },
      });

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const isOwner = attachment.document.ownerId === user.id;
      const collab = attachment.document.collaborators.find((c: any) => c.userId === user.id);
      const canEdit = isOwner || collab?.role === "EDITOR";

      if (!canEdit) {
        return res.status(403).json({ error: "Forbidden: Cannot delete attachment" });
      }

      await prisma.attachment.delete({ where: { id: attachmentId } });
      return res.json({ success: true, message: "Attachment deleted" });
    } catch (error) {
      console.error("[Delete Attachment] Error:", error);
      return res.status(500).json({ error: "Failed to delete attachment" });
    }
  }
);

// Helper: Convert TipTap JSON to clean Markdown
function convertTipTapToMarkdown(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (!content.content || !Array.isArray(content.content)) return "";

  const renderNode = (node: any): string => {
    if (!node) return "";
    switch (node.type) {
      case "heading": {
        const level = node.attrs?.level || 1;
        const prefix = "#".repeat(level) + " ";
        const text = (node.content || []).map(renderNode).join("");
        return `${prefix}${text}\n\n`;
      }
      case "paragraph": {
        const text = (node.content || []).map(renderNode).join("");
        return `${text}\n\n`;
      }
      case "text": {
        let text = node.text || "";
        if (node.marks && Array.isArray(node.marks)) {
          for (const mark of node.marks) {
            if (mark.type === "bold") text = `**${text}**`;
            if (mark.type === "italic") text = `*${text}*`;
            if (mark.type === "strike") text = `~~${text}~~`;
            if (mark.type === "code") text = `\`${text}\``;
          }
        }
        return text;
      }
      case "bulletList": {
        return (
          (node.content || [])
            .map((item: any) => `- ${(item.content || []).map(renderNode).join("").trim()}`)
            .join("\n") + "\n\n"
        );
      }
      case "orderedList": {
        return (
          (node.content || [])
            .map(
              (item: any, idx: number) =>
                `${idx + 1}. ${(item.content || []).map(renderNode).join("").trim()}`
            )
            .join("\n") + "\n\n"
        );
      }
      case "blockquote": {
        const text = (node.content || []).map(renderNode).join("").trim();
        return `> ${text}\n\n`;
      }
      case "codeBlock": {
        const text = (node.content || []).map(renderNode).join("");
        return `\`\`\`\n${text}\n\`\`\`\n\n`;
      }
      default: {
        if (node.content && Array.isArray(node.content)) {
          return node.content.map(renderNode).join("");
        }
        return "";
      }
    }
  };

  return content.content.map(renderNode).join("").trim();
}

// Helper: Convert TipTap JSON to DOCX Buffer
async function convertTipTapToDocx(title: string, content: any): Promise<Buffer> {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 280 },
    }),
  ];

  if (content && Array.isArray(content.content)) {
    for (const node of content.content) {
      if (node.type === "heading") {
        const text = (node.content || []).map((c: any) => c.text || "").join("");
        const level =
          node.attrs?.level === 1
            ? HeadingLevel.HEADING_1
            : node.attrs?.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
        paragraphs.push(
          new Paragraph({ text, heading: level, spacing: { before: 200, after: 120 } })
        );
      } else if (node.type === "paragraph") {
        const runs: TextRun[] = [];
        for (const child of node.content || []) {
          if (child.type === "text") {
            const isBold = child.marks?.some((m: any) => m.type === "bold");
            const isItalic = child.marks?.some((m: any) => m.type === "italic");
            const isStrike = child.marks?.some((m: any) => m.type === "strike");
            runs.push(
              new TextRun({
                text: child.text || "",
                bold: isBold,
                italics: isItalic,
                strike: isStrike,
              })
            );
          }
        }
        paragraphs.push(
          new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun("")],
            spacing: { after: 140 },
          })
        );
      } else if (node.type === "bulletList") {
        for (const item of node.content || []) {
          const itemText = (item.content || [])
            .flatMap((c: any) => c.content || [])
            .map((t: any) => t.text || "")
            .join("");
          paragraphs.push(
            new Paragraph({ text: itemText, bullet: { level: 0 }, spacing: { after: 80 } })
          );
        }
      } else if (node.type === "orderedList") {
        let index = 1;
        for (const item of node.content || []) {
          const itemText = (item.content || [])
            .flatMap((c: any) => c.content || [])
            .map((t: any) => t.text || "")
            .join("");
          paragraphs.push(
            new Paragraph({
              text: `${index++}. ${itemText}`,
              spacing: { after: 80 },
            })
          );
        }
      }
    }
  }

  const doc = new DocxDocument({
    sections: [{ children: paragraphs }],
  });

  return await Packer.toBuffer(doc);
}

// Helper: Convert TipTap JSON to PDF Buffer
function convertTipTapToPdf(title: string, content: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: any) => reject(err));

    doc.fontSize(24).font("Helvetica-Bold").text(title, { align: "left" });
    doc.moveDown(0.8);

    if (content && Array.isArray(content.content)) {
      for (const node of content.content) {
        if (node.type === "heading") {
          const text = (node.content || []).map((c: any) => c.text || "").join("");
          const size = node.attrs?.level === 1 ? 16 : node.attrs?.level === 2 ? 14 : 12;
          doc.moveDown(0.6);
          doc.fontSize(size).font("Helvetica-Bold").text(text);
          doc.moveDown(0.2);
        } else if (node.type === "paragraph") {
          const text = (node.content || []).map((c: any) => c.text || "").join("");
          doc.fontSize(10).font("Helvetica").text(text, { lineGap: 3 });
          doc.moveDown(0.4);
        } else if (node.type === "bulletList") {
          for (const item of node.content || []) {
            const itemText = (item.content || [])
              .flatMap((c: any) => c.content || [])
              .map((t: any) => t.text || "")
              .join("");
            doc.fontSize(10).font("Helvetica").text(`•  ${itemText}`, { indent: 15, lineGap: 2 });
          }
          doc.moveDown(0.4);
        } else if (node.type === "orderedList") {
          let idx = 1;
          for (const item of node.content || []) {
            const itemText = (item.content || [])
              .flatMap((c: any) => c.content || [])
              .map((t: any) => t.text || "")
              .join("");
            doc
              .fontSize(10)
              .font("Helvetica")
              .text(`${idx++}.  ${itemText}`, { indent: 15, lineGap: 2 });
          }
          doc.moveDown(0.4);
        }
      }
    }

    doc.end();
  });
}

// POST /api/files/export - Export document in PDF, DOCX, or Markdown format
router.post("/export", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId, format = "md", title: customTitle, content: customContent } = req.body;

    let docTitle = customTitle || "Document";
    let docContent = customContent;

    if (documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
      });
      if (doc) {
        if (!customTitle) docTitle = doc.title;
        if (!customContent) docContent = doc.content;
      }
    }

    const safeTitle = docTitle.replace(/[/\\?%*:|"<>]/g, "_");

    if (format === "docx") {
      const docxBuffer = await convertTipTapToDocx(docTitle, docContent);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.docx"`);
      return res.send(docxBuffer);
    }

    if (format === "pdf") {
      const pdfBuffer = await convertTipTapToPdf(docTitle, docContent);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
      return res.send(pdfBuffer);
    }

    // Default: Markdown format
    const markdown = convertTipTapToMarkdown(docContent) || `# ${docTitle}\n\n`;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.md"`);
    return res.send(markdown);
  } catch (error) {
    console.error("[Export Document] Error:", error);
    return res.status(500).json({ error: "Failed to export document" });
  }
});

export default router;
