const DATA_URL = "../data/processed/refinery_import_crude_long.json";
const COLORS = ["#2f6f73", "#b05c2a", "#52688f", "#8b6f3d", "#5f7f55", "#7b5d7e", "#a24848", "#4f7d99", "#8d7a2d", "#58606a"];

const state = {
  raw: [],
  months: [],
  refineries: [],
  oils: [],
  activeTab: "refinery",
};

const $ = (id) => document.getElementById(id);
const fmt = (value) => Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const sum = (rows) => rows.reduce((acc, row) => acc + Number(row.volume_10kt || 0), 0);
const uniq = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));

function groupSum(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    map.set(key, (map.get(key) || 0) + Number(row.volume_10kt || 0));
  });
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function populateSelect(select, values) {
  select.innerHTML = "";
  values.forEach((value) => select.append(new Option(value, value)));
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    initialize(payload.records || []);
  } catch (error) {
    $("localLoad").hidden = false;
  }
}

function initialize(records) {
  state.raw = records
    .map((row) => ({ ...row, volume_10kt: Number(row.volume_10kt || 0) }))
    .filter((row) => !row.is_total_row && Number(row.volume_10kt || 0) !== 0);
  state.months = uniq(state.raw.map((row) => row.month));
  state.refineries = uniq(state.raw.map((row) => row.refinery));
  state.oils = uniq(state.raw.map((row) => row.oil_name_en));

  populateSelect($("refinerySelect"), state.refineries);
  populateSelect($("oilSelect"), state.oils);
  populateSelect($("refineryMonthStart"), state.months);
  populateSelect($("refineryMonthEnd"), state.months);
  populateSelect($("oilMonthStart"), state.months);
  populateSelect($("oilMonthEnd"), state.months);

  resetMonthRangesToLatest();

  bindEvents();
  renderActive();
}

function latestMonth() {
  return state.months[state.months.length - 1] || "";
}

function resetMonthRangesToLatest() {
  const firstMonth = state.months[0] || "";
  const lastMonth = latestMonth();
  $("refineryMonthStart").value = firstMonth;
  $("oilMonthStart").value = firstMonth;
  $("refineryMonthEnd").value = lastMonth;
  $("oilMonthEnd").value = lastMonth;
}

function bindEvents() {
  ["refinerySelect", "refineryMonthStart", "refineryMonthEnd"].forEach((id) => $(id).addEventListener("input", renderRefinery));
  ["oilSelect", "oilMonthStart", "oilMonthEnd"].forEach((id) => $(id).addEventListener("input", renderOil));
  $("jsonFileInput").addEventListener("change", handleJsonFile);
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab));
  renderActive();
}

function handleJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const payload = JSON.parse(reader.result);
    $("localLoad").hidden = true;
    initialize(payload.records || []);
  };
  reader.readAsText(file, "utf-8");
}

function renderActive() {
  if (state.activeTab === "refinery") renderRefinery();
  if (state.activeTab === "oil") renderOil();
}

function rowsInMonthRange(rows, startId, endId) {
  const start = $(startId).value;
  const end = $(endId).value;
  return rows.filter((row) => (!start || row.month >= start) && (!end || row.month <= end));
}

function renderRefinery() {
  const refinery = $("refinerySelect").value;
  const rows = rowsInMonthRange(
    state.raw.filter((row) => row.refinery === refinery),
    "refineryMonthStart",
    "refineryMonthEnd"
  );
  $("refineryTotal").textContent = `${fmt(sum(rows))} 万吨`;
  renderBarChart("refineryMonthlyChart", groupByMonth(rows), { orientation: "vertical" });
  renderStackedChart("refineryStackChart", rows);
  renderMatrix("refineryMatrix", rows, "oil_name_en", "原油英文名", jumpToOil);
  renderDetailTable("refineryDetail", rows, ["month", "region", "refinery", "oil_name_en", "origin_region", "volume_10kt"]);
}

function renderOil() {
  const oil = $("oilSelect").value;
  const rows = rowsInMonthRange(
    state.raw.filter((row) => row.oil_name_en === oil),
    "oilMonthStart",
    "oilMonthEnd"
  );
  $("oilTotal").textContent = `${fmt(sum(rows))} 万吨`;
  renderLineChart("oilMonthlyChart", groupByMonth(rows));
  renderBarChart("oilRefineryChart", groupSum(rows, (row) => row.refinery).slice(0, 15), { orientation: "horizontal" });
  renderMatrix("oilMatrix", rows, "refinery", "炼厂名称", jumpToRefinery);
  renderDetailTable("oilDetail", rows, ["month", "region", "refinery", "oil_name_en", "origin_region", "volume_10kt"]);
}

function groupByMonth(rows) {
  const months = state.months.filter((month) => rows.some((row) => row.month === month));
  const byMonth = new Map(months.map((month) => [month, 0]));
  rows.forEach((row) => byMonth.set(row.month, (byMonth.get(row.month) || 0) + row.volume_10kt));
  return [...byMonth.entries()].map(([name, value]) => ({ name, value }));
}

function renderMatrix(containerId, rows, rowKey, firstHeader, clickHandler) {
  const months = uniq(rows.map((row) => row.month));
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row[rowKey];
    if (!grouped.has(key)) grouped.set(key, new Map(months.map((month) => [month, 0])));
    grouped.get(key).set(row.month, (grouped.get(key).get(row.month) || 0) + row.volume_10kt);
  });
  const records = [...grouped.entries()]
    .map(([name, values]) => ({ name, values, total: [...values.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);

  const table = document.createElement("table");
  table.className = "data-table";
  table.append(makeHeader([firstHeader, ...months, "累计"]));
  const tbody = document.createElement("tbody");
  records.forEach((record) => {
    const tr = document.createElement("tr");
    const first = document.createElement("td");
    const button = document.createElement("button");
    button.className = "link-button";
    button.textContent = record.name;
    button.addEventListener("click", () => clickHandler(record.name));
    first.append(button);
    tr.append(first);
    months.forEach((month) => tr.append(numberCell(record.values.get(month))));
    tr.append(numberCell(record.total));
    tbody.append(tr);
  });
  table.append(tbody);
  attachSort(table);
  replaceContent(containerId, wrapScrollable(table));
}

function wrapScrollable(table) {
  const wrapper = document.createElement("div");
  wrapper.className = "table-scroll";
  wrapper.append(table);
  return wrapper;
}

function renderDetailTable(containerId, rows, columns) {
  const labels = {
    month: "月份",
    region: "地区",
    refinery: "炼厂名称",
    oil_name_en: "原油英文名",
    origin_region: "来源区域",
    volume_10kt: "数量(万吨)",
  };
  const table = document.createElement("table");
  table.className = "data-table";
  table.append(makeHeader(columns.map((col) => labels[col] || col)));
  const tbody = document.createElement("tbody");
  rows
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month) || a.refinery.localeCompare(b.refinery, "zh-CN") || a.oil_name_en.localeCompare(b.oil_name_en))
    .forEach((row) => {
      const tr = document.createElement("tr");
      columns.forEach((col) => {
        if (col === "volume_10kt") tr.append(numberCell(row[col]));
        else {
          const td = document.createElement("td");
          td.textContent = row[col] || "";
          tr.append(td);
        }
      });
      tbody.append(tr);
    });
  table.append(tbody);
  attachSort(table);
  replaceContent(containerId, wrapScrollable(table));
}

function makeHeader(headers) {
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    th.tabIndex = 0;
    th.title = "点击排序";
    tr.append(th);
  });
  thead.append(tr);
  return thead;
}

function attachSort(table) {
  [...table.querySelectorAll("th")].forEach((header, index) => {
    header.addEventListener("click", () => sortTable(table, index, header));
  });
}

function sortTable(table, index, header) {
  const tbody = table.querySelector("tbody");
  const direction = header.dataset.sort === "asc" ? "desc" : "asc";
  table.querySelectorAll("th").forEach((th) => {
    th.dataset.sort = "";
    th.classList.remove("sorted");
  });
  header.dataset.sort = direction;
  header.classList.add("sorted");
  const rows = [...tbody.querySelectorAll("tr")];
  rows.sort((a, b) => {
    const av = a.children[index]?.textContent.trim() || "";
    const bv = b.children[index]?.textContent.trim() || "";
    const an = Number(av.replace(/,/g, ""));
    const bn = Number(bv.replace(/,/g, ""));
    const result = Number.isFinite(an) && Number.isFinite(bn) && (av || bv) ? an - bn : av.localeCompare(bv, "zh-CN");
    return direction === "asc" ? result : -result;
  });
  rows.forEach((row) => tbody.append(row));
}

function numberCell(value) {
  const td = document.createElement("td");
  td.className = "num";
  td.textContent = value ? fmt(value) : "";
  return td;
}

function replaceContent(id, element) {
  const container = $(id);
  container.innerHTML = "";
  container.append(element);
}

function jumpToOil(name) {
  $("oilSelect").value = name;
  $("oilMonthStart").value = $("refineryMonthStart").value;
  $("oilMonthEnd").value = $("refineryMonthEnd").value;
  switchTab("oil");
}

function jumpToRefinery(name) {
  $("refinerySelect").value = name;
  $("refineryMonthStart").value = $("oilMonthStart").value;
  $("refineryMonthEnd").value = $("oilMonthEnd").value;
  switchTab("refinery");
}

function shouldShowTimeTick(name, index, total) {
  if (total <= 12) return true;
  if (index === 0 || index === total - 1) return true;
  const month = String(name || "").slice(5, 7);
  if (month === "01") return true;
  if (total <= 24) return index % 2 === 0;
  return false;
}
function renderBarChart(id, data, options = {}) {
  const el = $(id);
  el.innerHTML = "";
  if (!data.length) return;
  const width = el.clientWidth || 520;
  const height = el.clientHeight || 300;
  const margin = options.orientation === "horizontal" ? { top: 18, right: 78, bottom: 76, left: 150 } : { top: 18, right: 24, bottom: 76, left: 66 };
  const svg = svgEl(width, height);
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  drawAxes(svg, margin, plotW, plotH, max, options.orientation);

  if (options.orientation === "horizontal") {
    const step = plotH / data.length;
    data.forEach((d, i) => {
      const y = margin.top + i * step;
      const w = (d.value / max) * plotW;
      const bar = rect(margin.left, y + 4, w, Math.max(8, step - 8), "#2f6f73");
      addTitle(bar, `${d.name}: ${fmt(d.value)} 万吨`);
      svg.append(text(8, y + step * 0.62, trimLabel(d.name, 18), "label"));
      svg.append(bar);
      svg.append(text(margin.left + w + 6, y + step * 0.62, fmt(d.value), "value"));
    });
  } else {
    const step = plotW / data.length;
    data.forEach((d, i) => {
      const barW = Math.max(12, step * 0.52);
      const h = (d.value / max) * plotH;
      const x = margin.left + i * step + (step - barW) / 2;
      const y = margin.top + plotH - h;
      const bar = rect(x, y, barW, h, "#2f6f73");
      addTitle(bar, `${d.name}: ${fmt(d.value)} 万吨`);
      svg.append(bar);
      if (shouldShowTimeTick(d.name, i, data.length)) svg.append(text(x + barW / 2, height - 38, d.name, "tick", true));
    });
  }
  el.append(svg);
}

function renderLineChart(id, data) {
  const el = $(id);
  el.innerHTML = "";
  if (!data.length) return;
  const width = el.clientWidth || 520;
  const height = el.clientHeight || 300;
  const margin = { top: 18, right: 26, bottom: 76, left: 66 };
  const svg = svgEl(width, height);
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  drawAxes(svg, margin, plotW, plotH, max, "vertical");
  const points = data.map((d, i) => {
    const x = margin.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = margin.top + plotH - (d.value / max) * plotH;
    return { ...d, x, y };
  });
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", points.map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`).join(" "));
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "#b05c2a");
  p.setAttribute("stroke-width", "3");
  svg.append(p);
  points.forEach((point) => {
    const dot = circle(point.x, point.y, 4, "#b05c2a");
    addTitle(dot, `${point.name}: ${fmt(point.value)} 万吨`);
    svg.append(dot);
    if (shouldShowTimeTick(point.name, points.indexOf(point), points.length)) svg.append(text(point.x, height - 38, point.name, "tick", true));
  });
  el.append(svg);
}

function renderStackedChart(id, rows) {
  const el = $(id);
  el.innerHTML = "";
  const months = uniq(rows.map((row) => row.month));
  const series = groupSum(rows, (row) => row.oil_name_en).slice(0, 10).map((item) => item.name);
  if (!months.length || !series.length) return;
  const width = el.clientWidth || 520;
  const height = el.clientHeight || 320;
  const margin = { top: 18, right: 140, bottom: 76, left: 66 };
  const svg = svgEl(width, height);
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const totals = months.map((month) => sum(rows.filter((row) => row.month === month && series.includes(row.oil_name_en))));
  const max = niceMax(Math.max(...totals, 1));
  drawAxes(svg, margin, plotW, plotH, max, "vertical");
  const step = plotW / months.length;
  months.forEach((month, i) => {
    let yBase = margin.top + plotH;
    const x = margin.left + i * step + step * 0.25;
    const barW = step * 0.5;
    series.forEach((name, j) => {
      const value = sum(rows.filter((row) => row.month === month && row.oil_name_en === name));
      const h = (value / max) * plotH;
      yBase -= h;
      const bar = rect(x, yBase, barW, h, COLORS[j % COLORS.length]);
      addTitle(bar, `${month} ${name}: ${fmt(value)} 万吨`);
      svg.append(bar);
    });
    if (shouldShowTimeTick(month, i, months.length)) svg.append(text(x + barW / 2, height - 38, month, "tick", true));
  });
  drawLegend(svg, width - margin.right + 14, margin.top, series);
  el.append(svg);
}

function drawAxes(svg, margin, plotW, plotH, max, orientation) {
  const axis = "#9aa4a0";
  const grid = "#e3e7e1";
  const x0 = margin.left;
  const y0 = margin.top + plotH;
  svg.append(line(x0, margin.top, x0, y0, axis));
  svg.append(line(x0, y0, x0 + plotW, y0, axis));
  for (let i = 0; i <= 4; i += 1) {
    const value = (max / 4) * i;
    if (orientation === "horizontal") {
      const x = x0 + (value / max) * plotW;
      svg.append(line(x, y0, x, y0 + 5, axis));
      svg.append(text(x, y0 + 24, fmt(value), "axis", false, "middle"));
      if (i > 0) svg.append(line(x, margin.top, x, y0, grid));
    } else {
      const y = y0 - (value / max) * plotH;
      svg.append(line(x0 - 5, y, x0, y, axis));
      svg.append(text(x0 - 10, y + 4, fmt(value), "axis", false, "end"));
      if (i > 0) svg.append(line(x0, y, x0 + plotW, y, grid));
    }
  }
}

function drawLegend(svg, x, y, names) {
  names.forEach((name, index) => {
    const yy = y + index * 20;
    svg.append(rect(x, yy - 10, 10, 10, COLORS[index % COLORS.length]));
    svg.append(text(x + 16, yy, trimLabel(name, 15), "legend"));
  });
}

function niceMax(value) {
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  return Math.ceil(value / base) * base;
}

function svgEl(width, height) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  return svg;
}

function rect(x, y, width, height, fill) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  node.setAttribute("width", Math.max(0, width));
  node.setAttribute("height", Math.max(0, height));
  node.setAttribute("fill", fill);
  node.setAttribute("rx", 2);
  return node;
}

function line(x1, y1, x2, y2, stroke) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "line");
  node.setAttribute("x1", x1);
  node.setAttribute("y1", y1);
  node.setAttribute("x2", x2);
  node.setAttribute("y2", y2);
  node.setAttribute("stroke", stroke);
  node.setAttribute("stroke-width", "1");
  return node;
}

function circle(cx, cy, r, fill) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  node.setAttribute("cx", cx);
  node.setAttribute("cy", cy);
  node.setAttribute("r", r);
  node.setAttribute("fill", fill);
  return node;
}

function text(x, y, value, cls, rotate = false, anchor = null) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  node.setAttribute("class", cls);
  if (anchor) node.setAttribute("text-anchor", anchor);
  if (rotate) {
    node.setAttribute("text-anchor", "end");
    node.setAttribute("transform", `rotate(-25 ${x} ${y})`);
  }
  node.textContent = value;
  return node;
}

function addTitle(node, value) {
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = value;
  node.append(title);
}

function trimLabel(value, max) {
  const textValue = String(value || "");
  return textValue.length > max ? `${textValue.slice(0, max - 1)}...` : textValue;
}

loadData();



