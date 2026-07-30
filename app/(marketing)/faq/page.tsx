const FAQS = [
  {
    q: "How does an audit actually work?",
    a: "You queue a niche and a location — “roofing companies in Atlanta,” for example. The engine finds businesses in that category and area, audits each one's website for SEO visibility, conversion elements, and local trust signals, scores it 1–5 on opportunity, and drafts personalized outreach for the high- and medium-priority ones.",
  },
  {
    q: "Where do the contact emails come from?",
    a: "Only from publicly visible sources — contact/about/team/footer pages, a homepage scan, or public web search and directory listings. Emails are never guessed or constructed, and are never taken from behind logins, CAPTCHAs, or paid data tools. If nothing public exists, the row is marked “not found,” not filled in with a guess.",
  },
  {
    q: "What's a campaign, and how is it different from an audit?",
    a: "An audit produces a scored, sourced list. A campaign is a named selection of businesses from that list you've decided to pursue — for each one, it builds a coded homepage redesign concept addressing that business's own findings and a real, single-use Calendly booking link, then tracks the pipeline from Selected through Sent, Replied, Booked, and Won.",
  },
  {
    q: "Does it send the outreach for me?",
    a: "No. It builds the list, the findings, the draft, and the booking link — sending stays a manual, human step in your own email client, on purpose. It never books a call on a prospect's behalf either.",
  },
  {
    q: "What does a redesign concept actually look like?",
    a: "A single self-contained, styled homepage concept built from that business's own audit findings — original copy, no lifted photos or text, no fabricated testimonials. It's clearly labeled as a concept, never presented as the business's real site.",
  },
  {
    q: "Can I get the data out?",
    a: "Yes — one-click CSV export per audit, and every redesign mockup is viewable directly from its campaign at any time.",
  },
  {
    q: "What happens with a business that doesn't have a website, or is unreachable?",
    a: "It's still recorded with whatever is verifiable — category, location, contact info if public — and any limitation (site unreachable, blocked automated access, permanently closed) is noted rather than hidden or papered over with a guess.",
  },
];

export default function FaqPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-slate-100">Frequently asked questions</h1>
      <div className="mt-10 space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="card p-5 group">
            <summary className="font-medium text-slate-100 cursor-pointer list-none flex items-center justify-between gap-4">
              {f.q}
              <span className="text-slate-500 group-open:rotate-45 transition-transform shrink-0">
                +
              </span>
            </summary>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
