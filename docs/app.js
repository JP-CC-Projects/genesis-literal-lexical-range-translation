const byH = new Map();
const byLex = new Map();
const partById = new Map();
let lexicon = {};
let sources = {};
let notes = {};
let highlighted = [];
let current = null;
let shiftDown = false;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function link(href, text) {
  const node = el("a", null, text);
  node.href = href;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}

function index(node) {
  const h = node.dataset.h;
  const lex = node.dataset.lex;
  if (h) {
    if (!byH.has(h)) byH.set(h, []);
    byH.get(h).push(node);
  }
  if (lex) {
    if (!byLex.has(lex)) byLex.set(lex, []);
    byLex.get(lex).push(node);
  }
}

const PE_WHY =
  "This is an intentionally blank line, sometimes marked by פ (a petuchah) by scribes. In the Leningrad Codex, the scribe did not mark it but instead left the rest of the line blank and began again on the next line.  The letter פ is not written in the manuscript. It is the sign used here for that blank.";

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
  const list = useLex ? byLex.get(current.dataset.lex) : byH.get(current.dataset.h);
  if (!list) return;
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
  if (node.dataset.lex === "m:pe") {
    return { discussion: [{ title: "Open paragraph", text: PE_WHY }] };
  }
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

function Citations() {
  this.items = [];
  this.index = new Map();
}

Citations.prototype.mark = function (cites) {
  const nums = [];
  for (const cite of cites || []) {
    const key = cite.src + "\0" + (cite.loc || "");
    if (!this.index.has(key)) {
      this.index.set(key, this.items.length + 1);
      this.items.push(cite);
    }
    nums.push(this.index.get(key));
  }
  return nums;
};

function appendCites(parent, nums) {
  for (const n of nums) {
    parent.appendChild(document.createTextNode(" "));
    parent.appendChild(el("sup", "side-cite", "[" + n + "]"));
  }
}

function appendRich(parent, text) {
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end < 0) break;
      const strong = el("strong");
      appendRich(strong, text.slice(i + 2, end));
      parent.appendChild(strong);
      i = end + 2;
      continue;
    }
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end < 0) break;
      parent.appendChild(el("em", null, text.slice(i + 1, end)));
      i = end + 1;
      continue;
    }
    const cite = /^\[(\d+)\]/.exec(text.slice(i));
    if (cite) {
      parent.appendChild(el("sup", "side-cite", "[" + cite[1] + "]"));
      i += cite[0].length;
      continue;
    }
    let j = i + 1;
    while (j < text.length && text[j] !== "*" && text[j] !== "[") j += 1;
    if (text[j] === "[" && !/^\[\d+\]/.test(text.slice(j))) j += 1;
    parent.appendChild(document.createTextNode(text.slice(i, j)));
    i = j;
  }
  if (i < text.length) parent.appendChild(document.createTextNode(text.slice(i)));
}

function showSidebar(node) {
  const body = document.getElementById("side-body");
  body.replaceChildren();
  const entry = lexiconEntry(node) || {};
  const cites = new Citations();

  body.appendChild(el("p", "side-en", englishWords(node)));
  body.appendChild(el("p", "side-he", hebrewWord(node)));
  body.appendChild(el("p", "side-tr", entry.transliteration || ""));

  const discussion = section(body, "Discussion");
  for (const item of entry.discussion || []) {
    const head = el("h3");
    appendRich(head, item.title || "");
    discussion.appendChild(head);
    const parts = (item.text || "").split(/\n\n+/).filter((part) => part);
    const citeNums = cites.mark(item.cite);
    const inlineCites = /\[\d+\]/.test(item.text || "");
    (parts.length ? parts : [""]).forEach((part, i, all) => {
      const quoted = part.startsWith("> ");
      const text = el(quoted ? "blockquote" : "p");
      const body = quoted ? part.replace(/^> /gm, "") : part;
      body.split("\n").forEach((line, n) => {
        if (n) text.appendChild(document.createElement("br"));
        appendRich(text, line);
      });
      if (!inlineCites && i === all.length - 1) appendCites(text, citeNums);
      discussion.appendChild(text);
    });
  }

  const usages = section(body, "Usages");
  if ((entry.usages || []).length) {
    const ul = el("ul");
    for (const item of entry.usages) {
      const line = el("li");
      const ref = item.ref || "";
      line.appendChild(item.url ? link(item.url, ref) : el("span", "side-ref", ref));
      if (item.note) line.appendChild(document.createTextNode(" " + item.note));
      appendCites(line, cites.mark(item.cite));
      ul.appendChild(line);
    }
    usages.appendChild(ul);
  }

  const listed = section(body, "Sources");
  if (cites.items.length) {
    const ol = el("ol");
    for (const cite of cites.items) {
      const src = sources[cite.src] || {};
      const bits = [src.author, src.title, src.year, src.edition, cite.loc].filter(
        (value) => value != null && value !== ""
      );
      const label = src.label || bits.join(", ");
      const li = el("li");
      const holder = src.url ? link(src.url) : el("span");
      appendRich(holder, label);
      li.appendChild(holder);
      ol.appendChild(li);
    }
    listed.appendChild(ol);
  }

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

function main() {
  setting("opt-verses", "show-vn", true);
  setting("opt-hebrew", "show-he", true);
  setting("opt-supplied", "mark-supplied", false);
  const data = window.SITE_DATA;
  if (!data) {
    document.getElementById("text").textContent =
      "The text data (data/gen01.js) did not load. Run python3 scripts/build.py.";
    return;
  }
  lexicon = data.lexicon;
  sources = data.sources || {};
  notes = data.notes || {};
  render(data.chapter);
  bind();
}

main();
