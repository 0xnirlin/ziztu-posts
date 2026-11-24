/* Ziztu Posts: private content calendar. Everything under a/ is AES-GCM encrypted;
   the key comes from the password (unwrapping a/kw) or the private link (#k=...), and
   stays on this device. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const app = $("#app");
  const TZ_PK = "Asia/Karachi", TZ_ET = "America/New_York";
  const GRACE = 3 * 3600e3; // a slot stays "Post now" for 3 hours, then it counts as overdue
  const IG_APP = "instagram://app", BUSINESS_SUITE = "https://business.facebook.com/latest/home";

  // ---------------------------------------------------------------- icons
  const svg = (body, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
  const I = {
    today: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/>'),
    cal: svg('<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 'stroke-width="2.2"'),
    copy: svg('<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
    down: svg('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>', 'stroke-width="2.2"'),
    left: svg('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="2.2"'),
    right: svg('<path d="M9 5l7 7-7 7"/>', 'stroke-width="2.2"'),
    chev: svg('<path d="M6 9l6 6 6-6"/>', 'stroke-width="2.2"'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>'),
    music: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
    flask: svg('<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    msg: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    ig: svg('<rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".9" fill="currentColor" stroke="none"/>'),
    out: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>'),
    film: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>'),
    key: svg('<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l3 3"/>'),
    spark: svg('<path d="M12 3.5l2.1 5.4 5.4 2.1-5.4 2.1L12 18.5l-2.1-5.4L4.5 11l5.4-2.1z"/><path d="M19 17v4M17 19h4"/>'),
    grid: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
    send: svg('<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>'),
    plus: svg('<path d="M12 6v12M6 12h12"/>', 'stroke-width="2.4"'),
    share: svg('<path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M8.5 10.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2h-1.5"/>'),
    app: svg('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18h3"/>'),
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
  };

  // ---------------------------------------------------------------- theme
  function applyTheme() {
    const th = LS.get("zc.theme", "system");
    const root = document.documentElement;
    if (th === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", th);
    // keep the status bar / browser chrome in step with a manual choice
    $$('meta[name="theme-color"]').forEach((m) => {
      if (m.dataset.media == null) { m.dataset.media = m.getAttribute("media") || ""; m.dataset.content = m.getAttribute("content") || ""; }
      if (th === "system") { m.setAttribute("media", m.dataset.media); m.setAttribute("content", m.dataset.content); }
      else { m.removeAttribute("media"); m.setAttribute("content", th === "dark" ? "#0B0B0C" : "#FFFFFF"); }
    });
  }
  applyTheme();

  // ---------------------------------------------------------------- crypto + network
  const b64u = {
    dec(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); },
    enc(u8) { let s = ""; for (const b of u8) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  };
  let KEY = null;
  let servedOffline = false;
  const netError = (msg) => Object.assign(new Error(msg), { net: true });
  async function importKey(raw) {
    if (raw.length !== 32) throw Object.assign(new Error("key length"), { badKey: true });
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  }
  async function fetchEnc(name, onProgress, expected) {
    const fresh = name === "d" || name === "p";
    let res;
    try {
      res = await fetch("a/" + name + (fresh ? "?t=" + Date.now() : ""), { cache: fresh ? "no-store" : "default" });
    } catch (e) { throw netError(String((e && e.message) || e)); }
    if (!res.ok) throw netError("HTTP " + res.status);
    if (name === "d") servedOffline = res.headers.get("x-zc-offline") === "1";
    let buf;
    try {
      if (onProgress && res.body && res.body.getReader) {
        const total = expected || Number(res.headers.get("content-length")) || 0;
        const reader = res.body.getReader();
        const chunks = []; let got = 0;
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          chunks.push(value); got += value.length;
          if (total) onProgress(Math.min(0.99, got / total));
        }
        buf = new Uint8Array(got); let o = 0;
        for (const c of chunks) { buf.set(c, o); o += c.length; }
        chunks.length = 0;
      } else {
        buf = new Uint8Array(await res.arrayBuffer());
      }
    } catch (e) { throw netError(String((e && e.message) || e)); }
    try {
      return await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(0, 12) }, KEY, buf.subarray(12));
    } catch { throw Object.assign(new Error("decrypt"), { badKey: true }); }
  }

  // ---------------------------------------------------------------- state
  let DATA = null, POSTERS = {}, postersReady = false, lastFetch = 0;
  const VIEWS = ["today", "agenda", "calendar"];
  const FVIEWS = ["week", "library", "sent"];
  const S = {
    cal: LS.get("zc.cal") === "formats" ? "formats" : "posts", // two calendars: Posts (default) and Formats, the last one used opens
    view: VIEWS.includes(LS.get("zc.view")) ? LS.get("zc.view") : "today",
    fview: FVIEWS.includes(LS.get("zc.fview")) ? LS.get("zc.fview") : "week",
    niche: "all",
    acct: "all", status: "all", q: "", // filters last for this visit only, so a fresh open always shows everything
    calMode: LS.get("zc.calMode", "month") === "week" ? "week" : "month",
    calCursor: null, selDay: null, open: {},
  };
  LS.del("zc.acct"); LS.del("zc.status"); // older builds kept filters forever
  let done = LS.get("zc.done", {});      // id -> timestamp (marked posted on this device)
  let undone = LS.get("zc.undone", {});  // id -> true (un-marked a base "posted")

  const now = () => Date.now();
  const t = (p) => (p.at ? Date.parse(p.at) : null);

  function statusOf(p) {
    if (undone[p.id]) return p.at && t(p) < now() ? "overdue" : (p.at ? "to_post" : "unscheduled");
    if (done[p.id]) return "posted";
    if (p.status === "posted") return "posted";
    if (p.status === "scheduled") return t(p) <= now() ? "posted" : "scheduled";
    if (p.status === "to_post") return p.at ? (t(p) < now() ? "overdue" : "to_post") : "unscheduled";
    return "unscheduled";
  }
  const isOpen = (st) => st === "to_post" || st === "overdue";
  const dueNow = (p) => p.at && now() >= t(p) && now() - t(p) <= GRACE;
  const STATUS_LABEL = { to_post: "To post", overdue: "Overdue", scheduled: "Scheduled", posted: "Posted", unscheduled: "Ready" };
  const statusGroup = (st) => (st === "overdue" ? "to_post" : st);
  const onHold = (p) => (p.notes || []).some((n) => /\bhold\b/i.test(n));
  function pillOf(p, st) {
    if (st === "overdue" && dueNow(p)) return ["due", "Due now"];
    if (st === "posted" && p.status === "scheduled" && !done[p.id]) return ["posted", "Went out"];
    if (st === "unscheduled" && onHold(p)) return ["unscheduled", "On hold"];
    if (st === "unscheduled" && !p.caption) return ["unscheduled", "No caption"];
    return [st, STATUS_LABEL[st] || "Ready"];
  }
  const pillHTML = (p, st) => { const [c, l] = pillOf(p, st); return `<span class="pill ${c}">${l}</span>`; };

  // ---------------------------------------------------------------- time formatting
  const fmt = {};
  function F(tz, opts) { const k = tz + JSON.stringify(opts); return (fmt[k] ||= new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts })); }
  const timeIn = (ms, tz) => F(tz, { hour: "numeric", minute: "2-digit" }).format(ms).replace(":00", "");
  const timeInFull = (ms, tz) => F(tz, { hour: "numeric", minute: "2-digit" }).format(ms);
  const dayKey = (ms) => { const p = F(TZ_PK, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms); const g = (x) => p.find((y) => y.type === x).value; return `${g("year")}-${g("month")}-${g("day")}`; };
  const dayLabel = (ms, tz = TZ_PK) => F(tz, { weekday: "short", day: "numeric", month: "short" }).format(ms);
  const monthDay = (ms, tz = TZ_PK) => F(tz, { day: "numeric", month: "short" }).format(ms);
  const keyToDate = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 7)); }; // 12:00 PKT
  const todayKey = () => dayKey(now());
  const addDays = (k, n) => dayKey(keyToDate(k).getTime() + n * 864e5);
  function relDay(k) {
    const diff = Math.round((keyToDate(k) - keyToDate(todayKey())) / 864e5);
    if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday";
    return F(TZ_PK, { weekday: "long" }).format(keyToDate(k));
  }
  function timesHTML(p) {
    if (!p.at) return "";
    const ms = t(p);
    if (p.time_unknown) return `<span class="tm">${esc(monthDay(ms))} · time not recorded</span>`;
    return `<span class="tm"><b>${timeIn(ms, TZ_PK)}</b> PKT · ${timeIn(ms, TZ_ET)} ET${p.suggested ? ' <i class="sug">suggested</i>' : ""}</span>`;
  }
  function countdown(ms) {
    let s = Math.max(0, Math.round((ms - now()) / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (d > 0) return { big: `${d}d ${h}h`, small: `${pad(m)}m` };
    if (h > 0) return { big: `${h}h ${pad(m)}m`, small: `${pad(s)}s` };
    return { big: `${m}m ${pad(s)}s`, small: "" };
  }
  function span(mins) { // 75 -> "1 h 15 min"
    if (mins < 60) return `${mins} min`;
    if (mins < 1440) { const h = Math.floor(mins / 60), m = mins % 60; return `${h} h${m && h < 6 ? " " + m + " min" : ""}`; }
    const d = Math.round(mins / 1440); return `${d} day${d > 1 ? "s" : ""}`;
  }
  function lateText(ms) {
    const m = Math.round((now() - ms) / 60000);
    return m < 5 ? "due now" : `${span(m)} late`;
  }
  function inText(ms) {
    const mins = Math.round((ms - now()) / 60000);
    return mins < 0 ? `${span(-mins)} ago` : `in ${span(Math.max(1, mins))}`;
  }

  // ---------------------------------------------------------------- filtering
  const ACCT_NAME = { ig: "getziztu", rick: "@rickmortyai", fb: "Facebook", insta: "Instagram" };
  const acctName = (a) => ACCT_NAME[a] || a;
  const primaryAcct = (p) => (p.accounts.includes("rick") ? "rick" : p.accounts.includes("ig") ? "ig" : p.accounts[0]);
  const acctHTML = (p) => p.accounts.map((a) => `<span class="acct"><i class="dot ${esc(a)}"></i>${esc(acctName(a))}</span>`).join("");
  const statusOn = () => S.status !== "all" && (S.view !== "today" || !!S.q);
  const inSel = (p) => S.acct === "all" || (S.acct === "insta" ? p.accounts.some((a) => a === "ig" || a === "rick") : p.accounts.includes(S.acct));
  function matches(p, { status = true } = {}) {
    if (!inSel(p)) return false;
    if (status && statusOn() && statusGroup(statusOf(p)) !== S.status) return false;
    if (S.q) {
      const hay = [p.title, p.series, p.keyword, p.caption, p.dm, (p.notes || []).join(" "), p.accounts.map(acctName).join(" ")].join(" ").toLowerCase();
      if (!S.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  const visible = () => DATA.posts.filter(matches);
  const byTime = (a, b) => (t(a) ?? 9e15) - (t(b) ?? 9e15) || (a.order || 0) - (b.order || 0);
  const STATUS_CHIPS = [["to_post", "To post"], ["scheduled", "Scheduled"], ["posted", "Posted"], ["unscheduled", "Ready"]];

  // ---------------------------------------------------------------- render: shell
  function shell() {
    app.innerHTML = `
      <header class="top" id="top">
        <div class="bar">
          <div class="brand"><div class="seal" aria-hidden="true"></div>
            <div class="seg calsw" role="tablist" aria-label="Calendar"><button role="tab" data-cal="posts">Posts</button><button role="tab" data-cal="formats">Formats</button></div>
            <h1 id="ttl" class="sr">Posts</h1></div>
          <button class="icon-btn" id="b-search" aria-label="Search" aria-expanded="false">${I.search}</button>
          <button class="icon-btn" id="b-more" aria-label="Menu" aria-haspopup="true">${I.more}</button>
        </div>
        <div class="search" id="search">
          <input id="q" type="search" placeholder="Title, caption, keyword…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search posts">
          <button class="cancel" id="q-x">Cancel</button>
        </div>
        <div class="chips" id="chips" role="toolbar" aria-label="Filters"></div>
        <div class="offline" id="offline" hidden>Offline: showing the copy saved on this phone</div>
      </header>
      <main id="main"></main>
      <nav class="tabbar" aria-label="Views"><div class="in" id="tabs"></div></nav>`;
    $("#tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) (b.dataset.v === curView() && !S.q ? reselect() : setView(b.dataset.v)); });
    $$(".calsw button").forEach((b) => b.addEventListener("click", () => (b.dataset.cal === S.cal ? (S.q ? toggleSearch(false) : reselect()) : setCal(b.dataset.cal))));
    $("#b-search").addEventListener("click", () => toggleSearch());
    $("#q-x").addEventListener("click", () => toggleSearch(false));
    $("#b-more").addEventListener("click", openMenu);
    let qT = null;
    $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value.trim(); render(); }, 120); });
    $("#q").addEventListener("keydown", (e) => { if (e.key === "Escape") toggleSearch(false); if (e.key === "Enter") e.target.blur(); });
    $("#chips").addEventListener("click", onChip);
    $("#main").addEventListener("click", onMainClick);
    window.addEventListener("scroll", () => $("#top")?.classList.toggle("scrolled", scrollY > 4), { passive: true });
    window.addEventListener("resize", measureTop, { passive: true });
  }
  function toggleSearch(force) {
    const s = $("#search"); const open = force ?? !s.classList.contains("open");
    s.classList.toggle("open", open);
    $("#b-search").classList.toggle("on", open); $("#b-search").setAttribute("aria-expanded", String(open));
    if (open) { $("#q").focus(); }
    else { $("#q").value = ""; $("#q").blur(); if (S.q) { S.q = ""; render(); } }
    measureTop();
  }
  const TABS = {
    posts: [["today", I.today, "Today"], ["agenda", I.list, "Agenda"], ["calendar", I.cal, "Calendar"]],
    formats: [["week", I.spark, "This week"], ["library", I.grid, "Library"], ["sent", I.send, "Sent"]],
  };
  const TITLES = { today: "Today", agenda: "Agenda", calendar: "Calendar", week: "This week", library: "Library", sent: "Sent" };
  const curView = () => (S.cal === "formats" ? S.fview : S.view);
  let tabsFor = "";
  function renderTabs() {
    if (tabsFor === S.cal) return;
    tabsFor = S.cal;
    $("#tabs").innerHTML = TABS[S.cal].map(([v, ic, l]) => `<button class="tab" data-v="${v}">${ic}<span>${l}</span></button>`).join("");
    $$(".calsw button").forEach((b) => { const on = b.dataset.cal === S.cal; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    const q = $("#q");
    q.placeholder = S.cal === "formats" ? "Name, niche, hook…" : "Title, caption, keyword…";
    q.setAttribute("aria-label", S.cal === "formats" ? "Search formats" : "Search posts");
  }
  function setCal(c) {
    if (c === S.cal) return;
    S.cal = c; LS.set("zc.cal", c);
    closeMenu(); clearSearch(); window.scrollTo(0, 0); render();
  }
  function clearSearch() {
    if ($("#search").classList.contains("open")) { S.q = ""; $("#q").value = ""; $("#q").blur(); $("#search").classList.remove("open"); $("#b-search").classList.remove("on"); $("#b-search").setAttribute("aria-expanded", "false"); }
  }
  function setView(v) {
    if (S.cal === "formats") { S.fview = v; LS.set("zc.fview", v); }
    else { S.view = v; LS.set("zc.view", v); }
    if ($("#search").classList.contains("open")) { S.q = ""; $("#q").value = ""; $("#q").blur(); $("#search").classList.remove("open"); $("#b-search").classList.remove("on"); $("#b-search").setAttribute("aria-expanded", "false"); }
    window.scrollTo(0, 0); render();
  }
  function reselect() { // tapping the tab you're on: back to the start of that view
    if (S.cal === "posts" && S.view === "calendar") { S.selDay = todayKey(); S.calCursor = S.selDay.slice(0, 7); render(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function measureTop() { const tp = $("#top"); if (tp) document.documentElement.style.setProperty("--top-h", tp.offsetHeight + "px"); }

  function chips() {
    $("#chips").hidden = false;
    if (S.cal === "formats") { fchips(); return; }
    const all = DATA.posts;
    const inAcct = inSel;
    const counts = {};
    for (const p of all) if (inAcct(p)) { const g = statusGroup(statusOf(p)); counts[g] = (counts[g] || 0) + 1; }
    const accts = [["all", "All"], ["insta", "Instagram"], ["fb", "Facebook"], ["ig", "getziztu"], ["rick", "@rickmortyai"]];
    const el = $("#chips");
    el.innerHTML =
      accts.map(([k, l]) => `<button class="chip ${S.acct === k ? "on" : ""}" data-a="${k}" aria-pressed="${S.acct === k}">${k === "all" ? "" : k === "insta" ? `<i class="dot ig"></i><i class="dot rick dot2"></i>` : `<i class="dot ${k}"></i>`}${l}</button>`).join("") +
      (S.view === "today" && !S.q ? "" : `<span class="chip-sep" aria-hidden="true"></span>` +
      STATUS_CHIPS.map(([k, l]) => `<button class="chip ${S.status === k ? "on" : ""}" data-s="${k}" aria-pressed="${S.status === k}">${l}<span class="ct num">${counts[k] || 0}</span></button>`).join(""));
    const on = $(".chip.on[data-s]", el);
    if (on) { const r = on.getBoundingClientRect(), c = el.getBoundingClientRect(); if (r.right > c.right - 8 || r.left < c.left) el.scrollLeft += r.left - c.left - 60; }
  }
  function onChip(e) {
    const b = e.target.closest(".chip"); if (!b) return;
    if (b.dataset.n) { S.niche = S.niche === b.dataset.n && b.dataset.n !== "all" ? "all" : b.dataset.n; render(); return; }
    if (b.dataset.a) S.acct = b.dataset.a;
    if (b.dataset.s) S.status = S.status === b.dataset.s ? "all" : b.dataset.s;
    render();
  }
  function filterNote() {
    if (S.acct === "all" && !statusOn()) return "";
    const parts = [];
    if (S.acct !== "all") parts.push(acctName(S.acct));
    if (statusOn()) parts.push((STATUS_CHIPS.find(([k]) => k === S.status) || [0, ""])[1]);
    return `<div class="fnote"><span>Showing <b>${esc(parts.join(" · "))}</b> only</span><button class="link" data-clear>Show all</button></div>`;
  }

  function posterStyle(p) {
    const src = p.poster && POSTERS[p.poster];
    return src ? `style="background-image:url('${src}')"` : "";
  }
  function posterCls(p) {
    const has = p.poster && POSTERS[p.poster];
    return (has ? "" : postersReady || !p.poster ? "none " : "ph ") + (p.imgs && !p.v ? "sq" : "");
  }
  const noMedia = (p) => !p.v && !(p.imgs && p.imgs.length);

  function rowHTML(p) {
    const st = statusOf(p);
    const open = isOpen(st);
    const sub = `<div class="sub">${acctHTML(p)}${p.at ? timesHTML(p) : `<span>${esc(p.series)}</span>`}${st === "overdue" ? `<span class="late ${dueNow(p) ? "due" : ""}">${esc(lateText(t(p)))}</span>` : ""}</div>`;
    return `<div class="row ${st === "posted" ? "done" : ""} ${open ? "open" : ""}">
      <button class="row-main" data-id="${esc(p.id)}">
        <div class="poster ${posterCls(p)}" ${posterStyle(p)}></div>
        <div class="mid"><div class="t">${esc(p.title)}</div>${sub}</div>
        ${open ? "" : pillHTML(p, st)}
      </button>
      ${open ? `<button class="tick ${st === "overdue" ? (dueNow(p) ? "due" : "late") : ""}" data-done="${esc(p.id)}" aria-label="Mark “${esc(p.title)}” as posted"><i>${I.check}</i></button>` : ""}
    </div>`;
  }
  const sec = (title, meta = "", extra = "") => `<div class="h-sec"><h2>${esc(title)}</h2><span class="meta">${meta}</span>${extra}</div>`;
  const list = (posts) => `<div class="list">${posts.map(rowHTML).join("")}</div>`;
  function fold(key, label, posts) {
    if (!posts.length) return "";
    const openF = !!S.open[key];
    return `<button class="fold ${openF ? "on" : ""}" data-fold="${key}" aria-expanded="${openF}"><span>${label}</span>${I.chev}</button>${openF ? list(posts) : ""}`;
  }

  // ---------------------------------------------------------------- views
  let tick = null, sig = "";
  function render() {
    if (!DATA) return;
    renderTabs();
    $$(".tab").forEach((b) => { const on = b.dataset.v === curView(); b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    $("#ttl").textContent = (S.cal === "formats" ? "Formats: " : "Posts: ") + (S.q ? "Search" : TITLES[curView()]);
    $("#offline").hidden = !servedOffline;
    chips(); measureTop();
    clearInterval(tick); tick = null;
    const m = $("#main");
    if (S.cal === "formats") { renderFormats(m); sig = statusSig(); return; }
    if (S.q) renderSearch(m);
    else if (S.view === "today") renderToday(m);
    else if (S.view === "agenda") renderAgenda(m);
    else renderCalendar(m);
    sig = statusSig();
  }
  const statusSig = () => todayKey() + DATA.posts.map((p) => statusOf(p)[0] + (statusOf(p) === "overdue" && dueNow(p) ? "!" : "")).join("");

  function onMainClick(e) {
    if (S.cal === "formats") { onFormatsClick(e); return; }
    const el = e.target.closest("[data-done],[data-id],[data-fold],[data-go],[data-clear],[data-clearq],[data-doneall]");
    if (!el || !$("#main").contains(el)) return;
    if (el.dataset.done) { tickOff(el, el.dataset.done); return; }
    if (el.dataset.id) { openPost(el.dataset.id); return; }
    if (el.dataset.fold) { S.open[el.dataset.fold] = !S.open[el.dataset.fold]; render(); return; }
    if (el.dataset.go) { S.status = el.dataset.go; setView("agenda"); return; }
    if (el.dataset.clear !== undefined) { S.acct = "all"; S.status = "all"; render(); $("#chips").scrollLeft = 0; return; }
    if (el.dataset.clearq !== undefined) { toggleSearch(false); return; }
    if (el.dataset.doneall !== undefined) { markMany(el.dataset.doneall.split(" ")); }
  }
  function tickOff(btn, id) {
    const p = DATA.posts.find((x) => x.id === id); if (!p) return;
    btn.classList.add("ticked");
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => setPosted(p, true), 260);
  }

  function renderToday(m) {
    const posts = visible();
    const st = new Map(posts.map((p) => [p, statusOf(p)]));
    const open = (p) => isOpen(st.get(p));
    const due = posts.filter((p) => open(p) && p.at && dueNow(p)).sort(byTime);
    const hero = due.length ? due[due.length - 1] : posts.filter((p) => open(p) && p.at && t(p) > now()).sort(byTime)[0];
    const overdue = posts.filter((p) => st.get(p) === "overdue" && p !== hero).sort(byTime);
    const tk = todayKey(), tmk = addDays(tk, 1);
    const onDay = (k) => posts.filter((p) => p.at && p !== hero && st.get(p) !== "overdue" && dayKey(t(p)) === k).sort(byTime);
    const todayAll = onDay(tk), tomorrowAll = onDay(tmk);
    const ready = posts.filter((p) => st.get(p) === "unscheduled").sort(byTime);
    const toPostCount = posts.filter(open).length;
    const doneCount = posts.filter((p) => st.get(p) === "posted").length;
    const filtered = S.acct !== "all";

    let h = filterNote();
    if (hero) h += heroHTML(hero, t(hero) <= now());
    else h += `<section class="hero calm"><div class="body"><div class="kick">All clear</div><h3>Nothing left to post${filtered ? " for this filter" : ""}.</h3><p class="times">New reels show up here as soon as they're added.</p></div></section>`;
    h += `<div class="stats">
      <button class="stat" data-go="to_post"><b class="num">${toPostCount}</b><span>to post</span></button>
      <button class="stat" data-go="unscheduled"><b class="num">${ready.length}</b><span>ready, no time</span></button>
      <button class="stat" data-go="posted"><b class="num">${doneCount}</b><span>posted</span></button></div>`;

    if (overdue.length) {
      const all = overdue.length > 1 ? `<button class="link" data-doneall="${esc(overdue.map((p) => p.id).join(" "))}">Mark all posted</button>` : "";
      h += sec("Overdue", `${overdue.length}`, all) + list(overdue);
    }
    const tOpen = todayAll.filter((p) => st.get(p) !== "posted"), tDone = todayAll.filter((p) => st.get(p) === "posted");
    h += sec("Today", esc(dayLabel(keyToDate(tk))));
    h += tOpen.length ? list(tOpen) : `<div class="empty sm">${tDone.length ? "Nothing else today." : "Nothing scheduled today."}</div>`;
    h += fold("today-done", `${tDone.length} done earlier today`, tDone);
    if (tomorrowAll.length) {
      const mOpen = tomorrowAll.filter((p) => st.get(p) !== "posted"), mDone = tomorrowAll.filter((p) => st.get(p) === "posted");
      h += sec("Tomorrow", esc(dayLabel(keyToDate(tmk)))) + (mOpen.length ? list(mOpen) : "") + fold("tomorrow-done", `${mDone.length} done`, mDone);
    }
    if (ready.length) h += sec("Ready, no time set", `${ready.length}`) + list(ready.slice(0, 5)) + fold("ready-more", `${ready.length - 5} more ready`, ready.slice(5));
    m.innerHTML = h;

    if (hero) {
      const upd = () => {
        const el = $("#cd"); if (!el) return;
        const ms = t(hero);
        if (ms > now()) {
          if (el.dataset.mode === "now") { render(); return; }
          const c = countdown(ms); el.innerHTML = `${c.big}<small>${c.small}</small>`;
        } else {
          if (el.dataset.mode !== "now" || !dueNow(hero)) { render(); return; }
          const late = lateText(ms); el.textContent = late === "due now" ? "Due now" : late;
        }
      };
      upd(); tick = setInterval(upd, 1000);
    }
  }
  function heroHTML(p, isNow) {
    const ms = t(p);
    const tags = [];
    if (p.trial) tags.push(`<span class="tag hl">${I.flask}Trial reel</span>`);
    if (p.suggested) tags.push(`<span class="tag">Suggested time</span>`);
    if (noMedia(p)) tags.push(`<span class="tag">Video still uploading</span>`);
    return `<section class="hero ${isNow ? "now" : ""}" aria-label="${isNow ? "Post now" : "Up next"}">
      <button class="hero-main" data-id="${esc(p.id)}">
        <div class="poster ${posterCls(p)}" ${posterStyle(p)}></div>
        <div class="body">
          <div class="kick">${isNow ? "Post now" : "Up next"} · ${esc(acctName(primaryAcct(p)))}</div>
          <div class="cd num" id="cd" data-mode="${isNow ? "now" : "next"}"></div>
          <h3>${esc(p.title)}</h3>
          <div class="times"><b>${timeInFull(ms, TZ_PK)}</b> PKT · ${timeInFull(ms, TZ_ET)} ET<br><span>${esc(relDay(dayKey(ms)))}, ${esc(monthDay(ms))}</span></div>
          ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
        </div>
      </button>
      <div class="acts">
        <button class="btn pri" data-id="${esc(p.id)}">Open post</button>
        <button class="btn sec" data-done="${esc(p.id)}">${I.check}<span>Mark posted</span></button>
      </div>
    </section>`;
  }

  function grouped(posts) {
    const groups = new Map();
    for (const p of posts) { const k = p.at ? dayKey(t(p)) : "~"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    const tk = todayKey();
    let h = "";
    for (const [k, l] of groups) {
      h += k === "~"
        ? `<div class="day-h" id="day-none"><b>No time set</b><span>post whenever it fits</span><span class="n">${l.length}</span></div>`
        : `<div class="day-h ${k === tk ? "today" : ""}" id="day-${k}"><b>${esc(relDay(k))}</b><span>${esc(monthDay(keyToDate(k)))}</span><span class="n">${l.length}</span></div>`;
      h += list(l);
    }
    return h;
  }
  function renderAgenda(m) {
    const posts = visible().sort(byTime);
    let h = filterNote();
    if (!posts.length) { m.innerHTML = h + emptyFilter(); return; }
    // asked for Posted: the posted list IS the point, so all of it, newest day first, nothing folded
    // (owner, 24 Nov: "I can't see all"; the fold below hid every one of them behind "Show 19 already posted")
    if (statusOn() && S.status === "posted") { m.innerHTML = h + grouped(posts.slice().reverse()); return; }
    // otherwise what already went out before now folds away; anything still open stays in view
    const gone = (p) => p.at && t(p) < now() && statusOf(p) === "posted";
    const nGone = posts.filter(gone).length;
    const shown = S.open.past ? posts : posts.filter((p) => !gone(p));
    if (nGone) h += `<button class="fold top ${S.open.past ? "on" : ""}" data-fold="past" aria-expanded="${!!S.open.past}"><span>${S.open.past ? "Hide" : "Show"} ${nGone} already posted</span>${I.chev}</button>`;
    h += shown.length ? grouped(shown) : `<div class="empty sm">Everything here is posted.</div>`;
    m.innerHTML = h;
  }
  function renderSearch(m) {
    const posts = visible().sort(byTime);
    if (!posts.length) {
      m.innerHTML = filterNote() + `<div class="empty"><b>No posts match “${esc(S.q)}”</b>Try a title word or a keyword like STICK.<br><button class="btn sec" data-clearq>Clear search</button></div>`;
      return;
    }
    m.innerHTML = filterNote() + `<div class="res-h">${posts.length} result${posts.length > 1 ? "s" : ""}</div>` + grouped(posts);
  }
  const emptyFilter = () => `<div class="empty"><b>No posts match</b>Nothing fits this filter.<br><button class="btn sec" data-clear>Show all posts</button></div>`;

  // ---------------------------------------------------------------- calendar
  let slide = "";
  function renderCalendar(m) {
    const posts = visible();
    const byDay = new Map();
    for (const p of posts) if (p.at) { const k = dayKey(t(p)); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(p); }
    const tk = todayKey();
    S.selDay ||= tk;
    if (!S.calCursor) S.calCursor = S.selDay.slice(0, 7);
    let h = filterNote() + `<div class="seg wide" role="tablist"><button role="tab" data-m="month" aria-selected="${S.calMode === "month"}" class="${S.calMode === "month" ? "on" : ""}">Month</button><button role="tab" data-m="week" aria-selected="${S.calMode === "week"}" class="${S.calMode === "week" ? "on" : ""}">Week</button></div>
      <div class="cal-head">
      <h2 id="c-title"></h2>
      <button class="cal-nav txt" id="c-today">Today</button>
      <button class="cal-nav" id="c-prev" aria-label="Previous ${S.calMode}">${I.left}</button>
      <button class="cal-nav" id="c-next" aria-label="Next ${S.calMode}">${I.right}</button></div>`;
    const anim = slide ? ` anim-${slide}` : ""; slide = "";
    if (S.calMode === "month") {
      const [y, mo] = S.calCursor.split("-").map(Number);
      const first = new Date(Date.UTC(y, mo - 1, 1));
      const startDow = (first.getUTCDay() + 6) % 7; // Monday first
      const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      h += `<div class="month${anim}" id="month">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="dow" aria-hidden="true">${d[0]}</div>`).join("")}`;
      const cells = Math.ceil((startDow + days) / 7) * 7;
      for (let i = 0; i < cells; i++) {
        const d = new Date(Date.UTC(y, mo - 1, 1 - startDow + i));
        const k = d.toISOString().slice(0, 10);
        const l = (byDay.get(k) || []).sort(byTime);
        const dots = l.slice(0, 3).map((p) => `<i class="dot ${p.accounts.length > 1 ? "ig" : esc(p.accounts[0])}"></i>`).join("");
        const label = `${F("UTC", { weekday: "long", day: "numeric", month: "long" }).format(d)}${k === tk ? ", today" : ""}: ${l.length ? l.length + " post" + (l.length > 1 ? "s" : "") : "no posts"}`;
        h += `<button class="cell ${d.getUTCMonth() !== mo - 1 ? "out" : ""} ${k === tk ? "today" : ""} ${k === S.selDay ? "sel" : ""}" data-k="${k}" aria-label="${label}" ${k === S.selDay ? 'aria-pressed="true"' : ""}>
          <span class="d num">${d.getUTCDate()}</span><span class="dots">${dots}${l.length > 3 ? `<span class="more">+${l.length - 3}</span>` : ""}</span></button>`;
      }
      h += `</div>`;
      const sel = (byDay.get(S.selDay) || []).sort(byTime);
      h += `<div class="daylist" id="daylist">` + sec(relDay(S.selDay) + " · " + monthDay(keyToDate(S.selDay)), sel.length ? `${sel.length} post${sel.length > 1 ? "s" : ""}` : "");
      h += sel.length ? list(sel) : `<div class="empty sm">Nothing on this day.</div>`;
      h += `</div>`;
      m.innerHTML = h;
      $("#c-title").innerHTML = `${F("UTC", { month: "long" }).format(first)} <span>${y}</span>`;
      m.querySelectorAll(".cell").forEach((c) => c.addEventListener("click", () => { S.selDay = c.dataset.k; if (c.classList.contains("out")) { slide = c.dataset.k > S.calCursor ? "l" : "r"; S.calCursor = c.dataset.k.slice(0, 7); } render(); }));
      const month = (n) => { slide = n > 0 ? "l" : "r"; S.calCursor = shiftMonth(S.calCursor, n); const [yy, mm] = S.calCursor.split("-"); S.selDay = S.calCursor === tk.slice(0, 7) ? tk : `${yy}-${mm}-01`; render(); };
      $("#c-prev").onclick = () => month(-1);
      $("#c-next").onclick = () => month(1);
      onSwipe($("#month"), month);
      onSwipe($("#daylist"), (n) => { S.selDay = addDays(S.selDay, n); S.calCursor = S.selDay.slice(0, 7); render(); });
    } else {
      const sd = keyToDate(S.selDay);
      const dow = (sd.getUTCDay() + 6) % 7;
      const mon = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate() - dow));
      h += `<div class="week${anim}" id="week">`;
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon.getTime() + i * 864e5); const k = d.toISOString().slice(0, 10);
        const l = (byDay.get(k) || []).sort(byTime);
        h += `<div class="wday ${k === tk ? "today" : ""}"><div class="lab"><small>${F("UTC", { weekday: "short" }).format(d)}</small><b class="num">${d.getUTCDate()}</b></div>`;
        h += l.length ? `<div class="strip">${l.map(tileHTML).join("")}</div>` : `<div class="none">No posts</div>`;
        h += `</div>`;
      }
      h += `</div>`;
      m.innerHTML = h;
      const end = new Date(mon.getTime() + 6 * 864e5);
      $("#c-title").textContent = `${F("UTC", { day: "numeric", month: "short" }).format(mon)} – ${F("UTC", { day: "numeric", month: "short" }).format(end)}`;
      const week = (n) => { slide = n > 0 ? "l" : "r"; S.selDay = addDays(S.selDay, 7 * n); S.calCursor = S.selDay.slice(0, 7); render(); };
      $("#c-prev").onclick = () => week(-1);
      $("#c-next").onclick = () => week(1);
      onSwipe($("#week"), week);
    }
    $("#c-today").onclick = () => { S.selDay = tk; S.calCursor = tk.slice(0, 7); render(); };
    m.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => { S.calMode = b.dataset.m; LS.set("zc.calMode", S.calMode); S.calCursor = S.selDay.slice(0, 7); render(); }));
  }
  function shiftMonth(c, n) { const [y, m] = c.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); }
  function tileHTML(p) {
    const st = statusOf(p);
    const posted = st === "posted";
    return `<button class="tile ${posted ? "done" : ""}" data-id="${esc(p.id)}" aria-label="${esc(p.title)}, ${p.time_unknown ? "time not recorded" : timeIn(t(p), TZ_PK) + " PKT"}, ${pillOf(p, st)[1]}"><div class="poster ${posterCls(p)}" ${posterStyle(p)}>
      <span class="badge">${p.accounts.map((a) => `<i class="dot ${esc(a)}"></i>`).join("")}</span>
      ${posted ? `<span class="chk">${I.check}</span>` : ""}</div>
      <div class="tt">${esc(p.title)}</div><div class="tm num">${p.time_unknown ? "—" : timeIn(t(p), TZ_PK)}${st === "overdue" ? " · late" : ""}</div></button>`;
  }
  function onSwipe(el, cb) {
    if (!el) return;
    let x0 = null, y0 = 0, t0 = 0;
    el.addEventListener("touchstart", (e) => {
      const strip = e.target.closest(".strip");
      if (e.touches.length !== 1 || (strip && strip.scrollWidth > strip.clientWidth + 4)) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - t0 < 900) cb(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  // ---------------------------------------------------------------- marking posted (with undo)
  function savedMarks() { LS.set("zc.done", done); LS.set("zc.undone", undone); }
  function applyPosted(p, posted) {
    if (posted) {
      delete undone[p.id];
      if (!(p.status === "posted" || (p.status === "scheduled" && t(p) <= now()))) done[p.id] = Date.now();
    } else {
      if (done[p.id]) delete done[p.id];
      if (statusOf(p) === "posted") undone[p.id] = true;
    }
  }
  function refreshAfterMark() {
    render();
    if (sheetEl && sheetPost) syncSheetStatus();
  }
  function setPosted(p, posted) {
    const before = { d: done[p.id], u: undone[p.id] };
    applyPosted(p, posted); savedMarks(); refreshAfterMark();
    toast(posted ? `Marked as posted` : `Marked as not posted`, { label: "Undo", fn: () => {
      if (before.d) done[p.id] = before.d; else delete done[p.id];
      if (before.u) undone[p.id] = before.u; else delete undone[p.id];
      savedMarks(); refreshAfterMark();
    } });
  }
  function markMany(ids) {
    const ps = ids.map((id) => DATA.posts.find((x) => x.id === id)).filter(Boolean);
    const snap = JSON.stringify([done, undone]);
    ps.forEach((p) => applyPosted(p, true)); savedMarks(); refreshAfterMark();
    toast(`Marked ${ps.length} as posted`, { label: "Undo", fn: () => { [done, undone] = JSON.parse(snap); savedMarks(); refreshAfterMark(); } });
  }

  // ---------------------------------------------------------------- post sheet
  const blobCache = new Map(); // asset name -> {pr, f, listeners}; most recent last, at most 3 kept
  function getBlob(name, type, size, onProgress) {
    let e = blobCache.get(name);
    if (!e) {
      e = { f: 0, listeners: new Set() };
      e.pr = fetchEnc(name, (f) => { e.f = f; e.listeners.forEach((fn) => fn(f)); }, size ? size + 28 : 0).then((buf) => new Blob([buf], { type }));
      e.pr.catch(() => blobCache.delete(name));
      blobCache.set(name, e);
      while (blobCache.size > 3) blobCache.delete(blobCache.keys().next().value);
    } else { blobCache.delete(name); blobCache.set(name, e); }
    if (onProgress) { e.listeners.add(onProgress); onProgress(e.f); }
    return e;
  }
  const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "reel";

  let sheetEl = null, scrimEl = null, sheetPost = null, sheetUrls = [], lastFocus = null;
  function whenLine(p, st) {
    if (!p.at || p.time_unknown) return "";
    const ms = t(p);
    if (st === "to_post") return `Post ${inText(ms)}`;
    if (st === "overdue") return dueNow(p) ? (now() - ms < 300e3 ? "Due now" : `Due ${inText(ms)}`) : `Not posted yet · ${lateText(ms)}`;
    if (st === "scheduled") return `Goes out on its own ${inText(ms)}`;
    if (st === "posted") return done[p.id] ? "Marked posted on this phone" : p.status === "scheduled" ? `Went out ${inText(ms)}` : `Posted ${inText(ms)}`;
    return "";
  }
  function openPost(id, { push = true } = {}) {
    const p = DATA.posts.find((x) => x.id === id);
    if (!p) return;
    closeSheet(true);
    sheetPost = p;
    lastFocus = document.activeElement;
    const st = statusOf(p);
    const ms = t(p);
    const isFB = !p.accounts.includes("ig") && !p.accounts.includes("rick");
    const auto = p.status === "scheduled"; // goes out from a scheduler, nothing to post by hand
    const from = primaryAcct(p);
    const tagCount = (p.hashtags || "").split(/\s+/).filter((x) => x.startsWith("#")).length;

    const live = auto || st === "posted"; // nothing left to post by hand
    const tips = [];
    if (!live) {
      if (p.trial) tips.push(["hl", I.flask, "Post as a <b>Trial reel</b>: turn Trial on before you share."]);
      if (p.accounts.includes("rick")) tips.push(["", I.ig, "Switch to <b>@rickmortyai</b> in Instagram first."]);
      if (p.music) tips.push(["", I.music, `<b>Music:</b> ${esc(p.music)}`]);
    }
    const notes = [];
    if (live && p.music) notes.push(["", I.music, `<b>Music:</b> ${esc(p.music)}`]);
    for (const n of p.notes || []) notes.push(["", I.info, esc(n)]);
    if (p.src) notes.push(["", I.info, `Caption from: ${esc(p.src)}`]);

    const field = (k, label, val, miss, extra = "", name = label) => `<div class="field" data-f="${k}"><div class="fh"><small>${label}</small><span class="ok-mark" aria-hidden="true">${I.check}Copied</span>
        <button class="copy" data-copy="${k}" ${val ? "" : "disabled"} aria-label="Copy ${esc(name.toLowerCase())}">${I.copy}<span>Copy</span></button></div>
        <div class="val ${k === "kw" ? "kw" : ""} ${k === "caption" ? "clamp c6" : k === "dm" ? "clamp" : ""}">${val ? esc(val) : `<span class="missing">${miss}</span>`}</div>${extra}</div>`;
    const step = (n, title, sub = "") => `<div class="step-h"><span class="n">${n}</span><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div></div>`;
    // owner, 23 Nov: "can we add button in calendar that automatically open the post uploaded to instagram app". A web page can't hand a file to
    // Instagram directly; the closest is one tap: the caption goes to the clipboard and the share sheet opens with the video, then Instagram > Reels.
    // With that button, saving to Photos first is optional, so Save video becomes the quiet secondary button.
    const igShare = !live && !isFB && !!p.v;
    const media = p.v
      ? `<div class="vid-row"><div class="media" id="media"><div class="pv" ${p.poster && POSTERS[p.poster] ? `style="background-image:url('${POSTERS[p.poster]}')"` : ""}></div><div class="load" id="load">${ring(0)}</div></div>
          <div class="vid-side"><button class="btn ${igShare ? "ghost" : "pri"} block" id="save" disabled>${I.down}<span id="save-l">Loading…</span></button>
          <p class="hint" id="save-hint">${igShare ? "Only if you want a copy in Photos." : "Opens the share sheet. Tap <b>Save Video</b> to put it in Photos."}</p><p class="hint num">${Math.round(p.v.dur)} s · ${(p.v.size / 1e6).toFixed(1)} MB</p></div></div>`
      : p.imgs && p.imgs.length
        ? `<div class="gallery" id="gal">${p.imgs.map((im, i) => `<div class="g" data-i="${i}" style="background-image:url('${POSTERS[im.t] || ""}')"></div>`).join("")}</div>
          <button class="btn pri block" id="save" disabled>${I.down}<span id="save-l">Loading images…</span></button><p class="hint c">Opens the share sheet. Tap <b>Save ${p.imgs.length > 1 ? p.imgs.length + " Images" : "Image"}</b>.</p>`
        : `<div class="nomedia">${I.film}<div><b>Video not uploaded yet</b><span>It's still being prepared and shows up here soon.</span></div></div>`;
    const postBtn = live ? "" : isFB
      ? `<a class="btn pri block" id="go" href="${BUSINESS_SUITE}" target="_blank" rel="noopener">${I.out}<span>${p.caption ? "Copy caption & open Business Suite" : "Open Business Suite"}</span></a>`
      : igShare
        ? `<button class="btn pri block" id="igs" disabled>${I.ig}<span id="igs-l">Loading video…</span></button>
           <p class="hint" id="igs-hint">${p.caption ? "Copies the caption and opens the share sheet. Tap <b>Instagram</b>, pick <b>Reels</b>, then paste the caption." : "Opens the share sheet. Tap <b>Instagram</b>, then pick <b>Reels</b>."}</p>
           <a class="alt-link" id="go" href="${IG_APP}">${p.caption ? "Or copy the caption and just open Instagram" : "Or just open Instagram"}</a>`
        : `<a class="btn pri block" id="go" href="${IG_APP}">${I.ig}<span>${p.caption ? "Copy caption & open Instagram" : "Open Instagram"}</span></a>`;
    const hasReply = p.keyword || p.dm;

    sheetEl = document.createElement("section"); sheetEl.className = "sheet";
    sheetEl.setAttribute("role", "dialog"); sheetEl.setAttribute("aria-modal", "true"); sheetEl.setAttribute("aria-labelledby", "sh-title"); sheetEl.tabIndex = -1;
    scrimEl = document.createElement("div"); scrimEl.className = "scrim";
    sheetEl.innerHTML = `
      <div class="grab" aria-hidden="true"><i></i></div>
      <div class="sh-top"><div class="acct-l">${acctHTML(p)}</div><span id="sh-pill">${pillHTML(p, st)}</span>
        <button class="icon-btn" id="sh-x" aria-label="Close">${I.close}</button></div>
      <div class="scroll" id="sh-scroll">
        <h2 id="sh-title">${esc(p.title)}</h2>
        <div class="meta">${esc(p.series)}${p.suggested ? " · suggested time" : ""}</div>
        ${p.at ? `<div class="when"><div><small>Pakistan</small><b class="num">${p.time_unknown ? "—" : timeInFull(ms, TZ_PK)}</b><span>${dayLabel(ms, TZ_PK)}</span></div>
          <div><small>US Eastern</small><b class="num">${p.time_unknown ? "—" : timeInFull(ms, TZ_ET)}</b><span>${dayLabel(ms, TZ_ET)}</span></div></div>
          <div class="cdline ${st}" id="sh-when">${whenLine(p, st)}</div>` : `<div class="cdline">No time set: post it whenever it fits.</div>`}
        ${auto ? `<div class="callout">${I.today}<span>${st === "posted" ? "Went out from the scheduler. Nothing to do." : "Already scheduled. It goes out on its own."}</span></div>` : ""}

        <div class="step">${step(1, igShare ? "The video" : p.imgs && !p.v ? "Save the images" : "Save the video")}${media}</div>
        <div class="step">${step(2, live ? "Caption" : isFB ? "Post on Facebook" : `Post from ${esc(acctName(from))}`, live ? "" : isFB ? "Upload it in Business Suite (Facebook only)." : igShare ? "One tap sends the video to Instagram. Paste the caption there." : `Pick the saved ${p.imgs && !p.v ? "images" : "video"}, then paste the caption.`)}
          ${tips.length ? `<ul class="notes tips">${tips.map(([c, ic, tx]) => `<li class="${c}">${ic}<span>${tx}</span></li>`).join("")}</ul>` : ""}
          ${postBtn}
          ${field("caption", `Caption${tagCount ? ` <i>· ${tagCount} hashtags included</i>` : ""}`, p.caption, "No caption written yet", "", "Caption")}
          ${p.hashtags ? field("tags", "Hashtags only", p.hashtags, "No hashtags") : ""}
        </div>
        ${hasReply ? `<div class="step">${step(3, "Set the comment auto-reply", "So everyone who comments the keyword gets the DM.")}
          ${field("kw", "Comment keyword", p.keyword, "No keyword")}
          ${field("dm", "DM reply", p.dm, p.keyword ? "No DM reply was saved" : "No DM reply", p.dm_note ? `<p class="fnote-in">${I.msg}<span>${esc(p.dm_note)}</span></p>` : "")}</div>` : ""}
        <button class="toggle-row" id="mark" role="switch" aria-checked="${st === "posted"}"><div class="tx"><b>Posted</b><span id="mark-sub"></span></div><span class="sw ${st === "posted" ? "on" : ""}"></span></button>
        ${p.link ? `<a class="btn ghost block" style="margin-top:12px" href="${esc(p.link)}" target="_blank" rel="noopener">${I.link}<span>Open the live post</span></a>` : ""}
        ${notes.length ? `<ul class="notes">${notes.map(([c, ic, tx]) => `<li class="${c}">${ic}<span>${tx}</span></li>`).join("")}</ul>` : ""}
        <div class="foot">${esc(p.id)}</div>
      </div>`;
    document.body.append(scrimEl, sheetEl);
    document.body.classList.add("sheet-open"); document.documentElement.classList.add("sheet-open");
    syncSheetStatus();
    // "Show all" only where the text really is cut off
    $$(".val.clamp", sheetEl).forEach((v) => {
      if (v.scrollHeight > v.clientHeight + 2) {
        const b = document.createElement("button"); b.className = "more"; b.textContent = "Show all";
        const expand = () => { v.classList.remove("clamp"); b.remove(); };
        b.addEventListener("click", expand); v.addEventListener("click", expand, { once: true });
        v.after(b);
      } else v.classList.remove("clamp");
    });
    requestAnimationFrame(() => { scrimEl?.classList.add("in"); sheetEl?.classList.add("in"); });
    setTimeout(() => { scrimEl?.classList.add("in"); sheetEl?.classList.add("in"); }, 50); // if rAF is throttled
    scrimEl.addEventListener("click", () => history.back());
    $("#sh-x", sheetEl).addEventListener("click", () => history.back());
    if (push) history.pushState({ sheet: id }, "", location.href);
    dragToClose();
    sheetEl.focus({ preventScroll: true });

    const texts = { caption: p.caption, tags: p.hashtags, kw: p.keyword, dm: p.dm };
    $$("[data-copy]", sheetEl).forEach((b) => b.addEventListener("click", () => copyText(texts[b.dataset.copy], b)));
    $("#go", sheetEl)?.addEventListener("click", () => { if (p.caption) copyText(p.caption, $('[data-copy="caption"]', sheetEl), { quiet: true }); });
    $("#mark", sheetEl).addEventListener("click", () => setPosted(p, statusOf(p) !== "posted"));

    if (p.v) loadVideo(p);
    else if (p.imgs && p.imgs.length) loadImages(p);
  }
  function syncSheetStatus() {
    const p = sheetPost, st = statusOf(p);
    $("#sh-pill", sheetEl).innerHTML = pillHTML(p, st);
    const w = $("#sh-when", sheetEl); if (w) { w.textContent = whenLine(p, st); w.className = "cdline " + (st === "overdue" && dueNow(p) ? "due" : st); }
    const on = st === "posted";
    $("#mark .sw", sheetEl).classList.toggle("on", on);
    $("#mark", sheetEl).setAttribute("aria-checked", String(on));
    $("#mark-sub", sheetEl).textContent = on ? (done[p.id] ? "Marked on this phone. Tap to undo." : p.status === "scheduled" ? "Went out from the scheduler" : "Already out") : "Tap once it's live";
  }
  function ring(f) {
    const c = 2 * Math.PI * 28;
    return `<div class="ring" role="progressbar" aria-label="Loading video" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(f * 100)}"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="4"/>
      <circle cx="32" cy="32" r="28" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/></svg><span class="num">${Math.round(f * 100)}%</span></div>`;
  }
  function loadVideo(p) {
    const me = sheetPost;
    const sheet = sheetEl;
    const load = $("#load", sheet), saveBtn = $("#save", sheet), saveL = $("#save-l", sheet);
    const igs = $("#igs", sheet), igsL = $("#igs-l", sheet);
    const prog = (f) => { if (sheetPost !== me) return; load.innerHTML = ring(f); saveL.textContent = `Loading… ${Math.round(f * 100)}%`; if (igsL) igsL.textContent = `Loading video… ${Math.round(f * 100)}%`; };
    const e = getBlob(p.v.f, "video/mp4", p.v.size, prog);
    e.pr.then((blob) => {
      e.listeners.delete(prog);
      if (sheetPost !== me) return;
      const url = URL.createObjectURL(blob); sheetUrls.push(url);
      const media = $("#media", sheet);
      const poster = p.poster && POSTERS[p.poster] ? POSTERS[p.poster] : "";
      media.innerHTML = `<video controls playsinline preload="metadata" ${poster ? `poster="${poster}"` : ""} src="${url}" aria-label="${esc(p.title)}"></video>`;
      const file = new File([blob], safeName(p.title) + ".mp4", { type: "video/mp4" });
      saveBtn.disabled = false; saveL.textContent = "Save video";
      saveBtn.onclick = () => shareFiles([file], saveBtn, "Save video");
      if (igs) { igs.disabled = false; igsL.textContent = "Post to Instagram"; igs.onclick = () => shareToInstagram(p, file, igs); }
    }).catch((err) => {
      e.listeners.delete(prog);
      if (sheetPost !== me) return;
      if (igs) { igs.disabled = true; igsL.textContent = "Video didn't load"; }
      const hint = $("#save-hint", sheet), was = hint.innerHTML;
      load.innerHTML = `<div class="lerr">${I.info}</div>`;
      hint.textContent = err && err.net ? "Couldn't download the video. Check the connection, then try again." : "This video didn't open. Try again.";
      saveBtn.disabled = false; saveL.textContent = "Try again";
      saveBtn.onclick = () => { saveBtn.onclick = null; saveBtn.disabled = true; hint.innerHTML = was; load.innerHTML = ring(0); saveL.textContent = "Loading…"; loadVideo(p); };
    });
  }
  function loadImages(p) {
    const me = sheetPost, sheet = sheetEl;
    const saveBtn = $("#save", sheet), saveL = $("#save-l", sheet);
    Promise.all(p.imgs.map((im) => getBlob(im.f, "image/jpeg", im.size).pr)).then((blobs) => {
      if (sheetPost !== me) return;
      const urls = blobs.map((b) => URL.createObjectURL(b)); sheetUrls.push(...urls);
      $$("#gal .g", sheet).forEach((g, i) => { g.innerHTML = `<img alt="Image ${i + 1}" src="${urls[i]}">`; });
      const files = blobs.map((b, i) => new File([b], `${safeName(p.title)} ${i + 1}.jpg`, { type: "image/jpeg" }));
      const label = files.length > 1 ? `Save ${files.length} images` : "Save image";
      saveBtn.disabled = false; saveL.textContent = label;
      saveBtn.onclick = () => shareFiles(files, saveBtn, label);
    }).catch(() => { if (sheetPost === me) { saveL.textContent = "Images didn't load"; toast("Couldn't load the images. Check the connection."); } });
  }
  async function shareFiles(files, btn, label) {
    let can = false;
    try { can = !!(navigator.canShare && navigator.share && navigator.canShare({ files })); } catch {}
    if (can) {
      try {
        await navigator.share({ files });
        btn.classList.add("did"); $("span", btn).textContent = "Saved · save again";
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    // fallback: plain download
    files.forEach((f) => {
      const u = URL.createObjectURL(f);
      const a = document.createElement("a");
      a.href = u; a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 60e3);
    });
    toast(files.length > 1 ? "Downloading the images…" : "Downloading the video…");
    $("span", btn).textContent = label;
  }
  // One tap: the caption goes to the clipboard, then the share sheet opens with the video (pick Instagram > Reels there).
  // Both calls start inside the tap itself; nothing is awaited before navigator.share, or Safari refuses to open the sheet.
  function shareToInstagram(p, file, btn) {
    if (p.caption && !btn._copied) copyText(p.caption, $('[data-copy="caption"]', sheetEl), { quiet: true });
    let can = false;
    try { can = !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch {}
    if (!can) { toast(p.caption ? "Caption copied. This browser can't send the video to Instagram: use Save video." : "This browser can't send the video to Instagram: use Save video."); return; }
    navigator.share({ files: [file] }).then(() => {
      btn._copied = false; btn.classList.add("did"); $("span", btn).textContent = "Sent · send again";
      toast(p.caption ? "In Instagram: pick Reels, then paste the caption." : "In Instagram: pick Reels.");
    }).catch((e) => {
      if (e && e.name === "AbortError") return;
      if (e && e.name === "NotAllowedError") { btn._copied = !!p.caption; toast(p.caption ? "Caption copied. Tap Post to Instagram once more to open the share sheet." : "Tap Post to Instagram once more."); return; }
      toast("The share sheet didn't open. Try again, or use Save video.");
    });
  }
  async function copyText(text, btn, { quiet } = {}) {
    if (!text) return false;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px"; document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      try { ok = document.execCommand("copy"); } catch {}
      ta.remove();
    }
    if (!ok) { if (!quiet) toast("Couldn't copy. Long-press the text instead."); return false; }
    if (btn) {
      btn.classList.add("ok"); $("span", btn).textContent = "Copied";
      btn.querySelector("svg").outerHTML = I.check;
      btn.closest(".field")?.classList.add("copied");
      if (navigator.vibrate) navigator.vibrate(10);
      clearTimeout(btn._t); btn._t = setTimeout(() => { btn.classList.remove("ok"); $("span", btn).textContent = "Copy"; btn.querySelector("svg").outerHTML = I.copy; }, 2200);
    }
    return true;
  }
  function dragToClose() {
    const sheet = sheetEl;
    const handles = [$(".grab", sheet), $(".sh-top", sheet)];
    let y0 = null, dy = 0;
    const start = (e) => { y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = "none"; };
    const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; };
    const end = () => { if (y0 == null) return; sheet.style.transition = ""; sheet.style.transform = ""; if (dy > 110) history.back(); y0 = null; };
    handles.forEach((h) => { h.addEventListener("touchstart", start, { passive: true }); h.addEventListener("touchmove", move, { passive: true }); h.addEventListener("touchend", end); });
    // pull down from the top of the scroll area too
    const sc = $("#sh-scroll", sheet);
    let sy = null;
    sc.addEventListener("touchstart", (e) => { sy = sc.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    sc.addEventListener("touchmove", (e) => { if (sy == null) return; dy = e.touches[0].clientY - sy; if (dy > 0 && sc.scrollTop <= 0) { sheet.style.transition = "none"; sheet.style.transform = `translateY(${dy * 0.8}px)`; } }, { passive: true });
    sc.addEventListener("touchend", () => { if (sy == null) return; sheet.style.transition = ""; sheet.style.transform = ""; if (dy > 140) history.back(); sy = null; });
  }
  function closeSheet(instant) {
    if (!sheetEl) return;
    const s = sheetEl, sc = scrimEl, urls = sheetUrls;
    const v = s.querySelector("video"); if (v) { try { v.pause(); } catch {} }
    sheetEl = scrimEl = null; sheetPost = null; sheetFmt = null; sheetUrls = [];
    document.body.classList.remove("sheet-open"); document.documentElement.classList.remove("sheet-open");
    if (stale) { stale = false; render(); }
    const gone = () => { s.remove(); sc.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); };
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch {} }
    if (instant) { gone(); return; }
    s.classList.remove("in"); sc.classList.remove("in");
    setTimeout(gone, 340);
  }
  window.addEventListener("popstate", (e) => {
    if (sheetEl) closeSheet(false);
    else if (e.state && e.state.sheet && DATA) openPost(e.state.sheet, { push: false });
    else if (e.state && e.state.fsheet && DATA) openFormat(e.state.fsheet, { push: false });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($(".menu")) { closeMenu(); return; }
    if (sheetEl) history.back();
  });

  // ---------------------------------------------------------------- formats: the weekly newsletter calendar
  // Owner, 23 Nov: "each week I will send people formats that are going viral ... I will weekly glance and pick and
  // send to my blog subscribers". Weeks run Monday to Sunday, PKT. Picks and "sent" marks live on this phone only,
  // like the posted marks: zc.fpick {id: Monday} and zc.fsent {id: {w: Monday, at}}; null undoes a pick/sent from the data.
  const FMT = () => (DATA && Array.isArray(DATA.formats) ? DATA.formats : []);
  let fpick = LS.get("zc.fpick", {});
  let fsent = LS.get("zc.fsent", {});
  let sheetFmt = null, keyStr = "";
  const saveF = () => { LS.set("zc.fpick", fpick); LS.set("zc.fsent", fsent); };
  const isKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
  const weekOf = (k) => addDays(k, -((keyToDate(k).getUTCDay() + 6) % 7));
  const thisWeek = () => weekOf(todayKey());
  const nextWeek = () => addDays(thisWeek(), 7);
  const dShort = (k) => F("UTC", { day: "numeric", month: "short" }).format(keyToDate(k));
  function weekLabel(w) {
    const e = addDays(w, 6);
    return w.slice(0, 7) === e.slice(0, 7) ? `${dShort(w)}–${Number(e.slice(8))}` : `${dShort(w)} – ${dShort(e)}`; // Nov 23–29, Nov 30 – Dec 6
  }
  function relWeek(w) {
    const tw = thisWeek();
    if (w === tw) return "This week";
    if (w === addDays(tw, 7)) return "Next week";
    if (w === addDays(tw, -7)) return "Last week";
    return "Week of " + dShort(w);
  }
  function pickOf(f) {
    const v = fpick[f.id];
    if (v !== undefined) return v;
    return f.status === "picked" && isKey(f.suggested_week) ? weekOf(f.suggested_week) : null;
  }
  function sentOf(f) {
    const v = fsent[f.id];
    if (v !== undefined) return v;
    if (f.status !== "sent") return null;
    const k = isKey(f.suggested_week) ? f.suggested_week : isKey(f.added) ? f.added : todayKey();
    return { w: weekOf(k), at: 0 };
  }

  // numbers: any of them may be missing
  const NF = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const nn = (x) => (typeof x === "number" && isFinite(x) && x >= 0 ? x : null);
  const compact = (x) => (nn(x) == null ? "" : NF.format(x));
  const xRatio = (r) => (r >= 10 ? Math.round(r).toLocaleString("en-US") : r.toFixed(1).replace(/\.0$/, "")) + "×";
  const exRatio = (x) => (nn(x.views) && nn(x.followers) ? x.views / x.followers : null);
  const exs = (f) => (Array.isArray(f.examples) ? f.examples.filter((x) => x && typeof x === "object") : []);
  const maxOf = (arr) => { const v = arr.filter((x) => x != null); return v.length ? Math.max(...v) : null; };
  const fViews = (f) => nn(f.headline && f.headline.views) ?? maxOf(exs(f).map((x) => nn(x.views)));
  const fRatio = (f) => nn(f.headline && f.headline.ratio) ?? maxOf(exs(f).map(exRatio));
  function fLabel(f) {
    if (f.headline && f.headline.label) return f.headline.label;
    const v = fViews(f), r = fRatio(f);
    return [v != null ? `${compact(v)} views` : "", r != null ? `${xRatio(r)} followers` : ""].filter(Boolean).join(" · ");
  }
  const byNumbers = (a, b) => (fRatio(b) ?? -1) - (fRatio(a) ?? -1) || (fViews(b) ?? -1) - (fViews(a) ?? -1) || String(a.name).localeCompare(String(b.name));
  const bestEx = (f) => exs(f).filter((x) => x.v).sort((a, b) => (nn(b.views) ?? -1) - (nn(a.views) ?? -1))[0] || null;
  const fPosterKey = (f) => { const b = bestEx(f); return (b && b.poster) || (exs(f).find((x) => x.poster) || {}).poster || ""; };
  const list_ = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string" && x.trim()) : []);

  // niche is free text like "faith, quotes, reminders": the filter works on each part
  const NICHE_NAME = new Map(); // lower-case tag -> how the data first spelled it
  const nicheTags = (f) => {
    const raw = String(f.niche || "").split(/[,/;]|\s&\s/).map((x) => x.trim()).filter(Boolean);
    raw.forEach((x) => { if (!NICHE_NAME.has(x.toLowerCase())) NICHE_NAME.set(x.toLowerCase(), x); });
    const t = raw.map((x) => x.toLowerCase());
    return t.length ? [...new Set(t)] : ["other"];
  };
  const nicheName = (n) => { const x = NICHE_NAME.get(n) || n; return x.charAt(0).toUpperCase() + x.slice(1); };
  function fmatches(f) {
    if (S.niche !== "all" && !nicheTags(f).includes(S.niche)) return false;
    if (S.q) {
      const hay = [f.name, f.one_liner, f.niche, list_(f.why).join(" "), list_(f.how).join(" "), list_(f.hooks).join(" "), exs(f).map((x) => `${x.account || ""} ${x.hook || ""}`).join(" ")].join(" ").toLowerCase();
      if (!S.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  function fchips() {
    const el = $("#chips");
    if (!(S.fview === "library" || S.q) || !FMT().length) { el.hidden = true; el.innerHTML = ""; return; }
    const counts = new Map();
    for (const f of FMT()) for (const n of nicheTags(f)) counts.set(n, (counts.get(n) || 0) + 1);
    if (S.niche !== "all" && !counts.has(S.niche)) S.niche = "all";
    const niches = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
    el.innerHTML = `<button class="chip ${S.niche === "all" ? "on" : ""}" data-n="all" aria-pressed="${S.niche === "all"}">All<span class="ct num">${FMT().length}</span></button>` +
      niches.map((n) => `<button class="chip ${S.niche === n ? "on" : ""}" data-n="${esc(n)}" aria-pressed="${S.niche === n}">${esc(nicheName(n))}<span class="ct num">${counts.get(n)}</span></button>`).join("");
  }

  // ---- cards
  function fpill(f) {
    const sn = sentOf(f), pk = pickOf(f);
    if (sn) return ["posted", `Sent${sn.w !== thisWeek() ? " · " + dShort(sn.w) : ""}`];
    if (pk === thisWeek()) return ["to_post", "This week"];
    if (pk === nextWeek()) return ["scheduled", "Next week"];
    if (pk && pk > nextWeek()) return ["scheduled", "Week of " + dShort(pk)];
    if (pk) return ["unscheduled", "Not sent"];
    return null;
  }
  const fpillHTML = (f) => { const p = fpill(f); return p ? `<span class="pill ${p[0]}">${esc(p[1])}</span>` : ""; };
  function fposter(f) {
    const k = fPosterKey(f), src = k && POSTERS[k];
    return `<div class="poster ${src ? "" : postersReady || !k ? "none" : "ph"}" ${src ? `style="background-image:url('${src}')"` : ""}></div>`;
  }
  function fcardHTML(f, act = "") {
    const sn = sentOf(f), pk = pickOf(f), label = fLabel(f), tw = thisWeek();
    let btn = "";
    if (act === "sent") btn = `<button class="tick ${sn ? "on" : ""}" data-fsent="${esc(f.id)}" aria-pressed="${!!sn}" aria-label="${sn ? "Sent. Tap to mark “" + esc(f.name) + "” not sent" : "Mark “" + esc(f.name) + "” as sent"}"><i>${I.check}</i></button>`;
    else if (act === "pick" && !sn) btn = `<button class="tick add ${pk && pk >= tw ? "on" : ""}" data-fpick="${esc(f.id)}" aria-pressed="${!!(pk && pk >= tw)}" aria-label="${pk && pk >= tw ? "Picked for " + relWeek(pk).toLowerCase() + ". Tap to remove “" + esc(f.name) + "”" : "Pick “" + esc(f.name) + "” for this week"}"><i>${pk && pk >= tw ? I.check : I.plus}</i></button>`;
    return `<div class="fcard ${sn ? "sent" : ""}">
      <button class="fc-main" data-fid="${esc(f.id)}">
        ${fposter(f)}
        <div class="mid"><div class="t">${esc(f.name || f.id)}</div>
          ${label ? `<div class="hl num">${esc(label)}</div>` : ""}
          ${f.one_liner ? `<div class="one">${esc(f.one_liner)}</div>` : ""}
          <div class="sub">${f.niche ? `<span>${esc(f.niche)}</span>` : ""}${act === "sent" && !sn ? "" : fpillHTML(f)}</div></div>
      </button>${btn}</div>`;
  }
  const flist = (fs, act) => `<div class="list">${fs.map((f) => fcardHTML(f, act)).join("")}</div>`;
  const noFormats = () => `<div class="empty"><b>No formats yet</b>Viral formats show up here as soon as they're added.<br><button class="btn sec" data-frefresh>Check for new formats</button></div>`;

  // ---- views
  function renderFormats(m) {
    if (S.q) return renderFSearch(m);
    if (!FMT().length) { m.innerHTML = noFormats(); return; }
    if (S.fview === "library") return renderLibrary(m);
    if (S.fview === "sent") return renderSent(m);
    return renderWeek(m);
  }
  function suggestRank(f) {
    const w = isKey(f.suggested_week) ? weekOf(f.suggested_week) : null, tw = thisWeek();
    if (!w) return [3, ""];
    if (w === tw) return [0, w];
    if (w > tw) return [1, w];
    return [2, "~" + (9e8 - Number(w.replace(/-/g, "")))]; // past suggestions: newest first
  }
  function suggested() {
    const tw = thisWeek();
    return FMT().filter((f) => !sentOf(f) && !(pickOf(f) && pickOf(f) >= tw)).sort((a, b) => {
      const ra = suggestRank(a), rb = suggestRank(b);
      return ra[0] - rb[0] || (ra[1] < rb[1] ? -1 : ra[1] > rb[1] ? 1 : 0) || byNumbers(a, b);
    });
  }
  function sugTag(f) {
    const w = isKey(f.suggested_week) ? weekOf(f.suggested_week) : null;
    return w && w >= thisWeek() ? relWeek(w) : "";
  }
  function renderWeek(m) {
    const tw = thisWeek(), nw = nextWeek();
    const picks = FMT().filter((f) => pickOf(f) === tw).sort(byNumbers);
    const sentN = picks.filter((f) => sentOf(f)).length;
    const later = FMT().filter((f) => pickOf(f) && pickOf(f) > tw && !sentOf(f)).sort((a, b) => (pickOf(a) < pickOf(b) ? -1 : pickOf(a) > pickOf(b) ? 1 : byNumbers(a, b)));
    const left = FMT().filter((f) => pickOf(f) && pickOf(f) < tw && !sentOf(f)).sort(byNumbers);
    const sug = suggested();
    let h = "";
    if (!picks.length) {
      h += `<section class="hero wk"><div class="body"><div class="kick">This week · ${esc(weekLabel(tw))}</div>
        <h3>Pick formats for this week</h3>
        <p class="times">Glance at the suggestions, tap <b>+</b> on the ones worth sending, then copy them into your newsletter.</p></div>
        <div class="acts">${sug.length ? `<button class="btn pri" data-fjump="sug">See suggestions</button>` : ""}<button class="btn sec" data-fview="library">Open library</button></div></section>`;
    } else {
      const all = sentN === picks.length;
      h += `<section class="hero wk ${all ? "" : "now"}"><div class="body"><div class="kick">This week · ${esc(weekLabel(tw))}</div>
        <div class="cd num">${sentN}<small>of ${picks.length} sent</small></div>
        <div class="prog" aria-hidden="true">${picks.map((f) => `<i class="${sentOf(f) ? "on" : ""}"></i>`).join("")}</div>
        <h3>${all ? "This week's newsletter is out." : `${picks.length} format${picks.length > 1 ? "s" : ""} picked. Copy ${picks.length > 1 ? "them" : "it"} into the newsletter.`}</h3></div>
        <div class="acts"><button class="btn pri" data-fcopyweek>${I.copy}<span>Copy ${picks.length > 1 ? "all " + picks.length : "for newsletter"}</span></button>
        ${all ? `<button class="btn sec" data-fjump="sug">Pick more</button>` : `<button class="btn sec" data-fsentall="${esc(picks.filter((f) => !sentOf(f)).map((f) => f.id).join(" "))}">${I.check}<span>Mark all sent</span></button>`}</div></section>`;
      h += sec("Picked for this week", `${picks.length}`) + flist(picks, "sent");
    }
    if (later.length) h += sec(later.every((f) => pickOf(f) === nw) ? "Next week" : "Coming up", later.every((f) => pickOf(f) === nw) ? esc(weekLabel(nw)) : `${later.length}`) + flist(later, "pick");
    if (left.length) h += `<button class="fold ${S.open["f-left"] ? "on" : ""}" data-fold="f-left" aria-expanded="${!!S.open["f-left"]}"><span>${left.length} picked earlier, never sent</span>${I.chev}</button>` + (S.open["f-left"] ? flist(left, "pick") : "");
    h += `<div id="sug"></div>` + sec("Suggested", sug.length ? `${sug.length}` : "");
    if (!sug.length) h += `<div class="empty sm">${FMT().every((f) => sentOf(f)) ? "You've sent every format in the library." : "Everything good is already picked."}</div>`;
    else {
      h += `<div class="list">${sug.slice(0, 6).map((f) => fcardHTML(f, "pick").replace('<div class="sub">', `<div class="sub">${sugTag(f) ? `<span class="sugw">${esc(sugTag(f))}</span>` : ""}`)).join("")}</div>`;
      if (sug.length > 6) h += `<button class="fold top" data-fview="library"><span>See all ${FMT().length} in the library</span>${I.right}</button>`;
    }
    m.innerHTML = h;
  }
  function renderLibrary(m) {
    const fs = FMT().filter(fmatches).sort(byNumbers);
    let h = S.niche !== "all" ? `<div class="fnote"><span>Showing <b>${esc(nicheName(S.niche))}</b> only</span><button class="link" data-fniche="all">Show all</button></div>` : "";
    h += `<div class="res-h">${fs.length} format${fs.length === 1 ? "" : "s"} · best numbers first</div>`;
    h += fs.length ? flist(fs, "pick") : `<div class="empty"><b>No formats in this niche</b><button class="btn sec" data-fniche="all">Show all formats</button></div>`;
    m.innerHTML = h;
  }
  function renderSent(m) {
    const groups = new Map();
    for (const f of FMT()) { const sn = sentOf(f); if (!sn) continue; if (!groups.has(sn.w)) groups.set(sn.w, []); groups.get(sn.w).push(f); }
    if (!groups.size) { m.innerHTML = `<div class="empty"><b>Nothing sent yet</b>Formats you mark sent show up here, week by week.<br><button class="btn sec" data-fview="week">Go to this week</button></div>`; return; }
    let h = "";
    for (const w of [...groups.keys()].sort().reverse()) {
      const l = groups.get(w).sort((a, b) => (sentOf(b).at || 0) - (sentOf(a).at || 0) || byNumbers(a, b));
      h += `<div class="day-h ${w === thisWeek() ? "today" : ""}"><b>${esc(relWeek(w))}</b><span>${esc(weekLabel(w))}</span><span class="n">${l.length} sent</span></div>` + flist(l);
    }
    m.innerHTML = h;
  }
  function renderFSearch(m) {
    const fs = FMT().filter(fmatches).sort(byNumbers);
    if (!fs.length) { m.innerHTML = `<div class="empty"><b>No formats match “${esc(S.q)}”</b>Try a niche or a word from a hook.<br><button class="btn sec" data-clearq>Clear search</button></div>`; return; }
    m.innerHTML = `<div class="res-h">${fs.length} result${fs.length > 1 ? "s" : ""}</div>` + flist(fs, "pick");
  }
  function onFormatsClick(e) {
    const el = e.target.closest("[data-fid],[data-fpick],[data-fsent],[data-fview],[data-fjump],[data-fcopyweek],[data-fsentall],[data-fniche],[data-fold],[data-clearq],[data-frefresh]");
    if (!el || !$("#main").contains(el)) return;
    const d = el.dataset, byId = (id) => FMT().find((f) => f.id === id);
    if (d.fsent) { const f = byId(d.fsent); if (f) { el.classList.toggle("on", !sentOf(f)); if (navigator.vibrate) navigator.vibrate(10); setTimeout(() => setSent(f, !sentOf(f)), 200); } return; }
    if (d.fpick) { const f = byId(d.fpick); if (f) { const on = pickOf(f) && pickOf(f) >= thisWeek(); if (navigator.vibrate) navigator.vibrate(10); setPick(f, on ? null : thisWeek()); } return; }
    if (d.fid) { openFormat(d.fid); return; }
    if (d.fview) { setView(d.fview); return; }
    if (d.fjump) { const t0 = $("#" + d.fjump); if (t0) window.scrollTo({ top: t0.getBoundingClientRect().top + scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 110), behavior: "smooth" }); return; }
    if (d.fcopyweek !== undefined) { copyWeek(el); return; }
    if (d.fsentall) { sentMany(d.fsentall.split(" ").map(byId).filter(Boolean)); return; }
    if (d.fniche) { S.niche = d.fniche; render(); $("#chips").scrollLeft = 0; return; }
    if (d.fold) { S.open[d.fold] = !S.open[d.fold]; render(); return; }
    if (d.clearq !== undefined) { toggleSearch(false); return; }
    if (d.frefresh !== undefined) refreshData(true);
  }

  // ---- picks and sent marks (with undo)
  function refreshAfterF() { render(); if (sheetEl && sheetFmt) syncFmtSheet(); }
  function snapF() { return JSON.stringify([fpick, fsent]); }
  function undoF(snap) { return () => { [fpick, fsent] = JSON.parse(snap); saveF(); refreshAfterF(); }; }
  function putPick(f, w) {
    const base = f.status === "picked" && isKey(f.suggested_week) ? weekOf(f.suggested_week) : null;
    if (w === base) delete fpick[f.id]; else fpick[f.id] = w;
  }
  function setPick(f, w) {
    const snap = snapF(), was = pickOf(f);
    putPick(f, w); saveF(); refreshAfterF();
    const msg = w ? (was ? `Moved to ${relWeek(w).toLowerCase()}` : `Picked for ${relWeek(w).toLowerCase()}`) : `Removed from ${was ? relWeek(was).toLowerCase() : "the week"}`;
    toast(msg, { label: "Undo", fn: undoF(snap) });
  }
  function putSent(f, on) {
    const base = f.status === "sent";
    if (on) { fsent[f.id] = { w: thisWeek(), at: Date.now() }; if (pickOf(f) !== thisWeek()) putPick(f, thisWeek()); }
    else if (base) fsent[f.id] = null; else delete fsent[f.id];
  }
  function setSent(f, on) {
    const snap = snapF();
    putSent(f, on); saveF(); refreshAfterF();
    toast(on ? "Marked sent this week" : "Marked not sent", { label: "Undo", fn: undoF(snap) });
  }
  function sentMany(fs) {
    if (!fs.length) return;
    const snap = snapF();
    fs.forEach((f) => putSent(f, true)); saveF(); refreshAfterF();
    toast(`Marked ${fs.length} sent`, { label: "Undo", fn: undoF(snap) });
  }

  // ---- newsletter text: name, one-liner, numbers, why, how, the original links. Never the file.
  function newsletterText(f, n) {
    const L = [];
    L.push((n ? `${n}. ` : "") + (f.name || f.id));
    if (f.one_liner) L.push(f.one_liner);
    const lab = fLabel(f); if (lab) L.push(lab);
    const why = list_(f.why), how = list_(f.how);
    if (why.length) L.push("", "Why it works:", ...why.map((x) => "- " + x));
    if (how.length) L.push("", "How to make it:", ...how.map((x, i) => `${i + 1}. ${x}`));
    if (f.make_with_ziztu && String(f.make_with_ziztu).trim()) L.push("", "Make it with Ziztu: " + String(f.make_with_ziztu).trim());
    const links = exs(f).filter((x) => x.url);
    if (links.length) L.push("", links.length > 1 ? "See the originals:" : "See the original:", ...links.map((x) => (x.account ? x.account + ": " : "") + x.url));
    return L.join("\n");
  }
  async function copyBtn(text, btn, label) {
    const ok = await copyText(text, null);
    if (!ok) return;
    btn.classList.add("did"); $("span", btn).textContent = "Copied";
    if (navigator.vibrate) navigator.vibrate(10);
    clearTimeout(btn._t); btn._t = setTimeout(() => { btn.classList.remove("did"); $("span", btn).textContent = label; }, 2200);
  }
  function copyWeek(btn) {
    const picks = FMT().filter((f) => pickOf(f) === thisWeek()).sort(byNumbers);
    if (!picks.length) return;
    copyBtn(picks.map((f, i) => newsletterText(f, picks.length > 1 ? i + 1 : 0)).join("\n\n\n"), btn, $("span", btn).textContent);
    toast(`Copied ${picks.length > 1 ? picks.length + " formats" : "the format"}. Paste into your newsletter.`);
  }

  // ---- format sheet (same feel as the post sheet)
  function openFormat(id, { push = true } = {}) {
    const f = FMT().find((x) => x.id === id);
    if (!f) { toast("That format isn't in the calendar anymore."); return; }
    closeSheet(true);
    sheetFmt = f;
    lastFocus = document.activeElement;
    const best = bestEx(f), all = exs(f);
    const v = fViews(f), r = fRatio(f), lab = fLabel(f);
    const why = list_(f.why), how = list_(f.how), hooks = list_(f.hooks);
    const nums = v != null || r != null
      ? `<div class="when fnums">${v != null ? `<div><small>Views</small><b class="num">${compact(v)}</b><span>best example</span></div>` : ""}${r != null ? `<div><small>vs followers</small><b class="num">${xRatio(r)}</b><span>views per follower</span></div>` : ""}</div>`
      : lab ? `<div class="cdline">${esc(lab)}</div>` : "";
    const stat = (x, l) => (nn(x) != null ? `<span><b class="num">${compact(x)}</b> ${l}</span>` : "");
    const exHTML = (x, i) => {
      const rr = exRatio(x);
      const stats = [stat(x.views, "views"), stat(x.likes, "likes"), stat(x.comments, "comments"), stat(x.shares, "shares"), stat(x.followers, "followers"), rr != null ? `<span><b class="num">${xRatio(rr)}</b> their followers</span>` : ""].filter(Boolean).join("");
      return `<li class="ex" data-ex="${i}">
        <div class="ex-top">${x.poster && POSTERS[x.poster] ? `<div class="poster" style="background-image:url('${POSTERS[x.poster]}')"></div>` : ""}<div class="ex-id"><b>${esc(x.account || "Unknown account")}</b>
          <span>${isKey(x.posted) ? "Posted " + esc(dShort(x.posted)) : "Post date unknown"}${isKey(x.read_on) ? " · numbers read " + esc(dShort(x.read_on)) : ""}</span></div></div>
        ${stats ? `<div class="ex-stats">${stats}</div>` : `<div class="ex-stats none">No numbers recorded</div>`}
        ${x.hook ? `<blockquote class="ex-hook">${esc(x.hook)}</blockquote>` : ""}
        <div class="ex-acts">${x.url ? `<a class="btn ghost" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${I.out}<span>Open original</span></a>` : ""}
          ${x.v && x !== best ? `<button class="btn sec" data-watch="${i}">${I.play}<span>Watch here</span></button>` : ""}</div></li>`;
    };
    const field = (k, label, val, name) => `<div class="field" data-f="${k}"><div class="fh"><small>${label}</small><span class="ok-mark" aria-hidden="true">${I.check}Copied</span>
        <button class="copy" data-copy="${k}" aria-label="Copy ${esc(name)}">${I.copy}<span>Copy</span></button></div><div class="val">${esc(val)}</div></div>`;
    const media = best
      ? `<div class="vid-row"><div class="media" id="media" style="aspect-ratio:${best.v.w || 9}/${best.v.h || 16}"><div class="pv" ${best.poster && POSTERS[best.poster] ? `style="background-image:url('${POSTERS[best.poster]}')"` : ""}></div><div class="load" id="load">${ring(0)}</div></div>
          <div class="vid-side" id="vid-side"></div></div>`
      : `<div class="nomedia">${I.film}<div><b>No preview here</b><span>${all.some((x) => x.url) ? "Open the original on Instagram to watch it." : "No example was saved for this format."}</span></div></div>`;

    sheetEl = document.createElement("section"); sheetEl.className = "sheet fsheet";
    sheetEl.setAttribute("role", "dialog"); sheetEl.setAttribute("aria-modal", "true"); sheetEl.setAttribute("aria-labelledby", "sh-title"); sheetEl.tabIndex = -1;
    scrimEl = document.createElement("div"); scrimEl.className = "scrim";
    sheetEl.innerHTML = `
      <div class="grab" aria-hidden="true"><i></i></div>
      <div class="sh-top"><div class="acct-l">${f.niche ? `<span class="acct">${esc(f.niche)}</span>` : `<span class="acct">Format</span>`}</div><span id="sh-pill">${fpillHTML(f)}</span>
        <button class="icon-btn" id="sh-x" aria-label="Close">${I.close}</button></div>
      <div class="scroll" id="sh-scroll">
        <h2 id="sh-title">${esc(f.name || f.id)}</h2>
        ${f.one_liner ? `<p class="lede">${esc(f.one_liner)}</p>` : ""}
        ${nums}
        <div class="fact">
          <button class="btn pri block" id="fcopy">${I.copy}<span>Copy for newsletter</span></button>
          <p class="hint c">Name, one-liner, why, how and the original link${all.filter((x) => x.url).length > 1 ? "s" : ""}. Never the video file.</p>
          <div id="fpk"></div>
          <button class="toggle-row" id="fmark" role="switch" aria-checked="false"><div class="tx"><b>Sent</b><span id="fmark-sub"></span></div><span class="sw"></span></button>
        </div>
        <div class="fsec"><h3>${best ? "Best example" : "Preview"}</h3>${media}</div>
        ${all.length ? `<div class="fsec"><h3>Examples <span class="num">${all.length}</span></h3><ul class="exl">${all.map(exHTML).join("")}</ul></div>` : ""}
        ${why.length ? `<div class="fsec"><h3>Why it works</h3><ul class="blist">${why.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
        ${how.length ? `<div class="fsec"><h3>How to make it</h3><ol class="olist">${how.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}
        ${hooks.length ? `<div class="fsec"><h3>Hook examples</h3>${hooks.map((x, i) => field("h" + i, `Hook ${hooks.length > 1 ? i + 1 : ""}`, x, "hook " + (i + 1))).join("")}</div>` : ""}
        ${f.make_with_ziztu && String(f.make_with_ziztu).trim() ? `<div class="fsec"><h3>Make it with Ziztu</h3><div class="callout zz"><div class="seal" aria-hidden="true"></div><span>${esc(f.make_with_ziztu)}</span></div></div>` : ""}
        ${f.share_note ? `<p class="quiet">${I.info}<span>${esc(f.share_note)}</span></p>` : ""}
        <div class="foot">${esc(f.id)}${isKey(f.added) ? " · added " + esc(dShort(f.added)) : ""}${f.source ? " · " + esc(f.source) : ""}</div>
      </div>`;
    document.body.append(scrimEl, sheetEl);
    document.body.classList.add("sheet-open"); document.documentElement.classList.add("sheet-open");
    syncFmtSheet();
    requestAnimationFrame(() => { scrimEl?.classList.add("in"); sheetEl?.classList.add("in"); });
    setTimeout(() => { scrimEl?.classList.add("in"); sheetEl?.classList.add("in"); }, 50);
    scrimEl.addEventListener("click", () => history.back());
    $("#sh-x", sheetEl).addEventListener("click", () => history.back());
    if (push) history.pushState({ fsheet: id }, "", location.href);
    dragToClose();
    sheetEl.focus({ preventScroll: true });

    $("#fcopy", sheetEl).addEventListener("click", (e) => copyBtn(newsletterText(f, 0), e.currentTarget, "Copy for newsletter"));
    $$("[data-copy]", sheetEl).forEach((b) => b.addEventListener("click", () => copyText(hooks[Number(b.dataset.copy.slice(1))], b)));
    $("#fmark", sheetEl).addEventListener("click", () => setSent(f, !sentOf(f)));
    $("#fpk", sheetEl).addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (b) setPick(f, b.dataset.w === "none" ? null : b.dataset.w === "this" ? thisWeek() : nextWeek()); });
    $$("[data-watch]", sheetEl).forEach((b) => b.addEventListener("click", () => { const x = all[Number(b.dataset.watch)]; showFmtVideo(f, x); $("#media", sheetEl)?.scrollIntoView({ behavior: "smooth", block: "center" }); }));
    if (best) showFmtVideo(f, best);
  }
  function syncFmtSheet() {
    const f = sheetFmt, sheet = sheetEl; if (!f || !sheet) return;
    $("#sh-pill", sheet).innerHTML = fpillHTML(f);
    const pk = pickOf(f), sn = sentOf(f), tw = thisWeek(), nw = nextWeek();
    const b = (w, l, cls) => `<button class="btn ${cls}" data-w="${w}">${l}</button>`;
    let h;
    if (sn) h = `<p class="pk-state">${I.check}<span>Sent ${sn.w === tw ? "this week" : "in the week of " + esc(dShort(sn.w))}.</span></p>`;
    else if (!pk) h = `<div class="pkrow">${b("this", `${I.plus}<span>Pick this week</span>`, "sec")}${b("next", "Pick next week", "ghost")}</div>`;
    else h = `<p class="pk-state on">${I.spark}<span>Picked for ${pk === tw ? "this week" : pk === nw ? "next week" : "the week of " + esc(dShort(pk))}</span></p>
      <div class="pkrow">${pk === tw ? b("next", "Move to next week", "sec") : b("this", "Move to this week", "sec")}${b("none", "Remove", "ghost")}</div>`;
    $("#fpk", sheet).innerHTML = h;
    $("#fmark .sw", sheet).classList.toggle("on", !!sn);
    $("#fmark", sheet).setAttribute("aria-checked", String(!!sn));
    $("#fmark-sub", sheet).textContent = sn ? (fsent[f.id] ? `Marked on this phone, ${sn.w === tw ? "this week" : "week of " + dShort(sn.w)}. Tap to undo.` : "Sent before") : "Tap once it's in the newsletter";
  }
  function showFmtVideo(f, x) {
    const me = sheetFmt, sheet = sheetEl;
    const mediaEl = $("#media", sheet); if (!mediaEl || !x || !x.v) return;
    const poster = x.poster && POSTERS[x.poster] ? POSTERS[x.poster] : "";
    mediaEl.style.aspectRatio = `${x.v.w || 9}/${x.v.h || 16}`;
    const old = mediaEl.querySelector("video"); if (old) { try { old.pause(); } catch {} }
    mediaEl.innerHTML = `<div class="pv" ${poster ? `style="background-image:url('${poster}')"` : ""}></div><div class="load" id="load">${ring(0)}</div>`;
    const rr = exRatio(x);
    $("#vid-side", sheet).innerHTML = `<b class="vs-acct">${esc(x.account || "Unknown account")}</b>
      ${nn(x.views) != null ? `<div class="vs-big num">${compact(x.views)}<small>views</small></div>` : ""}
      ${rr != null ? `<div class="vs-sub num">${xRatio(rr)} followers</div>` : ""}
      <p class="hint num">${Math.round(x.v.dur)} s preview${isKey(x.posted) ? " · posted " + esc(dShort(x.posted)) : ""}</p>
      ${x.url ? `<a class="btn ghost block sm" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${I.out}<span>Open original</span></a>` : ""}`;
    const load = $("#load", sheet);
    const prog = (p) => { if (sheetFmt === me && load.isConnected) load.innerHTML = ring(p); };
    const e = getBlob(x.v.f, "video/mp4", x.v.size, prog);
    e.pr.then((blob) => {
      e.listeners.delete(prog);
      if (sheetFmt !== me || !mediaEl.isConnected) return;
      const url = URL.createObjectURL(blob); sheetUrls.push(url);
      mediaEl.innerHTML = `<video controls playsinline preload="metadata" ${poster ? `poster="${poster}"` : ""} src="${url}" aria-label="${esc((x.account || "") + " example of " + (f.name || ""))}"></video>`;
    }).catch((err) => {
      e.listeners.delete(prog);
      if (sheetFmt !== me || !mediaEl.isConnected) return;
      load.innerHTML = `<button class="lerr" aria-label="Try loading the preview again">${I.reset}<span>${err && err.net ? "Offline? Tap to retry" : "Tap to retry"}</span></button>`;
      $(".lerr", load).addEventListener("click", () => showFmtVideo(f, x));
    });
  }

  // ---- deep links: #formats, #format=<id>, #posts (maybe next to #k=...). Applied once, then the URL is the clean one
  function hashParams() {
    const o = {};
    for (const part of location.hash.replace(/^#/, "").split("&")) {
      if (!part) continue;
      const i = part.indexOf("=");
      try { o[decodeURIComponent(i < 0 ? part : part.slice(0, i))] = i < 0 ? "" : decodeURIComponent(part.slice(i + 1)); } catch {}
    }
    delete o.k;
    return o;
  }
  function applyRoute(r) {
    const has = (k) => Object.prototype.hasOwnProperty.call(r, k);
    if (!has("format") && !has("formats") && !has("posts")) return false;
    history.replaceState(null, "", location.pathname + location.search);
    if (sheetEl) closeSheet(true);
    const want = has("posts") ? "posts" : "formats";
    if (want !== S.cal) { S.cal = want; LS.set("zc.cal", want); clearSearch(); }
    if (want === "formats" && FVIEWS.includes(r.formats)) { S.fview = r.formats; LS.set("zc.fview", r.formats); }
    render();
    if (has("format") && r.format) openFormat(r.format);
    return true;
  }

  // ---------------------------------------------------------------- install as an app (PWA)
  // Owner, 24 Nov: "make it pwa too". Android and desktop Chrome hand us a real install prompt (beforeinstallprompt);
  // iPhone Safari has no install API, so we show its two taps instead. Nothing shows once it runs as an app.
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  window.addEventListener("appinstalled", () => { installEvt = null; LS.set("zc.installed", true); toast("Installed. Open Posts from your home screen."); });
  const canInstall = () => !isStandalone() && !!(installEvt || isIOS);
  async function installApp() {
    if (installEvt) {
      const e = installEvt; installEvt = null;
      try { await e.prompt(); const c = await e.userChoice; if (c && c.outcome === "accepted") LS.set("zc.installed", true); } catch {}
      return;
    }
    iosInstallSteps();
  }
  function iosInstallSteps() {
    const d = document.createElement("dialog"); d.className = "inst"; d.setAttribute("aria-labelledby", "inst-h");
    d.innerHTML = `<div class="inst-b"><div class="inst-ic">${I.app}</div><h3 id="inst-h">Add Posts to your Home Screen</h3>
      <ol><li>Tap <b>Share</b> <span class="inst-share">${I.share}</span> in Safari's toolbar.</li>
      <li>Scroll down, tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>
      <p>It opens full screen like an app, with its own icon. Type your password once inside it.</p>
      <button class="btn pri block" type="button">Got it</button></div>`;
    d.querySelector("button").addEventListener("click", () => d.close());
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); }); // a tap outside the card closes it
    d.addEventListener("close", () => d.remove());
    document.body.appendChild(d); d.showModal();
  }
  // a one-time nudge in a phone browser, a few seconds after the calendar opens
  function installHint() {
    if (LS.get("zc.installHint", false) || LS.get("zc.installed", false)) return;
    setTimeout(() => {
      if (!canInstall() || sheetEl) return;
      LS.set("zc.installHint", true);
      toast("Use Posts as an app on this phone", { label: installEvt ? "Install" : "How", fn: installApp });
    }, 4000);
  }

  // ---------------------------------------------------------------- menu
  let menuOff = null;
  function closeMenu() { $(".menu")?.remove(); if (menuOff) { document.removeEventListener("click", menuOff, true); menuOff = null; } $("#b-more")?.setAttribute("aria-expanded", "false"); }
  function openMenu() {
    if ($(".menu")) { closeMenu(); return; }
    const m = document.createElement("div"); m.className = "menu"; m.setAttribute("role", "menu");
    const th = LS.get("zc.theme", "system");
    const local = Object.keys(done).length + Object.keys(undone).length;
    const flocal = new Set([...Object.keys(fpick), ...Object.keys(fsent)]).size;
    m.innerHTML = `<small>Appearance</small>
      ${["system", "light", "dark"].map((x) => `<button role="menuitemradio" aria-checked="${x === th}" data-th="${x}">${x === th ? I.check : `<span class="ic"></span>`}${x === "system" ? "Match iPhone" : x[0].toUpperCase() + x.slice(1)}</button>`).join("")}
      <hr><button role="menuitem" data-act="refresh">${I.reset}${S.cal === "formats" ? "Check for new formats" : "Check for new posts"}</button>
      ${S.cal === "formats"
        ? `<button role="menuitem" data-act="freset" ${flocal ? "" : "disabled"}>${I.close}Clear my picks and “sent” marks${flocal ? ` (${flocal})` : ""}</button>`
        : `<button role="menuitem" data-act="reset" ${local ? "" : "disabled"}>${I.close}Clear my “posted” marks${local ? ` (${local})` : ""}</button>`}
      ${canInstall() ? `<hr><button role="menuitem" data-act="install">${I.app}Install as an app</button>` : ""}
      <hr><button role="menuitem" data-act="lock">${I.key}Lock this phone</button>
      <button role="menuitem" data-act="link">${I.link}Copy private link (no password needed)</button>
      <small class="info">Updated ${esc(DATA.built)} · ${DATA.posts.length} posts · ${FMT().length} formats</small>`;
    document.body.appendChild(m);
    $("#b-more").setAttribute("aria-expanded", "true");
    menuOff = (e) => { if (!m.contains(e.target) && !e.target.closest("#b-more")) closeMenu(); };
    setTimeout(() => document.addEventListener("click", menuOff, true));
    m.querySelectorAll("[data-th]").forEach((b) => b.addEventListener("click", () => { LS.set("zc.theme", b.dataset.th); applyTheme(); closeMenu(); }));
    m.querySelector('[data-act="refresh"]').addEventListener("click", () => { closeMenu(); refreshData(true); });
    m.querySelector('[data-act="install"]')?.addEventListener("click", () => { closeMenu(); installApp(); });
    m.querySelector('[data-act="freset"]')?.addEventListener("click", () => {
      closeMenu();
      if (!confirm("Clear every pick and “sent” mark you set on this phone?")) return;
      const snap = JSON.stringify([fpick, fsent]);
      fpick = {}; fsent = {}; saveF(); render();
      toast("Cleared your picks and marks", { label: "Undo", fn: () => { [fpick, fsent] = JSON.parse(snap); saveF(); render(); } });
    });
    m.querySelector('[data-act="reset"]')?.addEventListener("click", () => {
      closeMenu();
      if (!confirm("Clear every “posted” mark you set on this phone?")) return;
      const snap = JSON.stringify([done, undone]);
      done = {}; undone = {}; savedMarks(); render();
      toast("Cleared your marks", { label: "Undo", fn: () => { [done, undone] = JSON.parse(snap); savedMarks(); render(); } });
    });
    m.querySelector('[data-act="lock"]').addEventListener("click", async () => {
      closeMenu();
      // with no password set up yet (no a/kw), locking means the private link is the only way back in
      const hasPw = await fetch("a/kw?t=" + Date.now(), { cache: "no-store" }).then((r) => r.ok, () => true);
      if (!confirm(hasPw ? "Lock this phone? You'll need your password to open it again." : "Lock this phone? No password is set up yet, so you'll need the private link to open it again.")) return;
      LS.del("zc.key"); memKey = null; KEY = null;
      history.replaceState(null, "", location.pathname + location.search); location.reload();
    });
    // the key link opens the calendar for anyone who has it, with no password: never shown on screen
    m.querySelector('[data-act="link"]').addEventListener("click", async () => {
      closeMenu();
      if (!keyStr || !confirm("This link opens the calendar without a password, for anyone who has it. Copy it, and keep it somewhere private?")) return;
      if (await copyText(location.origin + location.pathname + "#k=" + keyStr, null)) toast("Private link copied. Keep it private.");
    });
  }

  let toastT = null;
  function toast(msg, action) {
    const el = $("#toast");
    el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button>${esc(action.label)}</button>` : "");
    el.classList.toggle("act", !!action);
    const hide = () => el.classList.remove("in");
    if (action) el.querySelector("button").onclick = () => { hide(); clearTimeout(toastT); action.fn(); };
    el.classList.add("in");
    clearTimeout(toastT); toastT = setTimeout(hide, action ? 5000 : 2200);
  }

  // ---------------------------------------------------------------- boot, lock screen, errors
  function boot(msg, f) {
    let b = $(".boot", app);
    if (!b) { app.innerHTML = `<div class="boot"><div class="seal-lg"></div><p id="boot-msg"></p><div class="bar-p"><i id="boot-bar"></i></div></div>`; b = $(".boot", app); }
    $("#boot-msg").textContent = msg;
    $("#boot-bar").style.transform = `scaleX(${f == null ? 0 : f})`;
    b.classList.toggle("det", f != null);
  }
  // ---- password login. a/kw is the data key wrapped under the password: PBKDF2-HMAC-SHA256 (salt and
  // rounds from the file, 1,000,000 today) gives a key that AES-GCM-decrypts it (AAD "ziztu-posts/kw/v1").
  // SECURITY: a/kw sits on a PUBLIC Pages repo, so anyone can download it and guess offline. The only
  // barriers are the password's strength (tools/set_password.py takes 8+ characters, warns below 12)
  // and PBKDF2's cost. A wrong password and a damaged file look the same here, by design.
  const KW_AAD = new TextEncoder().encode("ziztu-posts/kw/v1");
  let memKey = null; // "Remember on this phone" off: the key lives in this page only, for this visit
  let retry = null;  // a key that hasn't loaded yet (the network failed): "Try again" uses it, with its Remember choice
  async function unwrapKey(kw, pw) {
    const salt = b64u.dec(kw.salt), iv = b64u.dec(kw.iv), ct = b64u.dec(kw.ct);
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
    const t0 = performance.now();
    const kek = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: kw.iter }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let raw;
    try { raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: KW_AAD }, kek, ct)); } catch { raw = null; }
    console.info(`zc: password checked in ${Math.round(performance.now() - t0)} ms`);
    return raw && raw.length === 32 ? raw : null;
  }
  function login(err) {
    const rem = LS.get("zc.remember", true) !== false;
    app.innerHTML = `<form class="lock login" id="lg" autocomplete="on" novalidate>
      <div class="seal-lg still"></div>
      <h1>Ziztu Posts</h1>
      <p>Type your password to open the calendar.</p>
      <div class="err" id="lg-err" role="alert" ${err ? "" : "hidden"}>${esc(err || "")}</div>
      <input type="text" name="username" autocomplete="username" value="ziztu" hidden aria-hidden="true" tabindex="-1">
      <div class="pw">
        <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required enterkeyhint="go"
          autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Password" aria-label="Password" aria-describedby="lg-err">
        <button type="button" class="pw-eye" id="pw-eye" aria-controls="pw" aria-pressed="false" aria-label="Show password">Show</button>
      </div>
      <label class="remember"><input type="checkbox" id="rem" ${rem ? "checked" : ""}><span>Remember on this phone</span></label>
      <button class="btn pri block" type="submit" id="lg-go"><span id="lg-l">Open calendar</span></button>
      <p class="foot">Forgot it? Set a new one on your Mac with set_password.</p>
    </form>`;
    const form = $("#lg"), pw = $("#pw"), go = $("#lg-go"), eye = $("#pw-eye");
    let busy = false;
    const fail = (msg) => {
      const e = $("#lg-err"); e.textContent = msg; e.hidden = false;
      pw.setAttribute("aria-invalid", "true");
      pw.focus(); pw.select();
    };
    const setBusy = (on) => {
      busy = on; go.disabled = on; pw.readOnly = on; form.setAttribute("aria-busy", String(on));
      go.classList.toggle("busy", on);
      $("#lg-l").textContent = on ? "Opening…" : "Open calendar";
    };
    eye.addEventListener("click", () => {
      const show = pw.type === "password";
      pw.type = show ? "text" : "password";
      eye.textContent = show ? "Hide" : "Show";
      eye.setAttribute("aria-pressed", String(show));
      eye.setAttribute("aria-label", show ? "Hide password" : "Show password");
      pw.focus();
    });
    pw.addEventListener("input", () => pw.removeAttribute("aria-invalid"));
    $("#rem").addEventListener("change", (e) => LS.set("zc.remember", e.target.checked));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return; // one check at a time: a double tap on Go doesn't start a second derivation
      const v = pw.value, remember = $("#rem").checked;
      if (!v) { fail("Type your password first."); return; }
      const link = v.trim().match(/[#&]k=([A-Za-z0-9_-]{40,})/); // a pasted private link still works here
      if (link) { start({ key: link[1], remember }); return; }
      setBusy(true);
      let kw;
      try {
        const res = await fetch("a/kw?t=" + Date.now(), { cache: "no-store" });
        if (res.status === 404) { setBusy(false); fail("No password is set up yet. Open the calendar once with your private link."); return; }
        if (!res.ok) throw new Error("HTTP " + res.status);
        kw = await res.json();
      } catch { setBusy(false); failNet(); return; }
      const ok = kw && kw.v === 1 && kw.kdf === "pbkdf2-sha256" && Number.isInteger(kw.iter) && kw.iter >= 100000 && kw.iter <= 10000000 && kw.salt && kw.iv && kw.ct;
      if (!ok) { setBusy(false); fail("The password file on the site isn't readable. Set the password again on your Mac."); return; }
      let raw;
      try { raw = await unwrapKey(kw, v); } catch { raw = null; }
      if (!raw) { setBusy(false); fail("Wrong password"); return; }
      start({ key: b64u.enc(raw), remember });
    });
    requestAnimationFrame(() => pw.focus());
  }
  function failNet() {
    const saved = !!(retry || memKey || LS.get("zc.key", null));
    app.innerHTML = `<div class="lock">
      <div class="seal-lg still"></div>
      <h1>Can't reach the calendar</h1>
      <p>${navigator.onLine ? "The connection dropped while loading." : "This phone is offline."} ${saved ? "Your key is still saved, so it opens as soon as you're back online." : "Try again when you're back online."}</p>
      <button class="btn pri block" id="again">Try again</button></div>`;
    $("#again").addEventListener("click", () => start(retry || {}));
  }

  function loadPosters(json) {
    const out = {};
    for (const [k, v] of Object.entries(json)) {
      const m = /^data:([^;,]+);base64,(.*)$/.exec(v);
      if (!m) { out[k] = v; continue; }
      try {
        const bin = atob(m[2]); const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        out[k] = URL.createObjectURL(new Blob([u8], { type: m[1] }));
      } catch { out[k] = v; }
    }
    return out;
  }
  function fetchPosters() {
    return fetchEnc("p").then((buf) => {
      const old = POSTERS;
      POSTERS = loadPosters(JSON.parse(new TextDecoder().decode(buf)));
      postersReady = true;
      Object.values(old).forEach((u) => { if (u.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(u), 5000); });
    }).catch(() => { postersReady = true; });
  }
  function prefetchHero() {
    // warm the next post's video so "Open post" plays and saves at once
    const open = DATA.posts.filter((p) => p.v && p.at && isOpen(statusOf(p)) && t(p) - now() < 6 * 3600e3 && (dueNow(p) || t(p) > now())).sort(byTime);
    const p = open.find((x) => dueNow(x)) || open[0];
    if (p) getBlob(p.v.f, "video/mp4", p.v.size);
  }
  let stale = false;
  async function refreshData(force) {
    if (!KEY || !DATA || (!force && now() - lastFetch < 5 * 60e3)) return;
    lastFetch = now();
    try {
      const d = JSON.parse(new TextDecoder().decode(await fetchEnc("d")));
      if (JSON.stringify(d) === JSON.stringify(DATA)) { if (force) toast(servedOffline ? "Offline: showing the saved copy" : "Already up to date"); return; }
      const needPosters = d.posts.some((p) => p.poster && !POSTERS[p.poster]) || (d.formats || []).some((f) => (f.examples || []).some((x) => x.poster && !POSTERS[x.poster]));
      DATA = d;
      if (needPosters) await fetchPosters();
      if (sheetEl) stale = true; else render();
      toast("Calendar updated");
    } catch { if (force) toast("Couldn't check for new posts. Try again in a moment."); }
  }

  // Where the key comes from, in order: the password just typed (login), a private #k= link (old links and
  // old home-screen apps keep working), this visit's memory (Remember off), the saved one (zc.key).
  async function start(opt = {}) {
    const route = hashParams();
    const m = location.hash.match(/[#&]k=([A-Za-z0-9_-]+)/);
    const stored = LS.get("zc.key", null);
    const src = opt.key ? "typed" : m ? "link" : memKey ? "memory" : stored ? "saved" : null;
    const k = opt.key || (m && m[1]) || memKey || stored;
    if (!k) { login(); return; }
    const save = src === "typed" ? opt.remember !== false : src !== "memory";
    retry = null;
    // the URL without the key: any route (#formats, #format=<id>, #posts) stays for applyRoute
    const rest = location.hash.replace(/^#/, "").split("&").filter((x) => x && !/^k=/.test(x)).join("&");
    const clean = location.pathname + location.search + (rest ? "#" + rest : "");
    boot("Unlocking your calendar…", 0);
    const slow = setTimeout(() => boot("Still loading. The connection is slow…"), 4000);
    try {
      KEY = await importKey(b64u.dec(k));
      const d = await fetchEnc("d", (f) => boot("Unlocking your calendar…", f));
      DATA = JSON.parse(new TextDecoder().decode(d));
      lastFetch = now();
    } catch (e) {
      clearTimeout(slow);
      console.error(e);
      if (e && e.net) { retry = src === "saved" ? null : { key: k, remember: save }; failNet(); return; }
      KEY = null;
      if (src === "link" && stored && stored !== k) { history.replaceState(null, "", clean); start(); return; }
      if (src === "saved" || stored === k) LS.del("zc.key");
      if (src === "memory") memKey = null;
      if (src === "link") history.replaceState(null, "", clean); // that key is wrong: don't let it win over a typed password
      login(src === "typed" ? "The password is right, but the calendar's key changed. Set the password again on your Mac."
        : src === "link" ? "This link's key doesn't open the calendar. Type your password, or use the newest private link."
        : null);
      return;
    }
    clearTimeout(slow);
    if (save) { LS.set("zc.key", k); memKey = null; } else memKey = k;
    history.replaceState(null, "", clean); // the key never stays in the address bar, or in a new Add to Home Screen
    boot("Unlocking your calendar…", 1);
    keyStr = k;
    shell();
    if (!applyRoute(route)) render();
    installHint();
    fetchPosters().then(() => { render(); setTimeout(prefetchHero, 800); });
    // keep countdowns and statuses current without rebuilding the page for nothing
    setInterval(() => { if (!sheetEl && DATA && statusSig() !== sig) render(); }, 30000);
    document.addEventListener("visibilitychange", () => { if (document.hidden || !DATA) return; if (!sheetEl && statusSig() !== sig) render(); refreshData(); });
  }
  // opening a (new) private link while the page is already open only changes the #fragment
  window.addEventListener("hashchange", () => {
    const m = location.hash.match(/[#&]k=([A-Za-z0-9_-]+)/);
    if (m && (!DATA || m[1] !== LS.get("zc.key", null))) { location.reload(); return; }
    if (DATA && $("#main")) applyRoute(hashParams()); // #formats, #format=<id>, #posts while the app is open
  });
  if ("serviceWorker" in navigator) {
    // a new build's worker takes over at once (skipWaiting + claim): offer a reload so the new screens show
    const hadWorker = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadWorker && DATA) toast("A new version is ready", { label: "Reload", fn: () => location.reload() }); });
    navigator.serviceWorker.register("sw.js?v=ca9b28dfa8").catch(() => {});
  }
  start();
})();
