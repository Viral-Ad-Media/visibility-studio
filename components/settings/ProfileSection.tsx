import { buttonVariants } from "@/components/ui/button";

// Password, email and sign-in methods are managed by Clerk on /app/security.
export default function ProfileSection({ email }: { email: string }) {
  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-2">
        <div className="text-xs font-medium text-slate-300">Email</div>
        <div className="text-sm text-slate-200">{email}</div>
      </div>
      <a className={buttonVariants({ variant: "outline" })} href="/app/security">
        Manage password and account security
      </a>
    </div>
  );
}
