import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Star,
  X,
  Target,
  Trash2,
  Library,
  PenLine,
  Check,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// ---- palette ----------------------------------------------------------
const INK = "#1F2A33";
const INK_SOFT = "#42525F";
const PARCHMENT = "#EDE6D3";
const PARCHMENT_LIGHT = "#F6F1E4";
const OXBLOOD = "#7A3B33";
const BRASS = "#A9824B";
const SAGE = "#5E7350";
const CHARCOAL = "#2B2620";
const PLUM = "#6E5773";
const TEAL = "#3E6E77";

const GENRE_COLORS = [OXBLOOD, BRASS, SAGE, INK_SOFT, PLUM, TEAL];
const genreColor = (g) => {
  if (!g) return BRASS;
  let h = 0;
  for (let i = 0; i < g.length; i++) h = (h * 31 + g.charCodeAt(i)) >>> 0;
  return GENRE_COLORS[h % GENRE_COLORS.length];
};

const STATUS = {
  want: { label: "Want to read", color: INK_SOFT },
  reading: { label: "Reading", color: BRASS },
  read: { label: "Finished", color: SAGE },
};

const STORAGE_KEY = "library-data";
const currentYear = new Date().getFullYear();
const uid = () => Math.random().toString(36).slice(2, 10);

const serif = "'Iowan Old Style', 'Palatino Linotype', Georgia, serif";
const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif";

// ---- small building blocks ---------------------------------------------

function Stars({ value = 0, onRate, size = 16 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={(e) => {
            e.stopPropagation();
            onRate && onRate(n === value ? 0 : n);
          }}
          disabled={!onRate}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: onRate ? "pointer" : "default",
            color: n <= value ? OXBLOOD : "#C9BFA6",
            lineHeight: 0,
          }}
          aria-label={`Rate ${n} stars`}
        >
          <Star size={size} fill={n <= value ? OXBLOOD : "none"} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

function Cover({ url, title, w = 44, h = 62, tint }) {
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        width={w}
        height={h}
        style={{ objectFit: "cover", border: `1px solid ${BRASS}55`, flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: w,
        height: h,
        background: tint || BRASS,
        color: PARCHMENT_LIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: `1px solid ${BRASS}55`,
      }}
    >
      <BookOpen size={18} />
    </div>
  );
}

// ---- book card (index-card look) ---------------------------------------

function BookCard({ book, onStatus, onRate, onRemove }) {
  const accent = genreColor(book.genre);
  return (
    <div
      style={{
        background: PARCHMENT,
        border: `1px solid ${BRASS}66`,
        borderLeft: `4px solid ${accent}`,
        padding: "12px 12px 10px",
        display: "flex",
        gap: 10,
        position: "relative",
      }}
    >
      <Cover url={book.coverUrl} title={book.title} tint={accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: serif,
            fontSize: 15,
            color: CHARCOAL,
            lineHeight: 1.25,
            marginBottom: 2,
          }}
        >
          {book.title}
        </div>
        <div style={{ fontSize: 12.5, color: INK_SOFT, marginBottom: 6 }}>
          {book.author || "Unknown author"}
          {book.pages ? ` · ${book.pages}p` : ""}
        </div>

        {book.status === "read" ? (
          <Stars value={book.rating} onRate={(r) => onRate(book.id, r)} size={14} />
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(STATUS)
              .filter(([k]) => k !== book.status)
              .map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => onStatus(book.id, k)}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    background: "transparent",
                    border: `1px solid ${v.color}88`,
                    color: v.color,
                    cursor: "pointer",
                  }}
                >
                  Move to {v.label.toLowerCase()}
                </button>
              ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onRemove(book.id)}
        title="Remove"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: `${CHARCOAL}66`,
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ---- add-book modal ------------------------------------------------------

function AddBookModal({ onClose, onAdd }) {
  const [mode, setMode] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", author: "", pages: "", genre: "" });

  const runSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          query
        )}&maxResults=8`
      );
      const data = await res.json();
      const items = (data.items || []).map((it) => {
        const v = it.volumeInfo || {};
        return {
          id: it.id,
          title: v.title || "Untitled",
          author: (v.authors || []).join(", "),
          pages: v.pageCount || "",
          genre: (v.categories || [])[0] || "",
          coverUrl: v.imageLinks?.thumbnail?.replace("http://", "https://"),
        };
      });
      setResults(items);
      if (items.length === 0) setError("No results — try a different search, or add it manually.");
    } catch (err) {
      setError("Search is unavailable right now — add the book manually instead.");
    } finally {
      setSearching(false);
    }
  };

  const submitManual = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onAdd({
      title: form.title.trim(),
      author: form.author.trim(),
      pages: form.pages ? parseInt(form.pages, 10) : "",
      genre: form.genre.trim(),
      coverUrl: "",
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,24,28,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PARCHMENT_LIGHT,
          border: `1px solid ${BRASS}`,
          width: "100%",
          maxWidth: 460,
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: serif, fontSize: 20, color: CHARCOAL }}>Add a book</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: CHARCOAL }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${BRASS}66`, marginBottom: 14 }}>
          {["search", "manual"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "8px 0",
                background: "none",
                border: "none",
                borderBottom: mode === m ? `2px solid ${OXBLOOD}` : "2px solid transparent",
                color: mode === m ? OXBLOOD : INK_SOFT,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {m === "search" ? "Search" : "Enter manually"}
            </button>
          ))}
        </div>

        {mode === "search" ? (
          <div>
            <form onSubmit={runSearch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, author, or ISBN"
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  border: `1px solid ${BRASS}88`,
                  background: "#fff",
                  fontSize: 13,
                }}
              />
              <button
                type="submit"
                style={{
                  background: INK,
                  color: PARCHMENT_LIGHT,
                  border: "none",
                  padding: "0 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                }}
              >
                <Search size={14} /> Search
              </button>
            </form>
            {searching && <div style={{ fontSize: 13, color: INK_SOFT }}>Searching…</div>}
            {error && <div style={{ fontSize: 12.5, color: OXBLOOD, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: 8,
                    border: `1px solid ${BRASS}55`,
                    alignItems: "center",
                  }}
                >
                  <Cover url={r.coverUrl} title={r.title} w={34} h={48} tint={genreColor(r.genre)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: CHARCOAL, fontFamily: serif }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, color: INK_SOFT }}>{r.author}</div>
                  </div>
                  <button
                    onClick={() => onAdd(r)}
                    style={{
                      background: "none",
                      border: `1px solid ${SAGE}`,
                      color: SAGE,
                      padding: "5px 9px",
                      cursor: "pointer",
                      fontSize: 11.5,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={submitManual} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { key: "title", label: "Title", required: true },
              { key: "author", label: "Author" },
              { key: "pages", label: "Pages", type: "number" },
              { key: "genre", label: "Genre" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 11.5, color: INK_SOFT, display: "block", marginBottom: 3 }}>
                  {f.label}
                </label>
                <input
                  type={f.type || "text"}
                  required={f.required}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "7px 9px",
                    border: `1px solid ${BRASS}88`,
                    background: "#fff",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
            <button
              type="submit"
              style={{
                marginTop: 4,
                background: INK,
                color: PARCHMENT_LIGHT,
                border: "none",
                padding: "9px 0",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Add to shelf
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---- stats tab ------------------------------------------------------------

function StatsTab({ books, goal, onSetGoal }) {
  const [goalInput, setGoalInput] = useState(goal.target);
  useEffect(() => setGoalInput(goal.target), [goal.target]);

  const readThisYear = books.filter(
    (b) => b.status === "read" && b.dateFinished && new Date(b.dateFinished).getFullYear() === currentYear
  );
  const totalPages = readThisYear.reduce((s, b) => s + (parseInt(b.pages, 10) || 0), 0);
  const rated = readThisYear.filter((b) => b.rating);
  const avgRating = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
    : "—";

  const monthly = useMemo(() => {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const counts = new Array(12).fill(0);
    readThisYear.forEach((b) => {
      const m = new Date(b.dateFinished).getMonth();
      counts[m]++;
    });
    return names.map((n, i) => ({ month: n, books: counts[i] }));
  }, [readThisYear]);

  const genreData = useMemo(() => {
    const map = {};
    readThisYear.forEach((b) => {
      const g = b.genre || "Unsorted";
      map[g] = (map[g] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value, color: genreColor(name) }));
  }, [readThisYear]);

  const pct = Math.min(100, Math.round((readThisYear.length / (goal.target || 1)) * 100));
  const dayOfYear = Math.floor((Date.now() - new Date(currentYear, 0, 0)) / 86400000);
  const expected = Math.round((goal.target || 0) * (dayOfYear / 365));
  const ahead = readThisYear.length - expected;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ background: PARCHMENT, border: `1px solid ${BRASS}66`, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontFamily: serif, fontSize: 17, color: CHARCOAL, display: "flex", alignItems: "center", gap: 8 }}>
            <Target size={16} color={OXBLOOD} /> {currentYear} reading goal
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: INK_SOFT }}>
            <input
              type="number"
              min={1}
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={() => onSetGoal(parseInt(goalInput, 10) || goal.target)}
              style={{ width: 48, padding: "3px 5px", border: `1px solid ${BRASS}88`, fontSize: 12.5 }}
            />
            books
          </div>
        </div>
        <div style={{ background: "#DCD2B4", height: 10, position: "relative" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: OXBLOOD, transition: "width .3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12.5, color: INK_SOFT }}>
          <span>{readThisYear.length} of {goal.target} finished</span>
          <span style={{ color: ahead >= 0 ? SAGE : OXBLOOD }}>
            {ahead >= 0 ? `${ahead} ahead of pace` : `${Math.abs(ahead)} behind pace`}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {[
          { label: "Books finished", value: readThisYear.length },
          { label: "Pages read", value: totalPages.toLocaleString() },
          { label: "Average rating", value: avgRating },
        ].map((s) => (
          <div key={s.label} style={{ flex: "1 1 140px", background: PARCHMENT, border: `1px solid ${BRASS}66`, padding: "14px 16px" }}>
            <div style={{ fontFamily: serif, fontSize: 26, color: OXBLOOD }}>{s.value}</div>
            <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontFamily: serif, fontSize: 15, color: CHARCOAL, marginBottom: 8 }}>Books finished by month</div>
        <div style={{ background: PARCHMENT, border: `1px solid ${BRASS}66`, padding: "10px 6px", height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: INK_SOFT }} axisLine={{ stroke: `${BRASS}88` }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: INK_SOFT }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${BRASS}`, background: PARCHMENT_LIGHT }} />
              <Bar dataKey="books" fill={BRASS} radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {genreData.length > 0 && (
        <div>
          <div style={{ fontFamily: serif, fontSize: 15, color: CHARCOAL, marginBottom: 8 }}>Genres this year</div>
          <div style={{ background: PARCHMENT, border: `1px solid ${BRASS}66`, padding: "10px 6px", height: 190, display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={genreData} dataKey="value" nameKey="name" innerRadius={35} outerRadius={65} paddingAngle={2}>
                  {genreData.map((g, i) => (
                    <Cell key={i} fill={g.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: CHARCOAL }}>
              {genreData.map((g) => (
                <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 9, height: 9, background: g.color }} />
                  {g.name} ({g.value})
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- main app ---------------------------------------------------------

export default function BookTracker() {
  const [books, setBooks] = useState([]);
  const [goal, setGoal] = useState({ target: 24 });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("shelf");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.books) setBooks(parsed.books);
        if (parsed.goal) setGoal(parsed.goal);
      }
    } catch (e) {
      // no saved data yet, or storage unavailable
    } finally {
      setLoaded(true);
    }
  }, []);

  // Swap this for a Firestore write if you wire up Firebase (see README).
  const persist = useCallback((nextBooks, nextGoal) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ books: nextBooks, goal: nextGoal }));
    } catch (e) {
      console.error("Could not save your library", e);
    }
  }, []);

  useEffect(() => {
    if (loaded) persist(books, goal);
  }, [books, goal, loaded, persist]);

  const addBook = (b) => {
    const newBook = {
      id: uid(),
      title: b.title,
      author: b.author || "",
      pages: b.pages || "",
      genre: b.genre || "",
      coverUrl: b.coverUrl || "",
      status: "want",
      rating: 0,
      dateAdded: new Date().toISOString(),
      dateFinished: "",
    };
    setBooks((prev) => [newBook, ...prev]);
    setShowModal(false);
  };

  const updateStatus = (id, status) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, status, dateFinished: status === "read" ? new Date().toISOString() : b.dateFinished }
          : b
      )
    );
  };

  const setRating = (id, rating) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, rating } : b)));
  };

  const removeBook = (id) => setBooks((prev) => prev.filter((b) => b.id !== id));

  const columns = ["want", "reading", "read"];
  const readCount = books.filter((b) => b.status === "read").length;

  return (
    <div
      style={{
        fontFamily: sans,
        background: PARCHMENT_LIGHT,
        minHeight: "100%",
        color: CHARCOAL,
      }}
    >
      {/* header */}
      <div style={{ background: INK, color: PARCHMENT_LIGHT, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Library size={26} color={BRASS} />
            <div>
              <div style={{ fontFamily: serif, fontSize: 24 }}>The Reading Ledger</div>
              <div style={{ fontSize: 12.5, color: `${PARCHMENT}bb`, marginTop: 2 }}>
                {books.length} book{books.length === 1 ? "" : "s"} on your shelves · {readCount} finished
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: OXBLOOD,
              color: PARCHMENT_LIGHT,
              border: "none",
              padding: "9px 16px",
              display: "flex",
              alignItems: "center",
              gap: 7,
              cursor: "pointer",
              fontSize: 13.5,
            }}
          >
            <Plus size={15} /> Add book
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
          {[
            { k: "shelf", label: "Shelf" },
            { k: "stats", label: "Goal & stats" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                background: tab === t.k ? PARCHMENT_LIGHT : "transparent",
                color: tab === t.k ? INK : `${PARCHMENT}dd`,
                border: "none",
                padding: "7px 16px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* body */}
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 22 }}>
        {tab === "shelf" ? (
          books.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: INK_SOFT }}>
              <BookOpen size={30} color={BRASS} style={{ marginBottom: 10 }} />
              <div style={{ fontFamily: serif, fontSize: 18, color: CHARCOAL, marginBottom: 6 }}>
                Your shelves are empty
              </div>
              <div style={{ fontSize: 13.5, marginBottom: 16 }}>
                Search for a title or add one by hand to start tracking.
              </div>
              <button
                onClick={() => setShowModal(true)}
                style={{ background: INK, color: PARCHMENT_LIGHT, border: "none", padding: "9px 18px", cursor: "pointer", fontSize: 13 }}
              >
                Add your first book
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
              {columns.map((col) => (
                <div key={col}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12.5,
                      color: STATUS[col].color,
                      marginBottom: 10,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    {col === "read" ? <Check size={13} /> : col === "reading" ? <PenLine size={13} /> : <BookOpen size={13} />}
                    {STATUS[col].label} · {books.filter((b) => b.status === col).length}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {books
                      .filter((b) => b.status === col)
                      .map((b) => (
                        <BookCard
                          key={b.id}
                          book={b}
                          onStatus={updateStatus}
                          onRate={setRating}
                          onRemove={removeBook}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <StatsTab books={books} goal={goal} onSetGoal={(target) => setGoal({ ...goal, target })} />
        )}
      </div>

      {showModal && <AddBookModal onClose={() => setShowModal(false)} onAdd={addBook} />}
    </div>
  );
}
