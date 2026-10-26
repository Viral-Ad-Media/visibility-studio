const SECTIONS = [
  {
    title: "1. Who we are",
    body: `Visibility Studio (the "Service") is operated by [Your Company Legal Name], [registered address]. We are the controller of the account data described below. For the business data you collect with the Service, you decide what to research and how to use the results, so you are responsible for your own use of that data.`,
  },
  {
    title: "2. Information about you",
    body: `Account details: your email address, a hashed password, and the name of your workspace. Team details: the email addresses of people you invite, and their role. Billing: records of your payments and credit balance. Card details are entered on Stripe's checkout page and never reach our servers. Calendly: if you connect Calendly, we store the access tokens needed to create booking links on your behalf, and your connected account's name. Activity: an audit trail of actions in your workspace, such as team changes, password changes, completed audits and their processing cost.`,
  },
  {
    title: "3. Information about businesses you research",
    body: `When you run an audit, the Service looks up publicly available information about local businesses: website content, business names and locations, ratings and review counts, and contact details such as email addresses that the business publishes. It only collects contact details that are publicly visible, never from behind logins or paid tools, and records the source of each finding. These results are stored in your workspace for you to use. If you are a business owner and want information about your business removed, contact us at the address in section 10.`,
  },
  {
    title: "4. How we use information",
    body: `To provide the Service: authenticate you, run the audits and campaigns you request, charge usage against your credits, and show your workspace's history. To communicate with you about your account, such as password resets and payment receipts. To keep the Service secure and prevent abuse. We don't sell personal information and don't use it for advertising.`,
  },
  {
    title: "5. Service providers",
    body: `We share information with providers only as needed to run the Service: Neon (database), Clerk (sign-in), Vercel (hosting), Anthropic (AI processing of audit research and drafts), Stripe (payments) and Calendly (booking links, only if you connect it). Each processes data under its own terms and privacy policy.`,
  },
  {
    title: "6. Cookies and local storage",
    body: `We use essential cookies to keep you signed in and to remember which workspace you selected. Your browser's local storage remembers your light or dark theme choice and whether you've seen the product tour. We don't use advertising or third-party analytics cookies.`,
  },
  {
    title: "7. Retention",
    body: `Account and workspace data is kept while your account is active. When you ask us to delete your account, we delete your workspace data within [30] days, except payment records we must keep for tax and accounting purposes.`,
  },
  {
    title: "8. Your rights",
    body: `Depending on where you live, you may have the right to access, correct, export or delete your personal information, and to object to or restrict its processing. To use any of these rights, including deleting your account, contact us at the address in section 10. You can also complain to your local data-protection authority.`,
  },
  {
    title: "9. Changes to this policy",
    body: `We may update this policy from time to time. We'll post the new version here and update the date above.`,
  },
  {
    title: "10. Contact",
    body: `Questions or requests about privacy can be sent to [your-contact-email@example.com].`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-[35rem] mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <h1 className="text-3xl font-bold text-slate-100">Privacy Policy</h1>
      <div className="mt-4 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
        Template draft — replace the bracketed placeholders with your real
        company details and have this reviewed by a lawyer before treating it
        as your live policy.
      </div>
      <p className="mt-6 text-sm text-slate-500">Last updated: [date]</p>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h2 className="font-semibold text-slate-100">{s.title}</h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
