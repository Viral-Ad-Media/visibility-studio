import { SignIn } from "@clerk/nextjs";

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  // `next` round-trips through a query string anyone can craft, so only
  // follow same-site paths.
  const raw = searchParams.next ?? "/app";
  const destination = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/app";
  return <SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl={destination} />;
}
