import { UserProfile } from "@clerk/nextjs";
import { resolveAuthProvider } from "@/lib/auth-config";
import { redirect } from "next/navigation";
export default function SecurityPage() {
  if (resolveAuthProvider() !== "clerk") redirect("/app/settings");
  return <UserProfile routing="hash" />;
}
