import type { Metadata } from "next";
import { MoreScreen } from "@/components/app/more-screen";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return <MoreScreen />;
}
