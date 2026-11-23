/* Ziztu Posts: private content calendar. Everything under a/ is AES-GCM encrypted;
   the key comes from the private link (#k=...) and stays on this device. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const app = $("#app");
  const TZ_PK = "Asia/Karachi", TZ_ET = "America/New_York";

  // ---------------------------------------------------------------- icons
  const I = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  };

  // ---------------------------------------------------------------- theme
  function applyTheme() {
    const t = LS.get("zc.theme", "system");
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  applyTheme();

  // ---------------------------------------------------------------- crypto
  const b64u = {
    dec(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); },
  };
  let KEY = null;
  async function importKey(raw) {
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  }
  async function fetchEnc(name, onProgress, expected) {
    const res = await fetch("a/" + name + (name === "d" || name === "p" ? "?t=" + Date.now() : ""), { cache: name === "d" || name === "p" ? "no-store" : "default" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    let buf;
    if (onProgress && res.body && res.body.getReader) {
      const total = Number(res.headers.get("content-length")) || expected || 0;
      const reader = res.body.getReader();
      const chunks = []; let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        if (total) onProgress(Math.min(0.99, got / total));
      }
      buf = new Uint8Array(got); let o = 0;
      for (const c of chunks) { buf.set(c, o); o += c.length; }
    } else {
      buf = new Uint8Array(await res.arrayBuffer());
    }
    const iv = buf.slice(0, 12);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, KEY, buf.slice(12));
    return plain;
  }

  // ---------------------------------------------------------------- state
  let DATA = null, POSTERS = {};
  const S = {
    view: LS.get("zc.view", "today"),
    acct: LS.get("zc.acct", "all"),
    status: LS.get("zc.status", "all"),
    q: "",
    calMode: LS.get("zc.calMode", "month"),
    calCursor: null, selDay: null,
  };
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
  const STATUS_LABEL = { to_post: "To post", overdue: "Overdue", scheduled: "Scheduled", posted: "Posted", unscheduled: "Ready" };
  const statusGroup = (st) => (st === "overdue" ? "to_post" : st);
  function statusLabel(p, st) {
    if (st === "posted" && p.status === "scheduled" && !done[p.id]) return "Went out";
    if (st === "unscheduled" && (p.notes || []).some((n) => /hold/i.test(n))) return "On hold";
    return STATUS_LABEL[st];
  }

  // ---------------------------------------------------------------- time formatting
  const fmt = {};
  function F(tz, opts) { const k = tz + JSON.stringify(opts); return (fmt[k] ||= new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts })); }
  const timeIn = (ms, tz) => F(tz, { hour: "numeric", minute: "2-digit" }).format(ms).replace(":00", "").replace(" ", " ");
  const timeInFull = (ms, tz) => F(tz, { hour: "numeric", minute: "2-digit" }).format(ms);
  const dayKey = (ms) => { const p = F(TZ_PK, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms); const g = (x) => p.find((y) => y.type === x).value; return `${g("year")}-${g("month")}-${g("day")}`; };
  const dayLabel = (ms, tz = TZ_PK) => F(tz, { weekday: "short", day: "numeric", month: "short" }).format(ms);
  const keyToDate = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 7)); }; // 12:00 PKT
  const todayKey = () => dayKey(now());
  function relDay(k) {
    const diff = Math.round((keyToDate(k) - keyToDate(todayKey())) / 864e5);
    if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday";
    return F(TZ_PK, { weekday: "long" }).format(keyToDate(k));
  }
  function bothTimes(p, long) {
    if (!p.at) return "";
    const ms = t(p);
    if (p.time_unknown) return `${dayLabel(ms)} · time not recorded`;
    const pk = long ? timeInFull(ms, TZ_PK) : timeIn(ms, TZ_PK);
    const et = long ? timeInFull(ms, TZ_ET) : timeIn(ms, TZ_ET);
    return `<span class="tm"><b>${pk}</b> PKT · ${et} ET</span>`;
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
  function inText(ms) {
    const mins = Math.round((ms - now()) / 60000);
    if (mins < 0) { const a = -mins; return a < 60 ? `${a} min ago` : a < 1440 ? `${Math.round(a / 60)} h ago` : `${Math.round(a / 1440)} d ago`; }
    if (mins < 60) return `in ${mins} min`;
    if (mins < 1440) { const h = Math.floor(mins / 60), m = mins % 60; return `in ${h} h${m ? " " + m + " min" : ""}`; }
    return `in ${Math.round(mins / 1440)} days`;
  }

  // ---------------------------------------------------------------- filtering
  const ACCTS = () => DATA.accounts;
  function acctHTML(p) {
    return p.accounts.map((a) => `<span class="acct"><i class="dot ${a}"></i>${esc(ACCTS()[a]?.short === "Rick" ? "@rickmortyai" : a === "ig" ? "getziztu" : "Facebook")}</span>`).join("");
  }
  function matches(p) {
    if (S.acct !== "all" && !p.accounts.includes(S.acct)) return false;
    if (S.status !== "all" && statusGroup(statusOf(p)) !== S.status) return false;
    if (S.q) {
      const hay = (p.title + " " + p.series + " " + p.keyword + " " + p.caption + " " + (p.notes || []).join(" ")).toLowerCase();
      if (!S.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  const visible = () => DATA.posts.filter(matches);
  const byTime = (a, b) => (t(a) ?? 9e15) - (t(b) ?? 9e15) || (a.order || 0) - (b.order || 0);

  // ---------------------------------------------------------------- render: shell
  function shell() {
    app.innerHTML = `
      <header class="top" id="top">
        <div class="bar">
          <div class="brand"><div class="seal" aria-hidden="true"></div><h1 id="ttl">Posts</h1></div>
          <button class="icon-btn" id="b-search" aria-label="Search">${I.search}</button>
          <button class="icon-btn" id="b-more" aria-label="More">${I.more}</button>
        </div>
        <div class="search" id="search"><input id="q" type="search" placeholder="Search titles, captions, keywords" autocomplete="off" enterkeyhint="search"></div>
        <div class="chips" id="chips"></div>
      </header>
      <main id="main"></main>
      <nav class="tabbar"><div class="in">
        <button class="tab" data-v="today">${I.today}<span>Today</span></button>
        <button class="tab" data-v="agenda">${I.list}<span>Agenda</span></button>
        <button class="tab" data-v="calendar">${I.cal}<span>Calendar</span></button>
      </div></nav>`;
    app.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => { setView(b.dataset.v); }));
    $("#b-search").addEventListener("click", toggleSearch);
    $("#b-more").addEventListener("click", openMenu);
    $("#q").addEventListener("input", (e) => { S.q = e.target.value.trim(); render(); });
    window.addEventListener("scroll", () => $("#top")?.classList.toggle("scrolled", scrollY > 4), { passive: true });
  }
  function toggleSearch() {
    const s = $("#search"); const open = !s.classList.contains("open");
    s.classList.toggle("open", open); $("#b-search").classList.toggle("on", open);
    if (open) $("#q").focus(); else { $("#q").value = ""; S.q = ""; render(); }
    measureTop();
  }
  function setView(v) { S.view = v; LS.set("zc.view", v); scrollTo(0, 0); render(); }
  function measureTop() { requestAnimationFrame(() => document.documentElement.style.setProperty("--top-h", $("#top").offsetHeight + "px")); }

  function chips() {
    const all = DATA.posts;
    const cnt = (fn) => all.filter(fn).length;
    const accts = [["all", "All"], ["ig", "getziztu"], ["rick", "@rickmortyai"], ["fb", "Facebook"]];
    const sts = [["to_post", "To post"], ["scheduled", "Scheduled"], ["posted", "Posted"], ["unscheduled", "Unscheduled"]];
    const inAcct = (p) => S.acct === "all" || p.accounts.includes(S.acct);
    $("#chips").innerHTML =
      accts.map(([k, l]) => `<button class="chip ${S.acct === k ? "on" : ""}" data-a="${k}">${k !== "all" ? `<i class="dot ${k}"></i>` : ""}${l}</button>`).join("") +
      `<span class="chip-sep"></span>` +
      sts.map(([k, l]) => `<button class="chip ${S.status === k ? "on" : ""}" data-s="${k}">${l}<span class="ct num">${cnt((p) => inAcct(p) && statusGroup(statusOf(p)) === k)}</span></button>`).join("");
    $("#chips").querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => { S.acct = b.dataset.a; LS.set("zc.acct", S.acct); render(); }));
    $("#chips").querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => { S.status = S.status === b.dataset.s ? "all" : b.dataset.s; LS.set("zc.status", S.status); render(); }));
  }

  function posterStyle(p) {
    const src = p.poster && POSTERS[p.poster];
    return src ? `style="background-image:url('${src}')"` : "";
  }
  function posterCls(p) { return (p.poster && POSTERS[p.poster] ? "" : "ph ") + (p.imgs && !p.v ? "sq" : ""); }

  function rowHTML(p) {
    const st = statusOf(p);
    return `<button class="row ${st === "posted" ? "done" : ""}" data-id="${esc(p.id)}">
      <div class="poster ${posterCls(p)}" ${posterStyle(p)}></div>
      <div class="mid"><div class="t">${esc(p.title)}</div>
        <div class="sub">${acctHTML(p)}${p.at ? bothTimes(p) : `<span>${esc(p.series)}</span>`}</div></div>
      <div class="right"><span class="pill ${st}">${statusLabel(p, st)}</span></div>
    </button>`;
  }
  function bindRows(root) { root.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => openPost(el.dataset.id))); }

  // ---------------------------------------------------------------- views
  let tick = null;
  function render() {
    if (!DATA) return;
    app.querySelectorAll(".tab").forEach((b) => b.classList.toggle("on", b.dataset.v === S.view));
    $("#ttl").textContent = { today: "Today", agenda: "Agenda", calendar: "Calendar" }[S.view];
    chips(); measureTop();
    clearInterval(tick); tick = null;
    const m = $("#main");
    if (S.view === "today") renderToday(m);
    else if (S.view === "agenda") renderAgenda(m);
    else renderCalendar(m);
    bindRows(m);
  }

  function renderToday(m) {
    const posts = visible();
    const mine = (p) => ["to_post", "overdue"].includes(statusOf(p));
    const upcoming = posts.filter((p) => p.at && t(p) >= now() && statusOf(p) !== "posted").sort(byTime);
    const nextMine = upcoming.find(mine);
    const overdue = posts.filter((p) => statusOf(p) === "overdue").sort(byTime);
    const tk = todayKey();
    const todayList = posts.filter((p) => p.at && dayKey(t(p)) === tk).sort(byTime);
    const tomorrowKey = dayKey(now() + 864e5);
    const tomorrowList = posts.filter((p) => p.at && dayKey(t(p)) === tomorrowKey).sort(byTime);
    const ready = posts.filter((p) => statusOf(p) === "unscheduled");
    const toPostCount = posts.filter((p) => mine(p)).length;
    const doneCount = posts.filter((p) => statusOf(p) === "posted").length;

    let h = "";
    if (nextMine) {
      const ms = t(nextMine);
      h += `<div class="hero" data-id="${esc(nextMine.id)}" role="button">
        <div class="poster ${posterCls(nextMine)}" ${posterStyle(nextMine)}></div>
        <div class="body">
          <div class="kick">Up next · ${esc(nextMine.accounts.includes("rick") ? "@rickmortyai" : nextMine.accounts.includes("fb") && nextMine.accounts.length === 1 ? "Facebook" : "getziztu")}</div>
          <div class="cd num" id="cd"></div>
          <h3>${esc(nextMine.title)}</h3>
          <div class="times">${timeInFull(ms, TZ_PK)} PKT <span>· ${timeInFull(ms, TZ_ET)} ET · ${esc(relDay(dayKey(ms)))}</span></div>
          <div class="acts"><button class="btn pri" data-open="${esc(nextMine.id)}">Open post</button></div>
        </div></div>`;
    } else {
      h += `<div class="hero" style="grid-template-columns:1fr"><div class="body"><div class="kick">Up next</div><h3>Nothing left to post${S.acct !== "all" || S.status !== "all" || S.q ? " for this filter" : ""}.</h3><div class="times"><span>New reels show up here as soon as they're added.</span></div></div></div>`;
    }
    h += `<div class="stats">
      <button class="stat" data-go="to_post"><b class="num">${toPostCount}</b><span>to post</span></button>
      <button class="stat" data-go="unscheduled"><b class="num">${ready.length}</b><span>ready, no time</span></button>
      <button class="stat" data-go="posted"><b class="num">${doneCount}</b><span>posted</span></button></div>`;

    if (overdue.length) h += sec("Overdue", `${overdue.length} · post or mark done`) + `<div class="list">${overdue.map(rowHTML).join("")}</div>`;
    h += sec("Today", dayLabel(keyToDate(tk))) + (todayList.length ? `<div class="list">${todayList.map(rowHTML).join("")}</div>` : `<div class="empty"><b>Nothing today</b>Enjoy it.</div>`);
    if (tomorrowList.length) h += sec("Tomorrow", dayLabel(keyToDate(tomorrowKey))) + `<div class="list">${tomorrowList.map(rowHTML).join("")}</div>`;
    if (ready.length) h += sec("Ready, not scheduled", `${ready.length}`) + `<div class="list">${ready.sort(byTime).map(rowHTML).join("")}</div>`;
    m.innerHTML = h;
    m.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { S.status = b.dataset.go; LS.set("zc.status", S.status); setView("agenda"); }));
    m.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); openPost(b.dataset.open); }));
    if (nextMine) {
      const upd = () => {
        const el = $("#cd"); if (!el) return;
        const ms = t(nextMine);
        if (ms <= now()) { render(); return; }
        const c = countdown(ms); el.innerHTML = `${c.big}<small>${c.small}</small>`;
      };
      upd(); tick = setInterval(upd, 1000);
    }
  }
  const sec = (title, meta = "") => `<div class="h-sec"><h2>${esc(title)}</h2><span class="meta">${esc(meta)}</span></div>`;

  function renderAgenda(m) {
    const posts = visible().sort(byTime);
    if (!posts.length) { m.innerHTML = `<div class="empty"><b>No posts match</b>Try another filter.</div>`; return; }
    const groups = new Map();
    for (const p of posts) { const k = p.at ? dayKey(t(p)) : "~"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    const tk = todayKey();
    let h = "";
    for (const [k, list] of groups) {
      if (k === "~") h += `<div class="day-h" id="day-none"><b>No time yet</b><span>ready when you are</span><span class="n">${list.length}</span></div>`;
      else h += `<div class="day-h ${k === tk ? "today" : ""}" id="day-${k}"><b>${esc(relDay(k))}</b><span>${esc(dayLabel(keyToDate(k)))}</span><span class="n">${list.length}</span></div>`;
      h += `<div class="list">${list.map(rowHTML).join("")}</div>`;
    }
    m.innerHTML = h;
    // jump to today (or the next day with posts) the first time
    const target = [...groups.keys()].filter((k) => k !== "~").find((k) => k >= tk);
    if (target && !S._agendaJumped) {
      S._agendaJumped = true;
      requestAnimationFrame(() => { const el = $("#day-" + target); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - $("#top").offsetHeight + 2); });
    }
  }

  function renderCalendar(m) {
    const posts = visible();
    const byDay = new Map();
    for (const p of posts) if (p.at) { const k = dayKey(t(p)); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(p); }
    const tk = todayKey();
    S.selDay ||= tk;
    if (!S.calCursor) S.calCursor = tk.slice(0, 7);
    let h = `<div class="seg wide"><button data-m="month" class="${S.calMode === "month" ? "on" : ""}">Month</button><button data-m="week" class="${S.calMode === "week" ? "on" : ""}">Week</button></div>
      <div class="cal-head">
      <h2 id="c-title"></h2>
      <button class="cal-nav" id="c-today" aria-label="Go to today" style="width:auto;padding:0 10px;font-size:14px;font-weight:600;color:var(--accent-ink)">Today</button>
      <button class="cal-nav" id="c-prev" aria-label="Previous">${I.left}</button>
      <button class="cal-nav" id="c-next" aria-label="Next">${I.right}</button></div>`;
    if (S.calMode === "month") {
      const [y, mo] = S.calCursor.split("-").map(Number);
      const first = new Date(Date.UTC(y, mo - 1, 1));
      const startDow = (first.getUTCDay() + 6) % 7; // Monday first
      const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      h += `<div class="month">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<div class="dow">${d}</div>`).join("")}`;
      const cells = Math.ceil((startDow + days) / 7) * 7;
      for (let i = 0; i < cells; i++) {
        const d = new Date(Date.UTC(y, mo - 1, 1 - startDow + i));
        const k = d.toISOString().slice(0, 10);
        const list = (byDay.get(k) || []).sort(byTime);
        const dots = list.slice(0, 3).map((p) => `<i class="dot ${p.accounts.length > 1 ? "ig" : p.accounts[0]}"></i>`).join("");
        h += `<button class="cell ${d.getUTCMonth() !== mo - 1 ? "out" : ""} ${k === tk ? "today" : ""} ${k === S.selDay ? "sel" : ""}" data-k="${k}" aria-label="${k}: ${list.length} posts">
          <span class="d num">${d.getUTCDate()}</span><span class="dots">${dots}${list.length > 3 ? `<span class="more">+${list.length - 3}</span>` : ""}</span></button>`;
      }
      h += `</div>`;
      const sel = (byDay.get(S.selDay) || []).sort(byTime);
      h += sec(relDay(S.selDay) + " · " + dayLabel(keyToDate(S.selDay)), sel.length ? `${sel.length} post${sel.length > 1 ? "s" : ""}` : "");
      h += sel.length ? `<div class="list">${sel.map(rowHTML).join("")}</div>` : `<div class="empty">Nothing on this day.</div>`;
      m.innerHTML = h;
      $("#c-title").innerHTML = `${F("UTC", { month: "long" }).format(first)} <span>${y}</span>`;
      m.querySelectorAll(".cell").forEach((c) => c.addEventListener("click", () => { S.selDay = c.dataset.k; if (c.classList.contains("out")) S.calCursor = c.dataset.k.slice(0, 7); render(); }));
      $("#c-prev").onclick = () => { S.calCursor = shiftMonth(S.calCursor, -1); render(); };
      $("#c-next").onclick = () => { S.calCursor = shiftMonth(S.calCursor, 1); render(); };
    } else {
      const sd = keyToDate(S.selDay);
      const dow = (new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate())).getUTCDay() + 6) % 7;
      const mon = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate() - dow));
      h += `<div class="week">`;
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon.getTime() + i * 864e5); const k = d.toISOString().slice(0, 10);
        const list = (byDay.get(k) || []).sort(byTime);
        h += `<div class="wday ${k === tk ? "today" : ""}"><div class="lab"><small>${F("UTC", { weekday: "short" }).format(d)}</small><b class="num">${d.getUTCDate()}</b></div>`;
        h += list.length ? `<div class="strip">${list.map(tileHTML).join("")}</div>` : `<div class="none">No posts</div>`;
        h += `</div>`;
      }
      h += `</div>`;
      m.innerHTML = h;
      const end = new Date(mon.getTime() + 6 * 864e5);
      $("#c-title").textContent = `${F("UTC", { day: "numeric", month: "short" }).format(mon)} – ${F("UTC", { day: "numeric", month: "short" }).format(end)}`;
      $("#c-prev").onclick = () => { S.selDay = new Date(keyToDate(S.selDay).getTime() - 7 * 864e5).toISOString().slice(0, 10); render(); };
      $("#c-next").onclick = () => { S.selDay = new Date(keyToDate(S.selDay).getTime() + 7 * 864e5).toISOString().slice(0, 10); render(); };
    }
    $("#c-today").onclick = () => { S.selDay = tk; S.calCursor = tk.slice(0, 7); render(); };
    m.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => { S.calMode = b.dataset.m; LS.set("zc.calMode", S.calMode); S.calCursor = S.selDay.slice(0, 7); render(); }));
  }
  function shiftMonth(c, n) { const [y, m] = c.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); }
  function tileHTML(p) {
    const st = statusOf(p);
    return `<button class="tile" data-id="${esc(p.id)}"><div class="poster ${posterCls(p)}" ${posterStyle(p)}>
      <span class="badge">${p.accounts.map((a) => `<i class="dot ${a}" style="box-shadow:0 0 0 2px rgba(0,0,0,.35)${a === "fb" ? ",inset 0 0 0 2px #fff" : ""}"></i>`).join(" ")}</span>
      ${st === "posted" ? `<span class="chk">${I.check}</span>` : ""}</div>
      <div class="tt">${esc(p.title)}</div><div class="tm num">${p.time_unknown ? "—" : timeIn(t(p), TZ_PK)}</div></button>`;
  }

  // ---------------------------------------------------------------- post sheet
  const blobCache = new Map(); // asset name -> Promise<Blob>
  function getBlob(name, type, onProgress, size) {
    if (!blobCache.has(name)) {
      const pr = fetchEnc(name, onProgress, size ? size + 28 : 0).then((buf) => new Blob([buf], { type }));
      pr.catch(() => blobCache.delete(name));
      blobCache.set(name, pr);
    }
    return blobCache.get(name);
  }
  const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "reel";

  let sheetEl = null, scrimEl = null, sheetPost = null;
  function openPost(id, { push = true } = {}) {
    const p = DATA.posts.find((x) => x.id === id);
    if (!p) return;
    closeSheet(true);
    sheetPost = p;
    const st = statusOf(p);
    scrimEl = document.createElement("div"); scrimEl.className = "scrim";
    sheetEl = document.createElement("section"); sheetEl.className = "sheet"; sheetEl.setAttribute("role", "dialog"); sheetEl.setAttribute("aria-modal", "true");
    const ms = t(p);
    const fields = [
      ["Caption · with hashtags", p.caption, "caption", "Caption missing"],
      ["Hashtags", p.hashtags, "tags", "No hashtags"],
      ["Comment keyword", p.keyword, "kw", "No keyword"],
      ["DM reply", p.dm, "dm", p.keyword ? "DM reply missing" : "No DM reply"],
    ];
    const notes = [];
    if (p.trial) notes.push(["hl", I.flask, "Post as a <b>Trial reel</b> (Trial ON in the Instagram app)."]);
    if (p.music) notes.push(["", I.music, esc(p.music)]);
    for (const n of p.notes || []) notes.push(["", I.info, esc(n)]);
    if (p.dm_note) notes.push(["", I.msg, esc(p.dm_note)]);
    if (p.src) notes.push(["", I.info, `Caption from: ${esc(p.src)}`]);

    sheetEl.innerHTML = `
      <div class="grab"><i></i></div>
      <div class="sh-top"><div class="acct">${acctHTML(p)} <span class="pill ${st}" style="margin-left:6px">${statusLabel(p, st)}</span></div>
        <button class="icon-btn" id="sh-x" aria-label="Close">${I.close}</button></div>
      <div class="scroll" id="sh-scroll">
        <h2>${esc(p.title)}</h2>
        <div style="font-size:14px;color:var(--muted)">${esc(p.series)}${p.v ? ` · ${Math.round(p.v.dur)} s · ${(p.v.size / 1e6).toFixed(1)} MB` : ""}${p.suggested ? " · suggested time" : ""}</div>
        ${p.at ? `<div class="when"><div><small>Pakistan</small><b class="num">${p.time_unknown ? "—" : timeInFull(ms, TZ_PK)}</b><div style="font-size:13px;color:var(--muted)">${dayLabel(ms, TZ_PK)}</div></div>
          <div><small>US Eastern</small><b class="num">${p.time_unknown ? "—" : timeInFull(ms, TZ_ET)}</b><div style="font-size:13px;color:var(--muted)">${dayLabel(ms, TZ_ET)}</div></div></div>
          ${!p.time_unknown ? `<div class="cdline">${ms > now() ? "Goes out " : ""}${inText(ms)}</div>` : ""}` : ""}
        ${p.v ? `<div class="media" id="media"><div class="pv" ${p.poster && POSTERS[p.poster] ? `style="background-image:url('${POSTERS[p.poster]}')"` : ""}></div>
            <div class="load" id="load">${ring(0)}</div></div>` : ""}
        ${p.imgs ? `<div class="gallery" id="gal">${p.imgs.map((im, i) => `<div class="g" data-i="${i}" style="background-image:url('${POSTERS[im.t] || ""}')"></div>`).join("")}</div>` : ""}
        ${p.v || p.imgs ? `<div class="save"><button class="btn pri block" id="save" disabled>${I.down}<span>${p.v ? "Save video" : "Save images"}</span></button>
          <div class="hint" id="save-hint">${p.v ? "Opens the share sheet: tap “Save Video” to put it in Photos." : "Opens the share sheet: tap “Save Images”."}</div></div>` : ""}
        ${fields.map(([label, val, k, miss]) => `<div class="field" data-f="${k}"><div class="fh"><small>${label}</small>
            <button class="copy" data-copy="${k}" ${val ? "" : "disabled"}>${I.copy}<span>Copy</span></button></div>
            <div class="val ${k === "kw" ? "kw" : ""} ${k === "caption" || k === "dm" ? "clamp" : ""}">${val ? esc(val) : `<span class="missing">${miss}</span>`}</div>
            ${(k === "caption" || k === "dm") && val && val.split("\n").length + val.length / 42 > 4.5 ? `<button class="more" data-more>Show all</button>` : ""}</div>`).join("")}
        ${notes.length ? `<ul class="notes">${notes.map(([c, ic, tx]) => `<li class="${c}">${ic}<span>${tx}</span></li>`).join("")}</ul>` : ""}
        ${p.link ? `<a class="btn ghost block" style="margin-top:14px;text-decoration:none;color:inherit" href="${esc(p.link)}" target="_blank" rel="noopener">${I.link}<span>Open the live post</span></a>` : ""}
        <button class="toggle-row" id="mark"><div class="tx"><b>Posted</b><span>${st === "posted" ? (done[p.id] ? "Marked on this phone" : p.status === "scheduled" ? "Went out from the scheduler" : "Already out") : "Tap when it's live"}</span></div><span class="sw ${st === "posted" ? "on" : ""}"></span></button>
        <div class="foot">${esc(p.id)}</div>
      </div>`;
    document.body.append(scrimEl, sheetEl);
    document.body.classList.add("sheet-open");
    requestAnimationFrame(() => { scrimEl.classList.add("in"); sheetEl.classList.add("in"); });
    scrimEl.addEventListener("click", () => history.back());
    $("#sh-x", sheetEl).addEventListener("click", () => history.back());
    if (push) history.pushState({ sheet: id }, "", location.href);
    dragToClose();

    const texts = { caption: p.caption, tags: p.hashtags, kw: p.keyword, dm: p.dm };
    sheetEl.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copyText(texts[b.dataset.copy], b)));
    sheetEl.querySelectorAll("[data-more]").forEach((b) => b.addEventListener("click", () => { b.previousElementSibling.classList.remove("clamp"); b.remove(); }));
    $("#mark", sheetEl).addEventListener("click", () => toggleDone(p));

    if (p.v) loadVideo(p);
    if (p.imgs) loadImages(p);
  }
  function ring(f) {
    const c = 2 * Math.PI * 28;
    return `<div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="4"/>
      <circle cx="32" cy="32" r="28" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/></svg><span class="num">${Math.round(f * 100)}%</span></div>`;
  }
  async function loadVideo(p) {
    const me = sheetPost;
    const load = $("#load", sheetEl), saveBtn = $("#save", sheetEl);
    try {
      const blob = await getBlob(p.v.f, "video/mp4", (f) => { if (sheetPost === me && load) load.innerHTML = ring(f); }, p.v.size);
      if (sheetPost !== me) return;
      const url = URL.createObjectURL(blob);
      const media = $("#media", sheetEl);
      const poster = p.poster && POSTERS[p.poster] ? POSTERS[p.poster] : "";
      media.innerHTML = `<video controls playsinline preload="metadata" ${poster ? `poster="${poster}"` : ""} src="${url}"></video>`;
      media.dataset.url = url;
      const file = new File([blob], safeName(p.title) + ".mp4", { type: "video/mp4" });
      saveBtn.disabled = false;
      saveBtn.onclick = () => shareFiles([file], url, p.title);
    } catch (e) {
      if (load) load.innerHTML = `<div style="padding:20px;text-align:center;font-size:14px">Couldn't load this video.<br><button class="btn sec" style="margin-top:10px" id="retry">Try again</button></div>`;
      $("#retry", sheetEl)?.addEventListener("click", () => { load.innerHTML = ring(0); loadVideo(p); });
    }
  }
  async function loadImages(p) {
    const me = sheetPost;
    const saveBtn = $("#save", sheetEl);
    try {
      const blobs = await Promise.all(p.imgs.map((im) => getBlob(im.f, "image/jpeg")));
      if (sheetPost !== me) return;
      const urls = blobs.map((b) => URL.createObjectURL(b));
      sheetEl.querySelectorAll("#gal .g").forEach((g, i) => { g.innerHTML = `<img alt="" src="${urls[i]}">`; });
      const files = blobs.map((b, i) => new File([b], `${safeName(p.title)} ${i + 1}.jpg`, { type: "image/jpeg" }));
      saveBtn.disabled = false;
      saveBtn.onclick = () => shareFiles(files, urls[0], p.title);
    } catch { toast("Couldn't load the images"); }
  }
  async function shareFiles(files, url, title) {
    try {
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    // fallback: plain download
    files.forEach((f, i) => {
      const a = document.createElement("a");
      a.href = i === 0 && url ? url : URL.createObjectURL(f); a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
    });
    toast("Downloading…");
  }
  async function copyText(text, btn) {
    if (!text) return;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px"; document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      try { ok = document.execCommand("copy"); } catch {}
      ta.remove();
    }
    if (ok) {
      btn.classList.add("ok"); btn.innerHTML = `${I.check}<span>Copied</span>`;
      if (navigator.vibrate) navigator.vibrate(10);
      clearTimeout(btn._t); btn._t = setTimeout(() => { btn.classList.remove("ok"); btn.innerHTML = `${I.copy}<span>Copy</span>`; }, 1800);
    } else toast("Couldn't copy: long-press the text instead");
  }
  function toggleDone(p) {
    const st = statusOf(p);
    if (st === "posted") {
      if (done[p.id]) delete done[p.id]; else undone[p.id] = true;
    } else {
      delete undone[p.id];
      if (!(p.status === "posted" || (p.status === "scheduled" && t(p) <= now()))) done[p.id] = Date.now();
    }
    LS.set("zc.done", done); LS.set("zc.undone", undone);
    const now2 = statusOf(p);
    const sw = $("#mark .sw", sheetEl); sw.classList.toggle("on", now2 === "posted");
    $("#mark span", sheetEl).textContent = now2 === "posted" ? "Marked on this phone" : "Tap when it's live";
    const pill = $(".sh-top .pill", sheetEl); pill.className = "pill " + now2; pill.textContent = statusLabel(p, now2);
    toast(now2 === "posted" ? "Marked as posted" : "Marked as not posted");
    render();
  }
  function dragToClose() {
    const handles = [$(".grab", sheetEl), $(".sh-top", sheetEl)];
    let y0 = null, dy = 0;
    const start = (e) => { y0 = e.touches[0].clientY; dy = 0; sheetEl.style.transition = "none"; };
    const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheetEl.style.transform = `translateY(${dy}px)`; };
    const end = () => { if (y0 == null) return; sheetEl.style.transition = ""; sheetEl.style.transform = ""; if (dy > 110) history.back(); y0 = null; };
    handles.forEach((h) => { h.addEventListener("touchstart", start, { passive: true }); h.addEventListener("touchmove", move, { passive: true }); h.addEventListener("touchend", end); });
    // pull down from the top of the scroll area too
    const sc = $("#sh-scroll", sheetEl);
    let sy = null;
    sc.addEventListener("touchstart", (e) => { sy = sc.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    sc.addEventListener("touchmove", (e) => { if (sy == null) return; dy = e.touches[0].clientY - sy; if (dy > 0 && sc.scrollTop <= 0) { sheetEl.style.transition = "none"; sheetEl.style.transform = `translateY(${dy * 0.8}px)`; } }, { passive: true });
    sc.addEventListener("touchend", () => { if (sy == null) return; sheetEl.style.transition = ""; sheetEl.style.transform = ""; if (dy > 140) history.back(); sy = null; });
  }
  function closeSheet(instant) {
    if (!sheetEl) return;
    const s = sheetEl, sc = scrimEl;
    const v = s.querySelector("video"); if (v) { try { v.pause(); } catch {} }
    sheetEl = scrimEl = null; sheetPost = null;
    document.body.classList.remove("sheet-open");
    if (instant) { s.remove(); sc.remove(); return; }
    s.classList.remove("in"); sc.classList.remove("in");
    setTimeout(() => { s.remove(); sc.remove(); }, 340);
  }
  window.addEventListener("popstate", (e) => {
    if (sheetEl) closeSheet(false);
    else if (e.state && e.state.sheet) openPost(e.state.sheet, { push: false });
  });

  // ---------------------------------------------------------------- menu
  function openMenu() {
    const old = $(".menu"); if (old) { old.remove(); return; }
    const m = document.createElement("div"); m.className = "menu";
    const th = LS.get("zc.theme", "system");
    const local = Object.keys(done).length + Object.keys(undone).length;
    m.innerHTML = `<small>Appearance</small>
      ${["system", "light", "dark"].map((x) => `<button data-th="${x}">${x === th ? I.check : `<span style="width:22px"></span>`}${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}
      <hr><button data-act="reset">${I.reset}Clear my "posted" marks${local ? ` (${local})` : ""}</button>
      <button data-act="lock">${I.close}Forget the key on this phone</button>
      <small>Content built ${esc(DATA.built)}<br>${DATA.posts.length} posts</small>`;
    document.body.appendChild(m);
    const off = (e) => { if (!m.contains(e.target) && e.target.closest("#b-more") == null) { m.remove(); document.removeEventListener("click", off, true); } };
    setTimeout(() => document.addEventListener("click", off, true));
    m.querySelectorAll("[data-th]").forEach((b) => b.addEventListener("click", () => { LS.set("zc.theme", b.dataset.th); applyTheme(); m.remove(); }));
    m.querySelector('[data-act="reset"]').addEventListener("click", () => { if (confirm("Clear every 'posted' mark you set on this phone?")) { done = {}; undone = {}; LS.set("zc.done", done); LS.set("zc.undone", undone); render(); } m.remove(); });
    m.querySelector('[data-act="lock"]').addEventListener("click", () => { if (confirm("Forget the key? You'll need the private link again.")) { LS.del("zc.key"); location.hash = ""; location.reload(); } });
  }

  let toastT = null;
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("in"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("in"), 1900); }

  // ---------------------------------------------------------------- lock screen
  function lock(err) {
    app.innerHTML = `<div class="lock">
      <div class="seal-lg" style="animation:none"></div>
      <h1>Ziztu Posts</h1>
      <p>This calendar is private. Open it with your private link, or paste the link here.</p>
      ${err ? `<div class="err">${esc(err)}</div>` : ""}
      <input id="lk" type="url" inputmode="url" placeholder="Paste the private link" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn pri block" id="lk-go">Open</button></div>`;
    const go = () => {
      const v = $("#lk").value.trim(); const m = v.match(/[#&]k=([A-Za-z0-9_-]+)/) || v.match(/^([A-Za-z0-9_-]{40,})$/);
      if (!m) { lock("That doesn't look like the private link."); return; }
      location.hash = "k=" + m[1]; start();
    };
    $("#lk-go").addEventListener("click", go);
    $("#lk").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }

  // ---------------------------------------------------------------- start
  async function start() {
    const m = location.hash.match(/k=([A-Za-z0-9_-]+)/);
    let k = m ? m[1] : LS.get("zc.key", null);
    if (!k) { lock(); return; }
    if (!m) history.replaceState(history.state, "", location.pathname + location.search + "#k=" + k); // keep the key in the URL for Add to Home Screen
    try {
      KEY = await importKey(b64u.dec(k));
      const d = await fetchEnc("d");
      DATA = JSON.parse(new TextDecoder().decode(d));
      LS.set("zc.key", k);
    } catch (e) {
      console.error(e);
      if (!navigator.onLine) { app.innerHTML = `<div class="lock"><div class="seal-lg" style="animation:none"></div><h1>You're offline</h1><p>Connect once to load the calendar.</p></div>`; return; }
      LS.del("zc.key"); lock("This key doesn't open the calendar. Use the newest private link."); return;
    }
    shell(); render();
    fetchEnc("p").then((buf) => { POSTERS = JSON.parse(new TextDecoder().decode(buf)); render(); }).catch(() => {});
    // refresh countdowns / statuses every minute
    setInterval(() => { if (!sheetEl && S.view !== "today") render(); }, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !sheetEl) render(); });
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=d5ccc9e016").catch(() => {});
  start();
})();
