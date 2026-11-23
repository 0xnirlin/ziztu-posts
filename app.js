/* Ziztu Posts: private content calendar. Everything under a/ is AES-GCM encrypted;
   the key comes from the private link (#k=...) and stays on this device. */
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
  const S = {
    view: VIEWS.includes(LS.get("zc.view")) ? LS.get("zc.view") : "today",
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
  const ACCT_NAME = { ig: "getziztu", rick: "@rickmortyai", fb: "Facebook" };
  const acctName = (a) => ACCT_NAME[a] || a;
  const primaryAcct = (p) => (p.accounts.includes("rick") ? "rick" : p.accounts.includes("ig") ? "ig" : p.accounts[0]);
  const acctHTML = (p) => p.accounts.map((a) => `<span class="acct"><i class="dot ${esc(a)}"></i>${esc(acctName(a))}</span>`).join("");
  const statusOn = () => S.status !== "all" && (S.view !== "today" || !!S.q);
  function matches(p, { status = true } = {}) {
    if (S.acct !== "all" && !p.accounts.includes(S.acct)) return false;
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
          <div class="brand"><div class="seal" aria-hidden="true"></div><h1 id="ttl">Posts</h1></div>
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
      <nav class="tabbar" aria-label="Views"><div class="in">
        <button class="tab" data-v="today">${I.today}<span>Today</span></button>
        <button class="tab" data-v="agenda">${I.list}<span>Agenda</span></button>
        <button class="tab" data-v="calendar">${I.cal}<span>Calendar</span></button>
      </div></nav>`;
    $$(".tab").forEach((b) => b.addEventListener("click", () => (b.dataset.v === S.view && !S.q ? reselect() : setView(b.dataset.v))));
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
  function setView(v) {
    S.view = v; LS.set("zc.view", v);
    if ($("#search").classList.contains("open")) { S.q = ""; $("#q").value = ""; $("#q").blur(); $("#search").classList.remove("open"); $("#b-search").classList.remove("on"); $("#b-search").setAttribute("aria-expanded", "false"); }
    window.scrollTo(0, 0); render();
  }
  function reselect() { // tapping the tab you're on: back to the start of that view
    if (S.view === "calendar") { S.selDay = todayKey(); S.calCursor = S.selDay.slice(0, 7); render(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function measureTop() { const tp = $("#top"); if (tp) document.documentElement.style.setProperty("--top-h", tp.offsetHeight + "px"); }

  function chips() {
    const all = DATA.posts;
    const inAcct = (p) => S.acct === "all" || p.accounts.includes(S.acct);
    const counts = {};
    for (const p of all) if (inAcct(p)) { const g = statusGroup(statusOf(p)); counts[g] = (counts[g] || 0) + 1; }
    const accts = [["all", "All"], ["ig", "getziztu"], ["rick", "@rickmortyai"], ["fb", "Facebook"]];
    const el = $("#chips");
    el.innerHTML =
      accts.map(([k, l]) => `<button class="chip ${S.acct === k ? "on" : ""}" data-a="${k}" aria-pressed="${S.acct === k}">${k !== "all" ? `<i class="dot ${k}"></i>` : ""}${l}</button>`).join("") +
      (S.view === "today" && !S.q ? "" : `<span class="chip-sep" aria-hidden="true"></span>` +
      STATUS_CHIPS.map(([k, l]) => `<button class="chip ${S.status === k ? "on" : ""}" data-s="${k}" aria-pressed="${S.status === k}">${l}<span class="ct num">${counts[k] || 0}</span></button>`).join(""));
    const on = $(".chip.on[data-s]", el);
    if (on) { const r = on.getBoundingClientRect(), c = el.getBoundingClientRect(); if (r.right > c.right - 8 || r.left < c.left) el.scrollLeft += r.left - c.left - 60; }
  }
  function onChip(e) {
    const b = e.target.closest(".chip"); if (!b) return;
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
    $$(".tab").forEach((b) => { const on = b.dataset.v === S.view; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    $("#ttl").textContent = S.q ? "Search" : { today: "Today", agenda: "Agenda", calendar: "Calendar" }[S.view];
    $("#offline").hidden = !servedOffline;
    chips(); measureTop();
    clearInterval(tick); tick = null;
    const m = $("#main");
    if (S.q) renderSearch(m);
    else if (S.view === "today") renderToday(m);
    else if (S.view === "agenda") renderAgenda(m);
    else renderCalendar(m);
    sig = statusSig();
  }
  const statusSig = () => todayKey() + DATA.posts.map((p) => statusOf(p)[0] + (statusOf(p) === "overdue" && dueNow(p) ? "!" : "")).join("");

  function onMainClick(e) {
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
    // what already went out before now folds away; anything still open stays in view
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
    const media = p.v
      ? `<div class="vid-row"><div class="media" id="media"><div class="pv" ${p.poster && POSTERS[p.poster] ? `style="background-image:url('${POSTERS[p.poster]}')"` : ""}></div><div class="load" id="load">${ring(0)}</div></div>
          <div class="vid-side"><button class="btn pri block" id="save" disabled>${I.down}<span id="save-l">Loading…</span></button>
          <p class="hint" id="save-hint">Opens the share sheet. Tap <b>Save Video</b> to put it in Photos.</p><p class="hint num">${Math.round(p.v.dur)} s · ${(p.v.size / 1e6).toFixed(1)} MB</p></div></div>`
      : p.imgs && p.imgs.length
        ? `<div class="gallery" id="gal">${p.imgs.map((im, i) => `<div class="g" data-i="${i}" style="background-image:url('${POSTERS[im.t] || ""}')"></div>`).join("")}</div>
          <button class="btn pri block" id="save" disabled>${I.down}<span id="save-l">Loading images…</span></button><p class="hint c">Opens the share sheet. Tap <b>Save ${p.imgs.length > 1 ? p.imgs.length + " Images" : "Image"}</b>.</p>`
        : `<div class="nomedia">${I.film}<div><b>Video not uploaded yet</b><span>It's still being prepared and shows up here soon.</span></div></div>`;
    const postBtn = live ? "" : isFB
      ? `<a class="btn pri block" id="go" href="${BUSINESS_SUITE}" target="_blank" rel="noopener">${I.out}<span>${p.caption ? "Copy caption & open Business Suite" : "Open Business Suite"}</span></a>`
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

        <div class="step">${step(1, p.imgs && !p.v ? "Save the images" : "Save the video")}${media}</div>
        <div class="step">${step(2, live ? "Caption" : isFB ? "Post on Facebook" : `Post from ${esc(acctName(from))}`, live ? "" : isFB ? "Upload it in Business Suite (Facebook only)." : `Pick the saved ${p.imgs && !p.v ? "images" : "video"}, then paste the caption.`)}
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
    const prog = (f) => { if (sheetPost !== me) return; load.innerHTML = ring(f); saveL.textContent = `Loading… ${Math.round(f * 100)}%`; };
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
    }).catch((err) => {
      e.listeners.delete(prog);
      if (sheetPost !== me) return;
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
    sheetEl = scrimEl = null; sheetPost = null; sheetUrls = [];
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
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($(".menu")) { closeMenu(); return; }
    if (sheetEl) history.back();
  });

  // ---------------------------------------------------------------- menu
  let menuOff = null;
  function closeMenu() { $(".menu")?.remove(); if (menuOff) { document.removeEventListener("click", menuOff, true); menuOff = null; } $("#b-more")?.setAttribute("aria-expanded", "false"); }
  function openMenu() {
    if ($(".menu")) { closeMenu(); return; }
    const m = document.createElement("div"); m.className = "menu"; m.setAttribute("role", "menu");
    const th = LS.get("zc.theme", "system");
    const local = Object.keys(done).length + Object.keys(undone).length;
    m.innerHTML = `<small>Appearance</small>
      ${["system", "light", "dark"].map((x) => `<button role="menuitemradio" aria-checked="${x === th}" data-th="${x}">${x === th ? I.check : `<span class="ic"></span>`}${x === "system" ? "Match iPhone" : x[0].toUpperCase() + x.slice(1)}</button>`).join("")}
      <hr><button role="menuitem" data-act="refresh">${I.reset}Check for new posts</button>
      <button role="menuitem" data-act="reset" ${local ? "" : "disabled"}>${I.close}Clear my “posted” marks${local ? ` (${local})` : ""}</button>
      <button role="menuitem" data-act="lock">${I.key}Forget the key on this phone</button>
      <small class="info">Updated ${esc(DATA.built)} · ${DATA.posts.length} posts</small>`;
    document.body.appendChild(m);
    $("#b-more").setAttribute("aria-expanded", "true");
    menuOff = (e) => { if (!m.contains(e.target) && !e.target.closest("#b-more")) closeMenu(); };
    setTimeout(() => document.addEventListener("click", menuOff, true));
    m.querySelectorAll("[data-th]").forEach((b) => b.addEventListener("click", () => { LS.set("zc.theme", b.dataset.th); applyTheme(); closeMenu(); }));
    m.querySelector('[data-act="refresh"]').addEventListener("click", () => { closeMenu(); refreshData(true); });
    m.querySelector('[data-act="reset"]').addEventListener("click", () => {
      closeMenu();
      if (!confirm("Clear every “posted” mark you set on this phone?")) return;
      const snap = JSON.stringify([done, undone]);
      done = {}; undone = {}; savedMarks(); render();
      toast("Cleared your marks", { label: "Undo", fn: () => { [done, undone] = JSON.parse(snap); savedMarks(); render(); } });
    });
    m.querySelector('[data-act="lock"]').addEventListener("click", () => { closeMenu(); if (confirm("Forget the key on this phone? You'll need the private link to open the calendar again.")) { LS.del("zc.key"); history.replaceState(null, "", location.pathname + location.search); location.reload(); } });
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
  function lock(err) {
    app.innerHTML = `<div class="lock">
      <div class="seal-lg still"></div>
      <h1>Ziztu Posts</h1>
      <p>This calendar is private. Open it with your private link, or paste the link here.</p>
      ${err ? `<div class="err" role="alert">${esc(err)}</div>` : ""}
      <input id="lk" type="url" inputmode="url" placeholder="Paste the private link" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Private link">
      <button class="btn pri block" id="lk-go">Open</button></div>`;
    const go = () => {
      const v = $("#lk").value.trim(); const m = v.match(/[#&]k=([A-Za-z0-9_-]+)/) || v.match(/^([A-Za-z0-9_-]{40,})$/);
      if (!m) { lock(v ? "That isn't the private link. It ends in #k= followed by a long code." : "Paste the private link first."); return; }
      history.replaceState(null, "", location.pathname + location.search + "#k=" + m[1]); start();
    };
    $("#lk-go").addEventListener("click", go);
    $("#lk").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }
  function failNet() {
    app.innerHTML = `<div class="lock">
      <div class="seal-lg still"></div>
      <h1>Can't reach the calendar</h1>
      <p>${navigator.onLine ? "The connection dropped while loading." : "This phone is offline."} Your key is still saved, so it opens as soon as you're back online.</p>
      <button class="btn pri block" id="again">Try again</button></div>`;
    $("#again").addEventListener("click", start);
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
      const needPosters = d.posts.some((p) => p.poster && !POSTERS[p.poster]);
      DATA = d;
      if (needPosters) await fetchPosters();
      if (sheetEl) stale = true; else render();
      toast("Calendar updated");
    } catch { if (force) toast("Couldn't check for new posts. Try again in a moment."); }
  }

  async function start() {
    const m = location.hash.match(/k=([A-Za-z0-9_-]+)/);
    const k = m ? m[1] : LS.get("zc.key", null);
    if (!k) { lock(); return; }
    if (!m) history.replaceState(history.state, "", location.pathname + location.search + "#k=" + k); // keep the key in the URL for Add to Home Screen
    boot("Unlocking your calendar…", 0);
    const slow = setTimeout(() => boot("Still loading. The connection is slow…"), 4000);
    try {
      KEY = await importKey(b64u.dec(k));
      const d = await fetchEnc("d", (f) => boot("Unlocking your calendar…", f));
      DATA = JSON.parse(new TextDecoder().decode(d));
      lastFetch = now();
      LS.set("zc.key", k);
    } catch (e) {
      clearTimeout(slow);
      console.error(e);
      if (e && e.net) { failNet(); return; }
      const stored = LS.get("zc.key", null);
      if (m && stored && stored !== k) { history.replaceState(null, "", location.pathname + location.search + "#k=" + stored); start(); return; }
      if (stored === k) LS.del("zc.key");
      lock("This link's key doesn't open the calendar. Use the newest private link.");
      return;
    }
    clearTimeout(slow);
    boot("Unlocking your calendar…", 1);
    shell(); render();
    fetchPosters().then(() => { render(); setTimeout(prefetchHero, 800); });
    // keep countdowns and statuses current without rebuilding the page for nothing
    setInterval(() => { if (!sheetEl && DATA && statusSig() !== sig) render(); }, 30000);
    document.addEventListener("visibilitychange", () => { if (document.hidden || !DATA) return; if (!sheetEl && statusSig() !== sig) render(); refreshData(); });
  }
  // opening a (new) private link while the page is already open only changes the #fragment
  window.addEventListener("hashchange", () => {
    const m = location.hash.match(/k=([A-Za-z0-9_-]+)/);
    if (m && (!DATA || m[1] !== LS.get("zc.key", null))) location.reload();
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=1a2ecab197").catch(() => {});
  start();
})();
