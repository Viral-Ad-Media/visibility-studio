import { UserProfile } from "@clerk/nextjs";
export default function SecurityPage() {
  return <UserProfile routing="hash" />;
}
