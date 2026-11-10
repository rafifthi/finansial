import type { Metadata } from "next";
import { LibraryHome } from "@/components/app/library/library-views";

export const metadata: Metadata = { title: "Library" };

export default function LibraryIndexPage() {
  return <LibraryHome />;
}
