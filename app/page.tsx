'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  ExternalLink,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Paper = {
  id: string;
  title: string;
  authors: string[];
  presenter: string;
  abstract: string;
  keywords: string[];
  date: string;
  time: string;
  sessionInterval: string;
  session: string;
  track: string;
  room: string;
  type: string;
  url: string;
  x: number;
  y: number;
};
type StatItem = { name: string; count: number };
type Catalogue = {
  papers: Paper[];
  stats: {
    paperCount: number;
    authorCount: number;
    sessionCount: number;
    keywordCount: number;
    topKeywords: StatItem[];
    tracks: StatItem[];
    prolificAuthors: StatItem[];
  };
};
type View = 'explore' | 'research' | 'programme' | 'saved';
type ModelContext = {
  registerTool?: (
    tool: unknown,
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const examples = [
  'accessibility',
  'machine learning',
  'public transport',
  'choice modelling',
  'transport equity',
];
const dates = ['All days', '2026-09-29', '2026-09-30', '2026-10-01'];
const types = ['All formats', 'Podium', 'Poster'];
const trackColours = [
  '#007a9e',
  '#df7f2e',
  '#6b70b2',
  '#3b9274',
  '#cb5871',
  '#87962d',
  '#846647',
  '#178aa1',
  '#96619a',
  '#486b76',
];
const tokenise = (value: string) =>
  value.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
const formatDay = (date: string, long = false) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(
    'en-GB',
    long
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { weekday: 'short', day: 'numeric', month: 'short' },
  );
const shortSession = (session: string) =>
  session.replace(/^Session\s+/, '').replace(/:\s*/, ' · ');

function scorePaper(paper: Paper, query: string) {
  const terms = tokenise(query);
  if (!terms.length) return 1;
  const title = paper.title.toLowerCase();
  const abstract = paper.abstract.toLowerCase();
  const keywords = paper.keywords.join(' ').toLowerCase();
  const authors = paper.authors.join(' ').toLowerCase();
  const phrase = query.trim().toLowerCase();
  return (
    terms.reduce(
      (score, term) =>
        score +
        (title.includes(term) ? 6 : 0) +
        (keywords.includes(term) ? 5 : 0) +
        (abstract.includes(term) ? 1 : 0) +
        (authors.includes(term) ? 3 : 0),
      phrase && title.includes(phrase) ? 8 : 0,
    ) / terms.length
  );
}
function Logo() {
  return (
    <span className="brand-mark" aria-hidden="true">
      h<span>EA</span>RT
    </span>
  );
}

export default function Home() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [query, setQuery] = useState('accessibility');
  const [selectedTrack, setSelectedTrack] = useState('All research lines');
  const [selectedDate, setSelectedDate] = useState('All days');
  const [selectedType, setSelectedType] = useState('All formats');
  const [view, setView] = useState<View>('explore');
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(
        localStorage.getItem('heart2026-saved') || '[]',
      ) as string[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    void fetch('./data/papers.json')
      .then((r) => r.json() as Promise<Catalogue>)
      .then((data) => setCatalogue(data))
      .catch(() => setCatalogue(null));
  }, []);
  const tracks = useMemo(
    () => (catalogue ? catalogue.stats.tracks.map((t) => t.name) : []),
    [catalogue],
  );
  const filtered = useMemo(() => {
    if (!catalogue) return [];
    return catalogue.papers
      .filter(
        (p) =>
          selectedTrack === 'All research lines' || p.track === selectedTrack,
      )
      .filter((p) => selectedDate === 'All days' || p.date === selectedDate)
      .filter((p) => selectedType === 'All formats' || p.type === selectedType)
      .map((p) => ({ ...p, score: scorePaper(p, query) }))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }, [catalogue, query, selectedTrack, selectedDate, selectedType]);
  const exactMatches = query ? filtered.filter((p) => p.score > 0) : filtered;
  const displayed = exactMatches.length ? exactMatches : filtered;
  const saved =
    catalogue?.papers
      .filter((p) => savedIds.includes(p.id))
      .sort((a, b) =>
        `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
      ) ?? [];
  useEffect(() => {
    if (!catalogue) return;
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const allowedTracks = ['All research lines', ...tracks];
    void Promise.resolve(
      context.registerTool(
        {
          name: 'configure_paper_explorer',
          title: 'Configure hEART paper explorer',
          description:
            'Set the visible topic query and optional conference filters in the hEART 2026 paper explorer.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              query: {
                type: 'string',
                description: 'Topic, method, author, or phrase to find.',
              },
              track: { type: 'string', enum: allowedTracks },
              date: { type: 'string', enum: dates },
              format: { type: 'string', enum: types },
            },
            required: ['query'],
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            if (
              !input ||
              typeof input !== 'object' ||
              typeof (input as { query?: unknown }).query !== 'string'
            )
              throw new Error('query must be a string');
            const v = input as {
              query: string;
              track?: string;
              date?: string;
              format?: string;
            };
            if (v.track && !allowedTracks.includes(v.track))
              throw new Error('Unknown research line');
            if (v.date && !dates.includes(v.date))
              throw new Error('Unknown conference day');
            if (v.format && !types.includes(v.format))
              throw new Error('Unknown presentation format');
            setQuery(v.query);
            if (v.track) setSelectedTrack(v.track);
            if (v.date) setSelectedDate(v.date);
            if (v.format) setSelectedType(v.format);
            setView('explore');
            return {
              query: v.query,
              track: v.track ?? selectedTrack,
              date: v.date ?? selectedDate,
              format: v.format ?? selectedType,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [catalogue, tracks, selectedTrack, selectedDate, selectedType]);
  function toggleSaved(id: string) {
    setSavedIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      localStorage.setItem('heart2026-saved', JSON.stringify(next));
      return next;
    });
  }
  function resetFilters() {
    setSelectedTrack('All research lines');
    setSelectedDate('All days');
    setSelectedType('All formats');
  }
  return (
    <main id="top">
      <header className="site-header">
        <button
          className="brand"
          onClick={() => {
            setView('explore');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="hEART 2026 Explorer home"
        >
          <Logo />
          <span>
            <strong>Paper Explorer</strong>
            <small>hEART 2026 · Lausanne</small>
          </span>
        </button>
        <nav aria-label="Primary navigation">
          <button
            className={view === 'explore' ? 'active' : ''}
            onClick={() => setView('explore')}
          >
            Explore
          </button>
          <button
            className={view === 'research' ? 'active' : ''}
            onClick={() => setView('research')}
          >
            Research lines
          </button>
          <button
            className={view === 'programme' ? 'active' : ''}
            onClick={() => setView('programme')}
          >
            Programme
          </button>
          <button
            className={view === 'saved' ? 'active' : ''}
            onClick={() => setView('saved')}
          >
            My papers <span className="nav-count">{savedIds.length}</span>
          </button>
        </nav>
        <a
          className="cityai"
          href="https://www.epfl.ch/labs/cit-ai/"
          target="_blank"
          rel="noreferrer"
        >
          CITY<span>AI</span> LAB
        </a>
      </header>
      {view === 'explore' && (
        <>
          <section className="intro">
            <div>
              <p className="eyebrow">
                14th Symposium of the European Association for Research in
                Transportation
              </p>
              <h1>
                Find the research
                <br />
                that moves you.
              </h1>
            </div>
            <p className="intro-copy">
              Explore every hEART 2026 paper by topic, connection and conference
              moment. Search the abstracts, discover neighbouring ideas, and
              decide where to go next.
            </p>
            <div className="stats" aria-label="Conference catalogue statistics">
              <span>
                <strong>{catalogue?.stats.paperCount ?? '—'}</strong> papers
              </span>
              <span>
                <strong>{catalogue?.stats.sessionCount ?? '—'}</strong> sessions
              </span>
              <span>
                <strong>{catalogue?.stats.authorCount ?? '—'}</strong> authors
              </span>
            </div>
          </section>
          <section className="explorer">
            <div className="search-panel">
              <div className="section-label">
                <span>01</span> Topic search
              </div>
              <label className="search-box">
                <Search aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search paper titles, abstracts, authors and keywords"
                  placeholder="What are you interested in?"
                />
                {query && (
                  <button
                    className="clear-query"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    <X />
                  </button>
                )}
              </label>
              <div className="suggestions" aria-label="Suggested searches">
                <span>Try</span>
                {examples.map((example) => (
                  <button key={example} onClick={() => setQuery(example)}>
                    {example}
                  </button>
                ))}
              </div>
            </div>
            <div className="workspace">
              <aside className="filters">
                <div className="filter-title">
                  <SlidersHorizontal aria-hidden="true" /> Refine
                </div>
                <label htmlFor="track-filter">Research line</label>
                <select
                  id="track-filter"
                  value={selectedTrack}
                  onChange={(e) => setSelectedTrack(e.target.value)}
                >
                  <option>All research lines</option>
                  {tracks.map((track) => (
                    <option key={track}>{track}</option>
                  ))}
                </select>
                <label htmlFor="day-filter">Conference day</label>
                <select
                  id="day-filter"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                >
                  {dates.map((date) => (
                    <option key={date} value={date}>
                      {date === 'All days' ? date : formatDay(date, true)}
                    </option>
                  ))}
                </select>
                <label htmlFor="type-filter">Format</label>
                <select
                  id="type-filter"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  {types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <button className="reset" onClick={resetFilters}>
                  Reset filters
                </button>
                <div className="filter-note">
                  <span>Showing</span>
                  <strong>{displayed.length}</strong>
                  <span>papers across the programme</span>
                </div>
                <div className="legend">
                  <span>Research line colours</span>
                  {catalogue?.stats.tracks.slice(0, 5).map((track, index) => (
                    <button
                      key={track.name}
                      onClick={() => setSelectedTrack(track.name)}
                    >
                      <i style={{ background: trackColours[index] }} />
                      {track.name}
                    </button>
                  ))}
                </div>
              </aside>
              <section
                className="map-panel"
                aria-label="Research similarity map"
              >
                <div className="panel-heading">
                  <div>
                    <span>SIMILARITY LANDSCAPE</span>
                    <h2>Ideas, mapped.</h2>
                  </div>
                  <p>
                    Nearby papers share language, methods and themes. Select a
                    point to read its abstract.
                  </p>
                </div>
                <div className="paper-map">
                  {filtered.map((paper) => {
                    const colour =
                      trackColours[
                        Math.max(0, tracks.indexOf(paper.track)) %
                          trackColours.length
                      ];
                    const relevant = !query || paper.score > 0;
                    return (
                      <button
                        key={paper.id}
                        onClick={() => setActivePaper(paper)}
                        className={`paper-dot ${relevant ? 'relevant' : ''}`}
                        style={{
                          left: `${paper.x}%`,
                          top: `${paper.y}%`,
                          backgroundColor: colour,
                        }}
                        aria-label={`Read ${paper.title}`}
                        title={paper.title}
                      />
                    );
                  })}
                  <div className="map-axis x">RELATED RESEARCH →</div>
                  <div className="map-axis y">METHODS + THEMES →</div>
                </div>
                <p className="map-caption">
                  <Sparkles /> Position is calculated from title, abstract and
                  author keywords; colour identifies the programme research
                  line.
                </p>
              </section>
              <aside className="results-panel">
                <div className="panel-heading compact">
                  <div>
                    <span>BEST MATCHES</span>
                    <h2>Start here.</h2>
                  </div>
                  <strong>{query ? `“${query}”` : 'All papers'}</strong>
                </div>
                <div className="paper-list">
                  {displayed.slice(0, 20).map((paper, index) => (
                    <PaperCard
                      key={paper.id}
                      paper={paper}
                      rank={index + 1}
                      maxScore={displayed[0]?.score ?? 1}
                      saved={savedIds.includes(paper.id)}
                      onOpen={() => setActivePaper(paper)}
                      onSave={() => toggleSaved(paper.id)}
                    />
                  ))}
                </div>
              </aside>
            </div>
          </section>
        </>
      )}
      {view === 'research' && catalogue && (
        <ResearchView
          catalogue={catalogue}
          openTrack={(track) => {
            setSelectedTrack(track);
            setQuery('');
            setView('explore');
          }}
        />
      )}
      {view === 'programme' && catalogue && (
        <ProgrammeView
          papers={catalogue.papers}
          savedIds={savedIds}
          onOpen={setActivePaper}
          onSave={toggleSaved}
        />
      )}{' '}
      {view === 'saved' && (
        <SavedView
          papers={saved}
          onOpen={setActivePaper}
          onSave={toggleSaved}
          openProgramme={() => setView('programme')}
        />
      )}
      <PaperDialog
        paper={activePaper}
        open={!!activePaper}
        saved={activePaper ? savedIds.includes(activePaper.id) : false}
        onOpenChange={(open) => !open && setActivePaper(null)}
        onSave={() => activePaper && toggleSaved(activePaper.id)}
      />
      <footer>
        <span>hEART 2026 Paper Explorer</span>
        <span>
          232 abstracts · 894 author keywords · Programme data from EasyChair
        </span>
        <a
          href="https://github.com/gnova3/hEART2026"
          target="_blank"
          rel="noreferrer"
        >
          Open source <ArrowUpRight />
        </a>
      </footer>
    </main>
  );
}

function PaperCard({
  paper,
  rank,
  maxScore,
  saved,
  onOpen,
  onSave,
}: {
  paper: Paper & { score?: number };
  rank: number;
  maxScore: number;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  const relevance =
    paper.score && maxScore ? Math.round((paper.score / maxScore) * 100) : 0;
  return (
    <article className="paper-card">
      <span className="rank">{String(rank).padStart(2, '0')}</span>
      <div>
        <div className="paper-meta">
          <Badge variant="outline">{paper.type}</Badge>
          <span>{relevance ? `${relevance}% relevance` : paper.track}</span>
          <button
            className={saved ? 'saved' : ''}
            onClick={onSave}
            aria-label={saved ? 'Remove from my papers' : 'Save to my papers'}
          >
            <Bookmark fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <button className="paper-title" onClick={onOpen}>
          {paper.title}
        </button>
        <p className="authors">{paper.authors.join(', ')}</p>
        <p className="schedule">
          <CalendarDays /> {formatDay(paper.date)} ·{' '}
          {paper.time || paper.sessionInterval} <MapPin /> {paper.room}
        </p>
      </div>
    </article>
  );
}

function PaperDialog({
  paper,
  open,
  saved,
  onOpenChange,
  onSave,
}: {
  paper: Paper | null;
  open: boolean;
  saved: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="paper-dialog">
        <DialogHeader>
          <div className="dialog-meta">
            <Badge variant="outline">{paper?.type}</Badge>
            <span>{paper?.track}</span>
          </div>
          <DialogTitle>{paper?.title}</DialogTitle>
          <DialogDescription>{paper?.authors.join(', ')}</DialogDescription>
        </DialogHeader>
        {paper && (
          <>
            <div className="dialog-schedule">
              <span>
                <CalendarDays />
                {formatDay(paper.date, true)} ·{' '}
                {paper.time || paper.sessionInterval}
              </span>
              <span>
                <MapPin />
                {paper.room}
              </span>
              <span>
                <Users />
                Presented by {paper.presenter || 'TBA'}
              </span>
            </div>
            <section>
              <h4>Abstract</h4>
              <p>{paper.abstract}</p>
            </section>
            <section>
              <h4>Author keywords</h4>
              <div className="keyword-row">
                {paper.keywords.map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
            </section>
            <div className="dialog-actions">
              <Button
                variant={saved ? 'secondary' : 'default'}
                onClick={onSave}
              >
                {saved ? <Check /> : <Bookmark />}
                {saved ? 'Saved to my papers' : 'Save to my papers'}
              </Button>
              <a
                className="external-programme-button"
                href={paper.url}
                target="_blank"
                rel="noreferrer"
              >
                View in programme <ExternalLink />
              </a>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResearchView({
  catalogue,
  openTrack,
}: {
  catalogue: Catalogue;
  openTrack: (track: string) => void;
}) {
  const max = catalogue.stats.tracks[0]?.count || 1;
  return (
    <section className="section-page">
      <header className="section-hero">
        <p className="eyebrow">Research landscape</p>
        <h1>
          What hEART
          <br />
          is thinking about.
        </h1>
        <p>
          Research lines reveal the programme’s intellectual structure. Keywords
          show which methods, modes and policy questions recur across sessions.
        </p>
      </header>
      <div className="research-grid">
        <section className="track-chart">
          <div className="section-heading">
            <span>01</span>
            <div>
              <p>Programme composition</p>
              <h2>Research lines</h2>
            </div>
          </div>
          {catalogue.stats.tracks.map((track, index) => (
            <button
              className="track-bar"
              key={track.name}
              onClick={() => openTrack(track.name)}
            >
              <span className="track-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="track-name">{track.name}</span>
              <i>
                <b
                  style={{
                    width: `${(track.count / max) * 100}%`,
                    background: trackColours[index],
                  }}
                />
              </i>
              <strong>{track.count}</strong>
              <ChevronRight />
            </button>
          ))}
        </section>
        <aside className="keyword-cloud">
          <div className="section-heading">
            <span>02</span>
            <div>
              <p>Author vocabulary</p>
              <h2>Trending themes</h2>
            </div>
          </div>
          <p className="cloud-note">
            Size reflects the number of papers tagged with each author-provided
            keyword.
          </p>
          <div>
            {catalogue.stats.topKeywords.slice(0, 30).map((keyword, index) => (
              <button
                key={`${keyword.name}-${index}`}
                onClick={() => {}}
                style={{
                  fontSize: `${12 + Math.min(keyword.count, 15) * 0.8}px`,
                  color: trackColours[index % trackColours.length],
                }}
              >
                {keyword.name}
                <sup>{keyword.count}</sup>
              </button>
            ))}
          </div>
        </aside>
      </div>
      <section className="signals">
        <div className="section-heading">
          <span>03</span>
          <div>
            <p>Programme signals</p>
            <h2>At a glance</h2>
          </div>
        </div>
        <div className="signal-grid">
          <article>
            <strong>{catalogue.stats.keywordCount}</strong>
            <span>distinct author keywords</span>
            <p>
              A broad vocabulary spans behavioural modelling, operations
              research, data science and policy.
            </p>
          </article>
          <article>
            <strong>{catalogue.stats.tracks[0]?.count}</strong>
            <span>papers in the largest line</span>
            <p>
              Choice modelling, preferences and travel behaviour is the
              programme’s most represented research line.
            </p>
          </article>
          <article>
            <strong>{catalogue.stats.topKeywords[0]?.count}</strong>
            <span>papers on “{catalogue.stats.topKeywords[0]?.name}”</span>
            <p>
              The most frequent exact author keyword highlights a strong shared
              and multimodal mobility thread.
            </p>
          </article>
        </div>
      </section>
    </section>
  );
}

function ProgrammeView({
  papers,
  savedIds,
  onOpen,
  onSave,
}: {
  papers: Paper[];
  savedIds: string[];
  onOpen: (paper: Paper) => void;
  onSave: (id: string) => void;
}) {
  const [day, setDay] = useState('2026-09-29');
  const dayPapers = papers.filter((p) => p.date === day);
  const sessions = [...new Set(dayPapers.map((p) => p.session))];
  return (
    <section className="section-page">
      <header className="section-hero programme-hero">
        <p className="eyebrow">Plan your conference</p>
        <h1>
          Three days.
          <br />
          One research route.
        </h1>
        <p>
          Browse talks in programme order and save promising papers to a
          personal shortlist stored on this device.
        </p>
      </header>
      <div className="day-tabs">
        {dates.slice(1).map((date, index) => (
          <button
            className={day === date ? 'active' : ''}
            key={date}
            onClick={() => setDay(date)}
          >
            <span>DAY 0{index + 1}</span>
            <strong>{formatDay(date, true)}</strong>
            <small>{papers.filter((p) => p.date === date).length} papers</small>
          </button>
        ))}
      </div>
      <div className="agenda">
        {sessions.map((session) => {
          const items = dayPapers.filter((p) => p.session === session);
          return (
            <section className="session-block" key={session}>
              <header>
                <div>
                  <span>{items[0].sessionInterval}</span>
                  <h2>{shortSession(session)}</h2>
                </div>
                <p>
                  <MapPin />
                  {items[0].room}
                </p>
              </header>
              <div>
                {items.map((paper) => (
                  <article key={paper.id}>
                    <time>{paper.time || 'Poster'}</time>
                    <div>
                      <Badge variant="outline">{paper.type}</Badge>
                      <button onClick={() => onOpen(paper)}>
                        {paper.title}
                      </button>
                      <p>
                        {paper.presenter
                          ? `Presented by ${paper.presenter}`
                          : paper.authors.join(', ')}
                      </p>
                    </div>
                    <button
                      className={savedIds.includes(paper.id) ? 'saved' : ''}
                      onClick={() => onSave(paper.id)}
                      aria-label="Save paper"
                    >
                      <Bookmark
                        fill={
                          savedIds.includes(paper.id) ? 'currentColor' : 'none'
                        }
                      />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function SavedView({
  papers,
  onOpen,
  onSave,
  openProgramme,
}: {
  papers: Paper[];
  onOpen: (paper: Paper) => void;
  onSave: (id: string) => void;
  openProgramme: () => void;
}) {
  return (
    <section className="section-page saved-page">
      <header className="section-hero">
        <p className="eyebrow">Your shortlist</p>
        <h1>My papers.</h1>
        <p>
          Saved papers stay on this device. Use this view as a compact research
          and conference itinerary.
        </p>
      </header>
      {papers.length === 0 ? (
        <div className="empty-state">
          <Bookmark />
          <h2>Your shortlist is empty.</h2>
          <p>
            Save papers from the explorer or programme, then return here to see
            your personal route.
          </p>
          <Button onClick={openProgramme}>Browse the programme</Button>
        </div>
      ) : (
        <div className="saved-list">
          {dates.slice(1).map((date) => {
            const items = papers.filter((p) => p.date === date);
            if (!items.length) return null;
            return (
              <section key={date}>
                <h2>{formatDay(date, true)}</h2>
                {items.map((paper) => (
                  <article key={paper.id}>
                    <time>{paper.time || 'Poster'}</time>
                    <div>
                      <button onClick={() => onOpen(paper)}>
                        {paper.title}
                      </button>
                      <p>
                        {paper.room} · {paper.presenter || paper.authors[0]}
                      </p>
                    </div>
                    <button
                      onClick={() => onSave(paper.id)}
                      aria-label="Remove paper"
                    >
                      <X />
                    </button>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
