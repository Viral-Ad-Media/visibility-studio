import { SignUp } from "@clerk/nextjs";

export default async function SignupPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  // The referral code rides through onboarding to createAccount().
  const destination = searchParams.ref ? `/onboarding?ref=${encodeURIComponent(searchParams.ref)}` : "/onboarding";
  return <SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl={destination} />;
}
