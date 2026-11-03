import { redirect } from "next/navigation";

/** Old address; the profile now lives on the Settings page's Account tab. */
export default function ProfilePage() {
  redirect("/settings");
}
