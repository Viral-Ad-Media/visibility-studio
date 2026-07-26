import Link from "next/link";
import { Radar } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Radar className="w-6 h-6 text-indigo-400" />
        <span className="font-bold text-slate-100">Visibility Studio</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
