const PRINCIPLES = [
  {
    title: "Never fabricate a fact",
    body: "No invented emails, phone numbers, ratings, review counts, or rankings. Anything unverifiable is left blank and noted as an attempt, not guessed at.",
  },
  {
    title: "Every claim is sourced",
    body: "Each audited business carries the URLs that were actually used to research it, so any finding can be checked in seconds.",
  },
  {
    title: "Outreach references something real",
    body: "Every draft points at a specific, observed gap on that business's own site — never a generic “I noticed your website could be improved.”",
  },
  {
    title: "Sending stays a human decision",
    body: "The tool builds the list, the findings, the drafts, and the booking link. It never sends anything or books on a prospect's behalf.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-slate-100">About Visibility Studio</h1>
      <p className="mt-6 text-slate-400 leading-relaxed">
        Prospecting local businesses for a redesign, SEO, or marketing pitch
        usually means the same slow loop: search a niche and location by
        hand, open each website, eyeball what's broken, dig for a contact
        email, and write an outreach note from scratch — for every single
        prospect. Visibility Studio automates that loop end to end, from the
        first search down to a booking link ready to attach to the email
        you send yourself.
      </p>
      <p className="mt-4 text-slate-400 leading-relaxed">
        It's built around a small set of rules that don't bend, because an
        outreach tool is only as good as its accuracy:
      </p>

      <div className="mt-10 space-y-6">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="card p-5">
            <div className="font-semibold text-slate-100">{p.title}</div>
            <div className="text-sm text-slate-400 mt-1.5 leading-relaxed">{p.body}</div>
          </div>
        ))}
      </div>

      <p className="mt-10 text-slate-400 leading-relaxed">
        Every audit, campaign, and redesign concept it produces is meant to
        hold up if the prospect checks it themselves — that's the bar.
      </p>
    </div>
  );
}
