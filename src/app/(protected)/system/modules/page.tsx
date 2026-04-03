import { redirect } from "next/navigation";

/** Los modulos contratados los gestiona el Super Admin en /super/company-modules. */
export default function SystemModulesDeprecatedPage() {
  redirect("/dashboard");
}
