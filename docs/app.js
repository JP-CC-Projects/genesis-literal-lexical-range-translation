const byH = new Map();
const byLex = new Map();
const partById = new Map();
let lexicon = {};
let highlighted = [];
let current = null;
let shiftDown = false;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function index(node) {
  const ids = [node.dataset.h, ...(node.dataset.also || "").split(",")].filter(Boolean);
  const lex = node.dataset.lex;
  for (const h of ids) {
    if (!byH.has(h)) byH.set(h, []);
    byH.get(h).push(node);
  }
  if (lex) {
    if (!byLex.has(lex)) byLex.set(lex, []);
    byLex.get(lex).push(node);
  }
}

function render(data) {
  const main = document.getElementById("text");
  let row = 1;
  for (const verse of data.verses) {
    const block = el("article", "verse");
    block.id = "v" + verse.n;
    const last = verse.he[verse.he.length - 1];
    const open = last && (last.after === "pe" || last.after === "sof-pe");

    const en = el("p", "en-line");
    en.style.gridRow = String(row);
    en.appendChild(el("span", "vn", String(verse.n)));
    verse.en.forEach((word, i) => {
      if (i) en.appendChild(document.createTextNode(" "));
      const node = el("span", "en", word.t);
      if (word.h) node.dataset.h = word.h;
      if (word.also) node.dataset.also = word.also.join(",");
      if (word.lex) node.dataset.lex = word.lex;
      if (word.morph) node.dataset.morph = word.morph;
      if (word.supplied) node.classList.add("supplied");
      index(node);
      en.appendChild(node);
    });

    const he = el("p", "he-line");
    he.style.gridRow = String(row);
    he.lang = "he";
    for (const word of verse.he) {
      const hw = el("span", "hw");
      for (const part of word.parts) {
        partById.set(part.id, part);
        const node = el("span", "hm", part.t);
        node.dataset.h = part.id;
        if (part.lex) node.dataset.lex = part.lex;
        node.dataset.morph = part.morph;
        index(node);
        hw.appendChild(node);
      }
      he.appendChild(hw);
      const after = word.after;
      if (after === "maqqef") he.appendChild(document.createTextNode("־"));
      else if (after === "paseq") he.appendChild(document.createTextNode(" ׀ "));
      else if (after === "sof" || after === "sof-pe") he.appendChild(document.createTextNode("׃"));
      else he.appendChild(document.createTextNode(" "));
    }

    block.append(en, he);
    row += 1;
    if (open) {
      block.append(paragraphMark(verse.n, row), paragraphHebrew(verse.n, row));
      row += 1;
    }
    main.appendChild(block);
  }
}

function paragraphLine(verse, row, cls) {
  const line = el("p", cls + " pe-line");
  line.style.gridRow = String(row);
  line.dataset.h = "pe-" + verse;
  line.dataset.lex = "m:pe";
  index(line);
  return line;
}

function paragraphMark(verse, row) {
  return paragraphLine(verse, row, "en-line en");
}

function paragraphHebrew(verse, row) {
  const line = paragraphLine(verse, row, "he-line hm");
  line.lang = "he";
  return line;
}

function clearHighlight() {
  for (const node of highlighted) node.classList.remove("hl-one", "hl-all");
  highlighted = [];
}

function paint() {
  clearHighlight();
  if (!current) return;
  const useLex = shiftDown && current.dataset.lex;
  let list;
  if (useLex) {
    list = byLex.get(current.dataset.lex);
  } else {
    const ids = [current.dataset.h, ...(current.dataset.also || "").split(",")].filter(Boolean);
    const seen = new Set();
    list = [];
    for (const id of ids) {
      for (const node of byH.get(id) || []) {
        if (seen.has(node)) continue;
        seen.add(node);
        list.push(node);
      }
    }
  }
  if (!list.length) return;
  const cls = useLex ? "hl-all" : "hl-one";
  for (const node of list) {
    node.classList.add(cls);
    highlighted.push(node);
  }
}

function englishWords(node) {
  if (node.dataset.lex === "m:pe") return "(blank)";
  if (node.classList.contains("en")) return node.textContent;
  const linked = (byH.get(node.dataset.h) || []).filter((item) => item.classList.contains("en"));
  return linked.map((item) => item.textContent).join(" ");
}

function hebrewWord(node) {
  if (node.dataset.lex === "m:pe") return "פ";
  if (node.classList.contains("hm")) return node.textContent;
  const linked = (byH.get(node.dataset.h) || []).find((item) => item.classList.contains("hm"));
  if (linked) return linked.textContent;
  const part = node.dataset.h ? partById.get(node.dataset.h) : null;
  return part ? part.t : "";
}

function lexiconEntry(node) {
  const key = node.dataset.lex;
  if (key && lexicon[key]) return lexicon[key];
  const part = node.dataset.h ? partById.get(node.dataset.h) : null;
  if (part && part.lex && lexicon[part.lex]) return lexicon[part.lex];
  return null;
}

function section(parent, label) {
  const block = el("section", "side-section");
  block.appendChild(el("h2", null, label));
  parent.appendChild(block);
  return block;
}

function showSidebar(node) {
  const body = document.getElementById("side-body");
  body.replaceChildren();
  const entry = lexiconEntry(node) || {};
  const note = entry.note || {};

  body.appendChild(el("p", "side-en", englishWords(node)));
  body.appendChild(el("p", "side-he", hebrewWord(node)));
  body.appendChild(el("p", "side-tr", entry.transliteration || ""));

  section(body, "Discussion").insertAdjacentHTML("beforeend", note.discussion || "");
  section(body, "Usages").insertAdjacentHTML("beforeend", note.usages || "");
  section(body, "Sources").insertAdjacentHTML("beforeend", note.sources || "");

  document.getElementById("side").hidden = false;
  document.body.classList.add("side-open");
}

function wordFrom(target) {
  return target && target.closest ? target.closest(".en, .hm") : null;
}

function bind() {
  const main = document.getElementById("text");
  main.addEventListener("mouseover", (event) => {
    const word = wordFrom(event.target);
    if (word === current) return;
    current = word;
    paint();
  });
  main.addEventListener("mouseout", (event) => {
    if (!wordFrom(event.target)) return;
    const next = wordFrom(event.relatedTarget);
    if (next) return;
    current = null;
    paint();
  });
  main.addEventListener("click", (event) => {
    const word = wordFrom(event.target);
    if (word) showSidebar(word);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Shift" || shiftDown) return;
    shiftDown = true;
    paint();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key !== "Shift") return;
    shiftDown = false;
    paint();
  });
  window.addEventListener("blur", () => {
    shiftDown = false;
    paint();
  });
  document.getElementById("close").addEventListener("click", () => {
    document.getElementById("side").hidden = true;
    document.body.classList.remove("side-open");
  });
}

function store() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function setting(id, cls, fallback) {
  const box = document.getElementById(id);
  const stored = store()?.getItem(id);
  box.checked = stored == null ? fallback : stored === "1";
  document.body.classList.toggle(cls, box.checked);
  box.addEventListener("change", () => {
    store()?.setItem(id, box.checked ? "1" : "0");
    document.body.classList.toggle(cls, box.checked);
  });
}

function failed() {
  document.getElementById("text").textContent = "The text could not be loaded.";
}

function chapterEntry(chapters) {
  const n = Number(new URLSearchParams(window.location.search).get("ch"));
  return chapters.find((item) => item.n === n) || chapters[0];
}

function chapterNav(chapters, entry) {
  if (chapters.length < 2) return;
  const nav = el("nav", "chapters");
  nav.setAttribute("aria-label", "Chapters");
  for (const item of chapters) {
    if (item === entry) {
      const here = el("span", null, String(item.n));
      here.setAttribute("aria-current", "page");
      nav.appendChild(here);
    } else {
      const link = el("a", null, String(item.n));
      link.href = "?ch=" + item.n;
      nav.appendChild(link);
    }
  }
  document.querySelector("header h1").after(nav);
}

function start() {
  const data = window.SITE_DATA;
  if (!data) {
    failed();
    return;
  }
  lexicon = data.lexicon;
  render(data.chapter);
  bind();
}

function main() {
  setting("opt-verses", "show-vn", true);
  setting("opt-hebrew", "show-he", true);
  setting("opt-supplied", "mark-supplied", false);
  const chapters = window.SITE_CHAPTERS;
  if (!chapters || !chapters.length) {
    failed();
    return;
  }
  const entry = chapterEntry(chapters);
  document.title = entry.title;
  document.querySelector("header h1").textContent = entry.title;
  chapterNav(chapters, entry);
  const script = document.createElement("script");
  script.src = entry.file;
  script.addEventListener("load", start);
  script.addEventListener("error", failed);
  document.body.appendChild(script);
}

main();
