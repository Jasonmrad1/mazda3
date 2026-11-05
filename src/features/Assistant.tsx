import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  Sparkles,
  Search,
  BookOpen,
  ArrowUpRight,
  Send,
  Plus,
  FileText,
  WifiOff,
  ShieldCheck,
  Settings2,
  LoaderCircle,
} from "lucide-react";
import { useGarage } from "../lib/store";
import { articles, type Article } from "../data/knowledge";
import { careTasks } from "../data/maintenance";
import {
  deadline,
  fmtDate,
  formatDistance,
  fuelMeasurements,
  weightedConsumption,
} from "../lib/calculations";
import {
  Modal,
  SectionTitle,
  Note,
  Badge,
  Field,
  type OpenModal,
} from "../components/ui";
export function ArticleModal({
  subject,
  onClose,
}: {
  subject: string;
  onClose: () => void;
}) {
  const article = articles.find((a) => a.id === subject) ?? articles[0];
  const [checked, setChecked] = useState<string[]>([]);
  return (
    <Modal
      title={article.title}
      subtitle={article.category + " · " + article.summary}
      onClose={onClose}
    >
      <div className="article-body">
        <BookOpen size={30} strokeWidth={1.3} />
        {article.body
          .split(/(?<=\.) (?=[A-Z])/)
          .reduce<string[]>((p, s, i) => {
            if (i % 2 === 0) p.push(s);
            else p[p.length - 1] += " " + s;
            return p;
          }, [])
          .map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        {article.id === "long-trip" && (
          <div className="trip-checklist">
            {[
              "Cold tire pressures",
              "Visible tire & wheel condition",
              "Oil level checked safely",
              "Coolant level checked safely",
              "Lights, wipers & washer fluid",
              "Emergency equipment & documents",
            ].map((item) => (
              <label className="check-field" key={item}>
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={(e) =>
                    setChecked((v) =>
                      e.target.checked
                        ? [...v, item]
                        : v.filter((i) => i !== item),
                    )
                  }
                />
                {item}
              </label>
            ))}
          </div>
        )}
        <a
          className="reference-banner"
          href={article.source}
          target="_blank"
          rel="noreferrer"
        >
          <FileText size={19} />
          <div>
            <strong>Source & reference</strong>
            <span>{article.reference}</span>
          </div>
          <ArrowUpRight size={17} />
        </a>
        <p className="article-disclaimer">
          Reference guidance, not a diagnosis. Confirm fitted equipment and
          vehicle-specific instructions in your owner’s manual.
        </p>
      </div>
    </Modal>
  );
}
type Citation = {
  title: string;
  reference: string;
  url?: string;
  documentId?: string;
  page?: number;
  excerpt?: string;
};
type Message = {
  role: "user" | "assistant";
  text: string;
  sources?: Citation[];
};
function retrieve(
  query: string,
  data: ReturnType<typeof useGarage>["data"],
): Citation[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (t) =>
        t.length > 2 &&
        ![
          "the",
          "how",
          "what",
          "should",
          "with",
          "does",
          "can",
          "for",
          "this",
          "car",
          "my",
        ].includes(t),
    );
  const results: { score: number; citation: Citation }[] = [];
  for (const a of articles) {
    const text = (a.title + " " + a.keywords + " " + a.body).toLowerCase();
    const score = terms.filter((t) => text.includes(t)).length;
    if (score)
      results.push({
        score,
        citation: {
          title: a.title,
          reference: a.reference,
          url: a.source,
          excerpt: a.body,
        },
      });
  }
  const mechanical =
    /oil|engine|fluid|tire|tyre|pressure|brake|transmission|spark|coolant|wheel|service/i.test(
      query,
    );
  const pageNumber = query.match(/page\s*(\d+)/i)?.[1];
  for (const doc of data.documents) {
    if (
      mechanical &&
      (/nav|connect/i.test(doc.name) || doc.kind === "Navigation manual")
    )
      continue;
    doc.pages.forEach((page, i) => {
      if (pageNumber && i + 1 !== Number(pageNumber)) return;
      const score = terms.filter((t) => page.toLowerCase().includes(t)).length;
      if (score)
        results.push({
          score,
          citation: {
            title: doc.name,
            reference: `${doc.name} · PDF page ${i + 1}`,
            documentId: doc.id,
            page: i + 1,
            excerpt: page.slice(0, 1800),
          },
        });
    });
  }
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.citation);
}
export function Assistant({ open }: { open: OpenModal }) {
  const { data, update, toast } = useGarage();
  const [section, setSection] = useState("assistant"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All topics"),
    [busy, setBusy] = useState(false),
    [config, setConfig] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length)
      bottom.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
      });
  }, [messages, busy]);
  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setQuery("");
    setMessages((v) => [...v, { role: "user", text: question }]);
    setBusy(true);
    try {
      let answer = "";
      const sources = retrieve(question, data);
      const lower = question.toLowerCase();
      if (
        /overheat|oil pressure|brake fail|sidewall bulge|tire bulge|tyre bulge|brakes (not|aren.t|are not) working/.test(
          lower,
        )
      )
        answer =
          "Stop in a safe place and avoid continuing if safe operation is uncertain. Suspected low oil pressure, overheating, serious brake problems or a tire bulge need prompt professional attention. Do not open a hot cooling system. I cannot diagnose the cause from text; follow the exact warning procedure in your owner’s manual and arrange safe assistance.";
      else if (
        /maintenance|up to date|oil|service due|replace.*filter/.test(lower)
      ) {
        const task = careTasks(data).find((t) => t.id === "oil")!;
        const due = deadline(task, data);
        answer = `Your ${data.vehicle.specs.Year} ${data.vehicle.specs.Model} uses the ${data.vehicle.driving} driving profile. The oil & filter reminder is ${task.miles!.toLocaleString()} miles or ${task.months} months, whichever comes first, and earlier if the vehicle monitor indicates it. `;
        answer += due.last
          ? `Your last recorded oil service was ${fmtDate(due.last.date)} at ${formatDistance(due.last.meters, data.vehicle.unit)}. The next recorded threshold is ${fmtDate(due.date)} or ${formatDistance(due.meters, data.vehicle.unit)}. `
          : "No oil-change history has been entered, so I cannot confirm whether it is due or up to date. ";
        answer +=
          "This describes your records, not the car’s mechanical condition.";
      } else if (/mpg|economy|consumption/.test(lower)) {
        const avg = weightedConsumption(fuelMeasurements(data.fuel));
        answer =
          avg === null
            ? "You do not have a complete full-to-full fuel cycle yet. Record a full tank and the next full fill to begin measuring. Partial fills in between are included. "
            : "Your measured full-to-full average is " +
              (235.214583 / avg).toFixed(1) +
              " MPG (US), or " +
              avg.toFixed(1) +
              " L/100 km. ";
        answer +=
          "Traffic, short trips, steep routes, load, tire pressures and driving style can change consumption. Compare similar driving conditions; a consumption change alone does not confirm a mechanical fault.";
      } else if (/17.?inch|17.?in|17.*wheel/.test(lower))
        answer =
          "Your supplied setup is 18 × 7J with 215/45R18 tires. A different wheel size needs vehicle-specific confirmation of brake clearance, bolt pattern, offset, load rating and an appropriate tire size. I do not have verified fitment information for your proposed 17-inch setup, so I cannot approve it. Check the mechanical manual and a qualified wheel specialist.";
      else if (sources[0]?.excerpt)
        answer =
          "From the available reference:\n\n" +
          sources[0].excerpt +
          (sources[0].documentId
            ? "\n\nThis is a retrieved manual excerpt, not a generated interpretation. Confirm it applies to your fitted equipment."
            : "");
      else
        answer =
          "I do not have a source that supports a reliable answer to that question. Upload the relevant owner’s manual or confirm the fitted equipment. I will not guess a fluid grade, part, service interval or diagnosis.";
      if (
        data.settings.assistantEndpoint &&
        !/overheat|oil pressure|brake fail|bulge/.test(lower)
      ) {
        const response = await fetch(data.settings.assistantEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: question,
            vehicle: { ...data.vehicle, vin: undefined, photo: undefined },
            history: data.history.map(({ attachments, ...h }) => h),
            fuel: data.fuel,
            context: sources,
          }),
          signal: AbortSignal.timeout(30000),
          credentials: "omit",
        });
        if (!response.ok)
          throw Error(
            "The optional AI service is unavailable. Your local handbook and records still work.",
          );
        const json = await response.json();
        if (typeof json.answer !== "string")
          throw Error("The AI service returned an invalid response.");
        answer = json.answer;
      }
      setMessages((v) => [...v, { role: "assistant", text: answer, sources }]);
    } catch (e) {
      setMessages((v) => [
        ...v,
        {
          role: "assistant",
          text:
            e instanceof Error
              ? e.message
              : "The assistant could not connect. Try the offline handbook.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };
  const categories = [
    "All topics",
    ...new Set(articles.map((a) => a.category)),
  ];
  const filtered = articles.filter(
    (a) =>
      (category === "All topics" || a.category === category) &&
      (a.title + " " + a.keywords + " " + a.body)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pageResults = search.trim()
    ? retrieve(search, data).filter((c) => c.documentId)
    : [];
  const sourceClick = (source: Citation) => {
    if (source.documentId) {
      const doc = data.documents.find((d) => d.id === source.documentId);
      if (!doc) return;
      const [prefix, content] = doc.data.split(",");
      const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], { type: prefix.split(":")[1].split(";")[0] }),
      );
      window.open(url + "#page=" + source.page, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else if (source.url)
      window.open(source.url, "_blank", "noopener,noreferrer");
  };
  return (
    <div className="page assistant-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">KNOW YOUR MAZDA, BETTER</span>
          <h1>
            A little knowledge. More confidence
            <span className="red-dot">.</span>
          </h1>
          <p>Your manuals, your records and thoughtful guidance.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => open({ type: "documents" })}
        >
          <Plus size={16} />
          Add manual
        </button>
      </div>
      <div className="tab-strip">
        <button
          className={section === "assistant" ? "active" : ""}
          onClick={() => setSection("assistant")}
        >
          Garage Assistant
        </button>
        <button
          className={section === "handbook" ? "active" : ""}
          onClick={() => setSection("handbook")}
        >
          Your digital handbook
        </button>
      </div>
      {section === "assistant" ? (
        <div className="assistant-layout">
          <section className="panel chat-panel">
            <header className="chat-header">
              <div className="assistant-emblem">
                <Sparkles size={22} />
              </div>
              <div>
                <h3>Garage Assistant</h3>
                <span>
                  <i className="status-dot green" />
                  {data.settings.assistantEndpoint
                    ? "Optional AI connected"
                    : "Offline reference mode"}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label="Assistant connection settings"
                onClick={() => setConfig(true)}
              >
                <Settings2 size={18} />
              </button>
            </header>
            <div className="chat-messages" aria-live="polite">
              {!messages.length && (
                <div className="assistant-welcome">
                  <div className="assistant-orbit">
                    <Sparkles size={35} strokeWidth={1} />
                  </div>
                  <span className="eyebrow">BUILT AROUND YOUR MAZDA</span>
                  <h2>What’s on your mind?</h2>
                  <p>
                    Find a reference, understand your care schedule,
                    <br />
                    or make sense of your recorded history.
                  </p>
                  <div className="prompt-grid">
                    {[
                      "When should I replace my oil?",
                      "How often should I inspect my tires?",
                      "Why is my MPG low?",
                      "Is my maintenance up to date?",
                    ].map((q) => (
                      <button key={q} onClick={() => void ask(q)}>
                        {q}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`chat-message ${m.role}`}>
                  <span className="eyebrow">
                    {m.role === "user" ? "YOU" : "GARAGE ASSISTANT"}
                  </span>
                  <p>{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="citations">
                      {m.sources.map((c, j) => (
                        <button key={j} onClick={() => sourceClick(c)}>
                          <BookOpen size={13} />
                          {c.reference}
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="assistant-thinking">
                  <LoaderCircle size={16} />
                  Reading the available references…
                </div>
              )}
              <div ref={bottom} />
            </div>
            <form
              className="chat-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(query);
              }}
            >
              <input
                aria-label="Ask Garage Assistant"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about your Mazda…"
                maxLength={1500}
              />
              <button
                type="submit"
                aria-label="Send question"
                disabled={busy || !query.trim()}
              >
                <Send size={18} />
              </button>
            </form>
            <p className="chat-footnote">
              {data.settings.assistantEndpoint
                ? "AI can make mistakes. Verify the cited source."
                : "Local lookup, not generative AI. Specifications are never guessed."}
            </p>
          </section>
          <aside>
            <section className="panel assistant-context">
              <span className="eyebrow">YOUR GARAGE CONTEXT</span>
              <h3>
                {data.vehicle.specs.Year} {data.vehicle.specs.Model}
              </h3>
              <dl>
                <div>
                  <dt>Driving profile</dt>
                  <dd>{data.vehicle.driving}</dd>
                </div>
                <div>
                  <dt>Service records</dt>
                  <dd>{data.history.length}</dd>
                </div>
                <div>
                  <dt>Fuel purchases</dt>
                  <dd>{data.fuel.length}</dd>
                </div>
                <div>
                  <dt>Uploaded manuals</dt>
                  <dd>{data.documents.filter((d) => d.pages.length).length}</dd>
                </div>
              </dl>
              <Badge tone="green">Local records available</Badge>
            </section>
            <section className="panel assistant-principles">
              <ShieldCheck size={23} />
              <h3>Helpful. Honest. Grounded.</h3>
              <p>
                Answers cite available references. Missing information stays
                unknown. A conversation can never confirm a mechanical
                diagnosis.
              </p>
              <button
                className="text-button"
                onClick={() => setSection("handbook")}
              >
                Explore your handbook
                <ArrowUpRight size={14} />
              </button>
            </section>
          </aside>
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Search handbook"
                placeholder="Search subjects, warnings or a manual page…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Handbook topic"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="handbook-grid">
            {filtered.map((a, i) => (
              <button
                className="panel handbook-card"
                key={a.id}
                onClick={() => open({ type: "learn", subject: a.id })}
              >
                <span className="handbook-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="eyebrow">{a.category}</span>
                <h3>{a.title}</h3>
                <p>{a.summary}</p>
                <span className="text-button">
                  Read the guide
                  <ArrowUpRight size={15} />
                </span>
              </button>
            ))}
          </div>
          {pageResults.length > 0 && (
            <section className="panel manual-results">
              <SectionTitle title="From your uploaded manuals" />
              {pageResults.map((c, i) => (
                <button
                  key={i}
                  className="manual-result"
                  onClick={() => sourceClick(c)}
                >
                  <BookOpen size={20} />
                  <div>
                    <strong>{c.reference}</strong>
                    <p>{c.excerpt?.slice(0, 350)}…</p>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </section>
          )}
          {!filtered.length && !pageResults.length && (
            <Note>
              No matching references. Try another term or upload the relevant
              manual. A navigation manual has not been supplied.
            </Note>
          )}
          <a
            className="reference-banner"
            href="/manuals/2019-mazda3-maintenance.pdf"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={22} />
            <div>
              <strong>Official 2019 Mazda3 maintenance reference</strong>
              <span>
                US schedule · included for offline access · PDF pages 1–3
              </span>
            </div>
            <ArrowUpRight size={18} />
          </a>
        </>
      )}
      {config && (
        <Modal
          title="Optional AI connection"
          subtitle="The offline handbook works without an AI service."
          onClose={() => setConfig(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const endpoint = String(f.get("endpoint")).trim();
              if (endpoint) {
                try {
                  const url = new URL(endpoint);
                  if (
                    url.protocol !== "https:" &&
                    url.hostname !== "localhost" &&
                    url.hostname !== "127.0.0.1"
                  )
                    throw Error();
                } catch {
                  toast(
                    "Use an HTTPS backend endpoint, or localhost for development.",
                  );
                  return;
                }
                if (!f.get("consent")) {
                  toast("Confirm what will be shared before connecting.");
                  return;
                }
              }
              void update((d) => {
                d.settings.assistantEndpoint = endpoint;
              }).then(() => {
                setConfig(false);
                toast(
                  endpoint
                    ? "Optional AI endpoint saved"
                    : "Offline reference mode enabled",
                );
              });
            }}
          >
            <Field label="Your secure backend endpoint">
              <input
                name="endpoint"
                type="url"
                defaultValue={data.settings.assistantEndpoint}
                placeholder="https://your-backend.example/api/assistant"
              />
            </Field>
            <Note>
              The endpoint receives your question, vehicle specifications,
              service and fuel history, and selected reference excerpts. Your
              VIN, photos and document files are excluded. AI requests require
              internet. Never paste an API key here.
            </Note>
            <label className="check-field">
              <input
                type="checkbox"
                name="consent"
                defaultChecked={!!data.settings.assistantEndpoint}
              />
              I choose to share this context with my configured backend
            </label>
            <div className="modal-footer">
              <button className="button primary">Save connection</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
