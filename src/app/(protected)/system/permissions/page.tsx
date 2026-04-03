import { redirect } from "next/navigation";

export default function SystemPermissionsRedirectPage() {
  redirect("/system/access");
}
