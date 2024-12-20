"use client";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import ChatPanel from "./ChatPanel";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
// import { createDocument } from "@/convex/documetns";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { doesNotMatch } from "assert";
import {
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { Spinner } from "@/app/_componenets/Spinner";
import DeleteButton from "@/app/_componenets/DeleteButton";
import { api } from "@/convex/_generated/api";

export default function DocumentPage({
  params,
}: {
  params: { documentId: Id<"documents"> };
}) {
  // const do1 =  useQuery(api.chats)
  const document = useQuery(api.documents.getDocument, {
    documentId: params.documentId,
  });

  if (!document)
    return (
      <div className="">
        <Spinner className="h-[50vh]" />
      </div>
    );

  return (
    <main className="p-24 space-y-8">
      <div className="flex justify-between items-center ">
        <h1 className="text-2xl font-bold">{document?.title}</h1>
        <DeleteButton documentId={document._id} />
      </div>
      <div className="flex gap-12 ">
        <Tabs
          defaultValue="document"
          className="w-full"
        >
          <TabsList className="mb-2 ">
            <TabsTrigger value="document">Document</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>
          <TabsContent
            value="document"
            className=""
          >
            <div className="bg-gray-800 p-4  flex-1  rounded-xl h-[50vh] ">
              {document.documentUrl && (
                <iframe
                  src={document.documentUrl}
                  className="h-full w-full"
                  // onLoad={(e) => adjustIframeHeight(e)}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="chat">
            <ChatPanel documentId={document._id} />
          </TabsContent>
        </Tabs>

      </div>
    </main>
  );
}

//   const createDocument = useMutation(
//     api.documents.createDocument
//   );
// console.log(document)
