import { ConvexError, v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from "./_generated/server";
import { api, internal } from "../convex/_generated/api";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";
import { access } from "fs";
import { embed } from "./notes";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
});

// main();

// import { mutation } from "./_generated/server";

export const getChatsForDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  async handler(ctx, args) {
    const userId = (await ctx.auth.getUserIdentity())
      ?.tokenIdentifier;
    if (!userId) {
      return [];
    }
    return await ctx.db
      .query("chats")
      .withIndex("by_documentId_tokenIdentifier", (q) =>
        q
          .eq("documentId", args.documentId)
          .eq("tokenIdentifier", userId)
      )
      .collect();
  },
});

export const hasAccessToDocumentQuery = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  async handler(ctx, args) {
    return await hasAccessToDocument(ctx, args.documentId);
  },
});

export async function hasAccessToDocument(
  ctx: MutationCtx | QueryCtx,
  documentId: Id<"documents">
) {
  const userID = (await ctx.auth.getUserIdentity())
    ?.tokenIdentifier;

  if (!userID) {
    return null;
  }
  const document = await ctx.db.get(documentId);

  if (!document) {
    return null;
  }
  return { document, userID };
}

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const getDocuments = query({
  handler: async (ctx) => {
    const userID = (await ctx.auth.getUserIdentity())
      ?.tokenIdentifier;

    // console.log(userID);

    if (!userID) {
      return [];
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_documentId_token_identifier", (q) =>
        q.eq("tokenIdentifier", userID)
      )
      .collect();
  },
});
export const getDocument = query({
  args: {
    documentId: v.id("documents"),
  },

  handler: async (ctx, args) => {
    const accessObj = await hasAccessToDocument(
      ctx,
      args.documentId
    );

    if (!accessObj) {
      return null;
    }

    return {
      ...accessObj.document,
      documentUrl: await ctx.storage.getUrl(
        accessObj.document.fileId
      ),
    };
  },
});

// Create a new task with the given text
export const createDocument = mutation({
  args: { title: v.string(), fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userID = (await ctx.auth.getUserIdentity())
      ?.tokenIdentifier;

    if (!userID) {
      throw new ConvexError("Unauthorized");
    }
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      fileId: args.fileId,
      tokenIdentifier: userID,
      description: "",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.documents.generateDocumentDescription,
      {
        fileId: args.fileId,
        documentId,
      }
    );
  },
});

export const askQuestion = action({
  args: {
    question: v.string(),
    documentId: v.id("documents"),
  },

  handler: async (ctx, args) => {
    const accessObj = await ctx.runQuery(
      internal.documents.hasAccessToDocumentQuery,
      { documentId: args.documentId }
    );

    if (!accessObj) {
      throw new ConvexError(
        "You o not have access to this document"
      );
    }

    let text_answer = "";
    if (accessObj.document && "fileId" in accessObj.document) {
      const file = await ctx.storage.get(
        accessObj.document.fileId
      );
      const text = await file?.text();
      if (text) {
        text_answer = text;
        console.log(text_answer);
      }
    }

    const chatCompletion: OpenAI.Chat.Completions.ChatCompletion =
      await client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `Here is a text file: ${text_answer}`,
          },

          {
            role: "user",
            content: `Please answer this question ${args.question}`,
          },
        ],
        model: "gpt-3.5-turbo",
      });
    await ctx.runMutation(internal.chats.createChatRecord, {
      documentId: args.documentId,
      text: args.question,
      isHuman: true,
      tokenIdentifier: accessObj.userID,
    });

    const response =
      chatCompletion.choices[0].message.content ??
      "Could not generate response";

    await ctx.runMutation(internal.chats.createChatRecord, {
      documentId: args.documentId,
      text: response,
      isHuman: false,
      tokenIdentifier: accessObj.userID,
    });

    console.log(response);
    return response;
  },
});

export const generateDocumentDescription = internalAction({
  args: {
    fileId: v.id("_storage"),
    documentId: v.id("documents"),
  },

  handler: async (ctx, args) => {
    const file = await ctx.storage.get(args.fileId);

    if (!file) {
      throw new ConvexError("File not found");
    }

    const text = await file?.text();

    const chatCompletion: OpenAI.Chat.Completions.ChatCompletion =
      await client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `Here is a text file: ${text}`,
          },

          {
            role: "user",
            content:
              "please generate 1 sentence description for this document",
          },
        ],
        model: "gpt-3.5-turbo",
      });

    const description =
      chatCompletion.choices[0].message.content ??
      "Could not figure out the description for this document";
    const embedding = await embed(description);

    await ctx.runMutation(
      internal.documents.updateDocumentDescription,
      {
        documentId: args.documentId,
        description: description,
        embedding,
      }
    );
    // console.log(response);
    // return response;
  },
});

export const updateDocumentDescription = internalMutation({
  args: {
    documentId: v.id("documents"),
    description: v.string(),
    embedding: v.array(v.float64()),
  },

  async handler(ctx, args) {
    await ctx.db.patch(args.documentId, {
      description: args.description,
      embedding:args.embedding
    });
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
  },

  handler: async (ctx, args) => {
    const accessObj = await hasAccessToDocument(
      ctx,
      args.documentId
    );

    if (!accessObj) {
      throw new ConvexError(
        "You do not have access to this document"
      );
    }
    await ctx.storage.delete(accessObj.document.fileId);
    await ctx.db.delete(args.documentId);
  },
});
