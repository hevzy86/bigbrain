"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
// import { createDocument } from "@/convex/documetns";
import { SignInButton, UserButton } from "@clerk/nextjs";
import {
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import DocumentCard from "@/app/_componenets/DocumentCard";
import CreateDocumentButton from "@/app/_componenets/CreateDocumentButton";

export default function LandingPage() {
  const getDocuments = useQuery(api.documents.getDocuments);
  const createDocument = useMutation(
    api.documents.createDocument
  );

  return <main className="p-24 space-y-8">Lnding Page</main>;
}

{
  /* {getDocuments?.map((doc) => (
  <div key={doc._id}>{doc.title}</div>
))} */
}

{
  /* <button
  onClick={() => {
    createDocument({ title: "hello world" });
  }}
>
  Click Mer{" "}
</button> */
}
