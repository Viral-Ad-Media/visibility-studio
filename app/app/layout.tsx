import Nav from "@/components/Nav";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
