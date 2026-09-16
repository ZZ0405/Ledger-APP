(function () {
  "use strict";

  /* ---------------- Storage ---------------- */
  var STORAGE_KEY = "ledgerAppV2";
  var DEFAULT_CATEGORIES = ["餐饮", "交通", "购物", "居住", "娱乐", "医疗", "教育", "人情", "其他"];

  var TAX_BRACKETS = [
    { lower: 0, rate: 0.03, deduction: 0 },
    { lower: 36000, rate: 0.10, deduction: 2520 },
    { lower: 144000, rate: 0.20, deduction: 16920 },
    { lower: 300000, rate: 0.25, deduction: 31920 },
    { lower: 420000, rate: 0.30, deduction: 52920 },
    { lower: 660000, rate: 0.35, deduction: 85920 },
    { lower: 960000, rate: 0.45, deduction: 181920 }
  ];

  function defaultLoanContracts() {
    return [];
  }

  function buildRepaymentYears(startDate, targetYears, totalPrincipal) {
    var years = [];
    var start = parseDate(startDate);
    for (var i = 1; i <= targetYears; i++) {
      var yStart = addMonths(start, (i - 1) * 12);
      var yEnd = addMonths(start, i * 12 - 1);
      var targetAnnual = round2(totalPrincipal / targetYears);
      years.push({
        index: i,
        periodLabel: yStart.getFullYear() + "年" + (yStart.getMonth() + 1) + "月-" + yEnd.getFullYear() + "年" + (yEnd.getMonth() + 1) + "月",
        targetAnnual: targetAnnual,
        targetCumulative: round2(totalPrincipal * i / targetYears),
        actualPayments: [],
        annualInterest: null,
        note: ""
      });
    }
    return years;
  }

  function defaultState() {
    var contracts = defaultLoanContracts();
    var totalPrincipal = sum(contracts, function (c) { return c.principal; });
    return {
      expenses: [],
      categories: DEFAULT_CATEGORIES.slice(),

      loanContracts: contracts,
      repaymentPlan: {
        startDate: "2026-08-01",
        targetYears: 6,
        years: buildRepaymentYears("2026-08-01", 6, totalPrincipal)
      },
      reserveFund: { transactions: [] },
      emergencyFund: { transactions: [] },
      interestReserveFund: { transactions: [] },
      interestPayments: [],

      goals: [],

      salaryRecords: [],

      nickname: "",
      firstUseDate: todayStr(),

      cashFlowParams: {
        baseSalary: 0,
        transportPerDay: 0,
        transportDays: 20,
        insuranceRate: 0.102,
        housingFundRate: 0.05,
        housingFundStartDate: todayStr(),
        taxBaseDeduction: 5000,
        pensionMonthly: 0,
        pensionStartDate: todayStr(),
        lifeExpenseCommute: 0,
        lifeExpenseFood: 0,
        lifeExpenseFamily: 0,
        lifeExpensePersonal: 0,
        interestReserveMonthly: 200,
        emergencyFundMonthly: 1000,
        emergencyFundTarget: 0,
        investMonthlyBeforeTarget: 0,
        investMonthlyAfterTarget: 0,
        reserveMonthlyOverride: null
      },

      keyDates: [
        { id: uid(), name: "贴息截止日", type: "once", date: "2026-08-31", note: "此日期后（9月1日起）借款人开始自付利息；毕业当年8月15日前申请、8月20日前还清全部本金可免除后续全部利息。" },
        { id: uid(), name: "强制还息日", type: "annual", month: 12, day: 20, note: "按合同利率与当期剩余本金计算，需在国开行学生在线系统查询实际账单并按时缴纳，与\"还款储备\"是两笔不同的钱。最后一年（2032年）为9月20日。" },
        { id: uid(), name: "贷款利率调整日", type: "annual", month: 12, day: 21, note: "按LPR5Y-0.7%重新公布，如利率调整，请到\"还款\"页更新对应合同的利率。" }
      ]
    };
  }

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var base = defaultState();
      var defaultParams = base.cashFlowParams;
      var merged = Object.assign(base, parsed);
      merged.cashFlowParams = Object.assign({}, defaultParams, parsed.cashFlowParams || {});
      return merged;
    } catch (e) {
      console.error("加载数据失败", e);
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* ---------------- Utils ---------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function money(n) {
    n = Number(n) || 0;
    return "¥" + n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function todayStr() {
    return fmtDate(new Date());
  }

  function fmtDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function parseDate(s) {
    var parts = s.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2] || 1);
  }

  function addMonths(d, n) {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
  }

  function addDays(d, n) {
    var r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() + n);
    return r;
  }

  function startOfWeekMonday(d) {
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    return addDays(d, diff);
  }

  function monthsBetween(d1, d2) {
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  }

  function daysSinceFirstUse() {
    var start = parseDate(state.firstUseDate || todayStr());
    var days = Math.round((stripTime(new Date()) - stripTime(start)) / 86400000) + 1;
    return Math.max(1, days);
  }

  var GREETING_PHRASES = [
    "这是你坚持攒钱的第 {d} 天，继续加油！",
    "第 {d} 天啦，钱包正在悄悄变厚～",
    "已经攒了 {d} 天，稳稳的幸福感～",
    "第 {d} 天，每一笔都算数。",
    "攒钱第 {d} 天，未来的你会感谢现在的你。"
  ];

  function renderGreeting() {
    var hour = new Date().getHours();
    var timeGreet = hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
    var name = state.nickname ? "，" + escapeHtml(state.nickname) : "";
    var days = daysSinceFirstUse();
    var phrase = GREETING_PHRASES[days % GREETING_PHRASES.length].replace("{d}", days);
    return '<div class="greeting-banner">' +
      '<div class="greeting-title">' + timeGreet + name + ' 👋</div>' +
      '<div class="greeting-sub">' + phrase + '</div>' +
      '</div>';
  }

  /* ---------------- Loan maturity / cash-out glide ---------------- */
  function loanDueYear(c) {
    return c.dueDate ? parseDate(c.dueDate).getFullYear() : null;
  }

  function loanGlideStatus(c, now) {
    now = now || new Date();
    if (c.payoff) return { status: "paid" };
    var dueYear = loanDueYear(c);
    if (!dueYear) return { status: "unknown" };
    var startYear = dueYear - 3;
    var y = now.getFullYear();
    if (y >= dueYear) return { status: "due", dueYear: dueYear, startYear: startYear };
    if (y < startYear) return { status: "pending", dueYear: dueYear, startYear: startYear, yearsToStart: startYear - y };
    var yearIndex = Math.min(3, y - startYear + 1);
    return { status: "glide", dueYear: dueYear, startYear: startYear, yearIndex: yearIndex };
  }

  /* ---------------- Expense category colors ---------------- */
  // Assigned by each category's stable position in state.categories, cycling
  // through the validated 8-hue categorical set; anything past slot 8 (by
  // default that's "其他") falls back to neutral gray, per the "Other" rule.
  var CATEGORY_TAG_COLORS = [
    { bg: "#dbeafe", text: "#1e40af" },
    { bg: "#ffe4d5", text: "#c2410c" },
    { bg: "#d1fae5", text: "#047857" },
    { bg: "#fef3c7", text: "#92400e" },
    { bg: "#fce7f3", text: "#be185d" },
    { bg: "#dcfce7", text: "#15803d" },
    { bg: "#ede9fe", text: "#5b21b6" },
    { bg: "#fee2e2", text: "#b91c1c" }
  ];
  var CATEGORY_NEUTRAL = { bg: "#eef2f2", text: "#52514e" };

  function categoryColor(name) {
    var idx = state.categories.indexOf(name);
    if (idx < 0 || idx >= CATEGORY_TAG_COLORS.length) return CATEGORY_NEUTRAL;
    return CATEGORY_TAG_COLORS[idx];
  }

  /* ---------------- Allocation visualization ---------------- */
  var ALLOC_BUCKETS = [
    { key: "life", label: "生活开销", emoji: "🍜", color: "var(--c-life)" },
    { key: "pension", label: "养老金", emoji: "🧓", color: "var(--c-pension)" },
    { key: "interest", label: "利息储备", emoji: "🏦", color: "var(--c-interest)" },
    { key: "emergency", label: "应急金", emoji: "🚨", color: "var(--c-emergency)" },
    { key: "invest", label: "定投", emoji: "📈", color: "var(--c-invest)" }
  ];

  function renderAllocationBar(cf) {
    var amounts = { life: cf.lifeExpense, pension: cf.pension, interest: cf.interestReserveSplit, emergency: cf.emergencyContribution, invest: cf.investContribution };
    var total = Math.max(1, cf.netPay);
    var barHtml = '<div class="alloc-bar">';
    ALLOC_BUCKETS.forEach(function (b) {
      var pct = Math.max(0, (amounts[b.key] / total) * 100);
      if (pct <= 0) return;
      barHtml += '<div class="alloc-seg" style="width:' + pct + '%;background:' + b.color + '"></div>';
    });
    if (cf.buffer > 0) {
      barHtml += '<div class="alloc-seg alloc-seg-buffer" style="width:' + Math.max(0, (cf.buffer / total) * 100) + '%"></div>';
    }
    barHtml += '</div>';

    var legendHtml = '<div class="alloc-legend">';
    ALLOC_BUCKETS.forEach(function (b) {
      legendHtml += '<div class="alloc-legend-item"><span class="alloc-dot" style="background:' + b.color + '"></span>' + b.emoji + ' ' + b.label + ' ' + money(amounts[b.key]) + '</div>';
    });
    if (cf.buffer > 0) {
      legendHtml += '<div class="alloc-legend-item"><span class="alloc-dot alloc-dot-buffer"></span>💤 零钱缓冲 ' + money(cf.buffer) + '</div>';
    }
    legendHtml += '</div>';
    return barHtml + legendHtml;
  }

  /* ---------------- Home spending calendar ---------------- */
  var homeCalView = "month"; // "week" | "month" | "year"
  var homeCalAnchor = new Date();

  function expensesTotalForDate(dateStr) {
    return sum(state.expenses.filter(function (x) { return x.date === dateStr; }), function (x) { return x.amount; });
  }

  function expensesTotalForMonth(mKey) {
    return sum(state.expenses.filter(function (x) { return monthKey(x.date) === mKey; }), function (x) { return x.amount; });
  }

  function renderHomeCalendarCard() {
    var html = '<div class="card calendar-card">';
    html += '<div class="cal-header">';
    html += '<h3 style="margin:0;">📅 收支日历</h3>';
    html += '<div class="cal-view-switch">';
    [["week", "周"], ["month", "月"], ["year", "年"]].forEach(function (v) {
      html += '<button class="cal-view-btn' + (homeCalView === v[0] ? ' active' : '') + '" data-cal-view="' + v[0] + '">' + v[1] + '</button>';
    });
    html += '</div>';
    html += '</div>';

    var periodLabel = "";
    var now = new Date();

    if (homeCalView === "week") {
      var monday = startOfWeekMonday(homeCalAnchor);
      var sunday = addDays(monday, 6);
      periodLabel = (monday.getMonth() + 1) + "月" + monday.getDate() + "日 - " + (sunday.getMonth() + 1) + "月" + sunday.getDate() + "日";
      var days = [];
      for (var i = 0; i < 7; i++) days.push(addDays(monday, i));
      var amounts = days.map(function (d) { return expensesTotalForDate(fmtDate(d)); });
      var maxAmt = Math.max.apply(null, amounts.concat([0.01]));
      var weekLabels = ["一", "二", "三", "四", "五", "六", "日"];
      html += '<div class="cal-nav"><button data-cal-nav="-1">&lsaquo;</button><span class="cal-period-label">' + periodLabel + '</span><button data-cal-nav="1">&rsaquo;</button></div>';
      html += '<div class="cal-bars">';
      days.forEach(function (d, idx) {
        var dateStr = fmtDate(d);
        var amt = amounts[idx];
        var isToday = dateStr === todayStr();
        var pct = Math.max(2, (amt / maxAmt) * 100);
        html += '<div class="cal-bar-col" data-cal-day="' + dateStr + '">';
        html += '<div class="cal-bar-amt">' + (amt > 0 ? Math.round(amt) : "") + '</div>';
        html += '<div class="cal-bar' + (amt > 0 ? ' has-spend' : '') + (isToday ? ' is-today' : '') + '" style="height:' + pct + '%"></div>';
        html += '<div class="cal-bar-label' + (isToday ? ' is-today' : '') + '">周' + weekLabels[idx] + '</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="sub-number" style="text-align:center;">本周合计 ' + money(sum(amounts, function (a) { return a; })) + '</div>';
    } else if (homeCalView === "year") {
      var y = homeCalAnchor.getFullYear();
      periodLabel = y + "年";
      var monthAmts = [];
      for (var m = 0; m < 12; m++) monthAmts.push(expensesTotalForMonth(y + "-" + String(m + 1).padStart(2, "0")));
      var maxMonthAmt = Math.max.apply(null, monthAmts.concat([0.01]));
      html += '<div class="cal-nav"><button data-cal-nav="-1">&lsaquo;</button><span class="cal-period-label">' + periodLabel + '</span><button data-cal-nav="1">&rsaquo;</button></div>';
      html += '<div class="cal-bars cal-bars-year">';
      monthAmts.forEach(function (amt, idx) {
        var mKeyStr = y + "-" + String(idx + 1).padStart(2, "0");
        var isCurrent = mKeyStr === monthKey(todayStr());
        var pct = Math.max(2, (amt / maxMonthAmt) * 100);
        html += '<div class="cal-bar-col" data-cal-month="' + mKeyStr + '">';
        html += '<div class="cal-bar-amt">' + (amt > 0 ? Math.round(amt) : "") + '</div>';
        html += '<div class="cal-bar' + (amt > 0 ? ' has-spend' : '') + (isCurrent ? ' is-today' : '') + '" style="height:' + pct + '%"></div>';
        html += '<div class="cal-bar-label' + (isCurrent ? ' is-today' : '') + '">' + (idx + 1) + '月</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="sub-number" style="text-align:center;">' + y + '年合计 ' + money(sum(monthAmts, function (a) { return a; })) + '</div>';
    } else {
      var vy = homeCalAnchor.getFullYear();
      var vm = homeCalAnchor.getMonth();
      periodLabel = vy + "年" + (vm + 1) + "月";
      var firstDay = new Date(vy, vm, 1);
      var leading = (firstDay.getDay() + 6) % 7; // 0=Mon
      var daysInMonthCount = new Date(vy, vm + 1, 0).getDate();
      var dayAmts = [];
      for (var d2 = 1; d2 <= daysInMonthCount; d2++) dayAmts.push(expensesTotalForDate(fmtDate(new Date(vy, vm, d2))));
      var maxDayAmt = Math.max.apply(null, dayAmts.concat([0.01]));
      var monthTotal = sum(dayAmts, function (a) { return a; });
      html += '<div class="cal-nav"><button data-cal-nav="-1">&lsaquo;</button><span class="cal-period-label">' + periodLabel + '</span><button data-cal-nav="1">&rsaquo;</button></div>';
      html += '<div class="sub-number" style="text-align:center;margin-bottom:6px;">本月合计 ' + money(monthTotal) + '</div>';
      html += '<div class="cal-grid">';
      ["一", "二", "三", "四", "五", "六", "日"].forEach(function (w) { html += '<div class="cal-weekday">' + w + '</div>'; });
      for (var e = 0; e < leading; e++) html += '<div class="cal-day empty"></div>';
      for (var d3 = 1; d3 <= daysInMonthCount; d3++) {
        var dStr = fmtDate(new Date(vy, vm, d3));
        var dAmt = dayAmts[d3 - 1];
        var dIsToday = dStr === todayStr();
        var alpha = dAmt > 0 ? 0.14 + 0.5 * (dAmt / maxDayAmt) : 0;
        var bgStyle = dAmt > 0 ? "background:rgba(13,148,136," + alpha.toFixed(2) + ");" : "";
        html += '<div class="cal-day' + (dIsToday ? ' is-today' : '') + '" data-cal-day="' + dStr + '" style="' + bgStyle + '">';
        html += '<span>' + d3 + '</span>';
        if (dAmt > 0) html += '<span class="cal-day-amt">' + Math.round(dAmt) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function openInfoModal(title, bodyHtml) {
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="modal-overlay center" id="modalOverlay">' +
      '<div class="modal">' +
      '<div class="modal-header"><h3>' + escapeHtml(title) + '</h3><button type="button" class="modal-close" id="modalCloseBtn">&times;</button></div>' +
      bodyHtml +
      '</div>' +
      '</div>';
    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", function (e) {
      if (e.target.id === "modalOverlay") closeModal();
    });
  }

  function openDayDetailModal(dateStr) {
    var list = state.expenses.filter(function (x) { return x.date === dateStr; });
    var total = sum(list, function (x) { return x.amount; });
    var d = parseDate(dateStr);
    var title = d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";

    var body = '<div class="big-number" style="font-size:24px;">' + money(total) + '</div>';
    if (!list.length) {
      body += '<div class="empty-state">这天没有开销记录</div>';
    } else {
      var byCat = {};
      list.forEach(function (x) { byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount); });
      var catKeys = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
      var maxCat = catKeys.length ? byCat[catKeys[0]] : 0;

      body += '<div style="margin-top:10px;">';
      catKeys.forEach(function (c) {
        var pct = maxCat > 0 ? (byCat[c] / maxCat) * 100 : 0;
        var sharePct = total > 0 ? Math.round((byCat[c] / total) * 100) : 0;
        var cColor = categoryColor(c);
        body += '<div class="bar-row"><span class="bar-label">' + escapeHtml(c) + '</span><span class="bar-track"><span class="bar-fill" style="width:' + pct + '%;background:' + cColor.text + ';"></span><span class="bar-pct">' + sharePct + '%</span></span><span class="bar-amount">' + money(byCat[c]) + '</span></div>';
      });
      body += '</div>';

      body += '<div class="history-list" style="margin-top:14px;">';
      list.slice().sort(function (a, b) { return b.id.localeCompare(a.id); }).forEach(function (x) {
        var xColor = categoryColor(x.category);
        body += '<div class="expense-item" data-day-exp-id="' + x.id + '" style="cursor:pointer;">';
        body += '<div class="exp-main"><span><span class="cat-tag" style="background:' + xColor.bg + ';color:' + xColor.text + ';">' + escapeHtml(x.category) + '</span></span>';
        if (x.note) body += '<span class="exp-note">' + escapeHtml(x.note) + '</span>';
        body += '</div>';
        body += '<span class="exp-amount">' + money(x.amount) + '</span>';
        body += '</div>';
      });
      body += '</div>';
    }

    openInfoModal(title, body);
    document.querySelectorAll("[data-day-exp-id]").forEach(function (row) {
      row.addEventListener("click", function () {
        var exp = state.expenses.find(function (x) { return x.id === row.dataset.dayExpId; });
        if (exp) { closeModal(); openExpenseModal(exp); }
      });
    });
  }

  function monthKey(dateStr) {
    return dateStr.slice(0, 7);
  }

  function monthLabel(key) {
    var parts = key.split("-");
    return parts[0] + "年" + parseInt(parts[1], 10) + "月";
  }

  function shiftMonth(key, delta) {
    var parts = key.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1 + delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function sum(arr, fn) {
    return arr.reduce(function (acc, x) { return acc + (Number(fn(x)) || 0); }, 0);
  }

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function toast(msg) {
    var root = document.getElementById("toastRoot");
    var node = el('<div class="toast">' + escapeHtml(msg) + "</div>");
    root.appendChild(node);
    setTimeout(function () {
      node.remove();
    }, 1800);
  }

  function confirmAction(msg) {
    return window.confirm(msg);
  }

  function totalLoanPrincipal() {
    return sum(state.loanContracts, function (c) { return c.principal; });
  }

  /* ---------------- Payslip photos (IndexedDB) ---------------- */
  var payslipCache = null;

  function openFilesDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open("ledgerAppFilesV1", 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore("payslips", { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function savePayslip(record) {
    return openFilesDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("payslips", "readwrite");
        tx.objectStore("payslips").put(record);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function deletePayslip(id) {
    return openFilesDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("payslips", "readwrite");
        tx.objectStore("payslips").delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function getAllPayslips() {
    return openFilesDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("payslips", "readonly");
        var req = tx.objectStore("payslips").getAll();
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function ensurePayslipCache(onFreshLoad) {
    // onFreshLoad fires only the first time the cache is populated, never on
    // subsequent calls once it's warm — callers use it to trigger a one-off re-render.
    if (payslipCache) return;
    getAllPayslips().then(function (list) {
      payslipCache = {};
      list.forEach(function (p) { payslipCache[p.id] = p.dataUrl; });
      onFreshLoad();
    }).catch(function () {
      payslipCache = {};
      onFreshLoad();
    });
  }

  function compressImageToDataUrl(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = function () { reject(new Error("图片加载失败")); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  function openImageLightbox(dataUrl) {
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="modal-overlay center" id="modalOverlay">' +
      '<div class="modal" style="padding:10px;max-height:90vh;">' +
      '<div class="modal-header"><h3>工资条</h3><button type="button" class="modal-close" id="modalCloseBtn">&times;</button></div>' +
      '<img src="' + dataUrl + '" style="width:100%;border-radius:10px;display:block;">' +
      "</div>" +
      "</div>";
    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", function (e) {
      if (e.target.id === "modalOverlay") closeModal();
    });
  }

  /* ---------------- Tax / cash-flow engine ---------------- */
  function findBracket(cumulativeTaxable) {
    var picked = TAX_BRACKETS[0];
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      if (cumulativeTaxable >= TAX_BRACKETS[i].lower) picked = TAX_BRACKETS[i];
    }
    return picked;
  }

  function interestReserveBalance() {
    return sum(state.interestReserveFund.transactions, function (t) { return t.type === "deposit" ? t.amount : -t.amount; });
  }

  function autoInvestGoals() {
    return state.goals.filter(function (g) { return Number(g.autoInvestWeight) > 0; });
  }

  function autoInvestTotalBalance() {
    return sum(autoInvestGoals(), function (g) { return goalCurrentAmount(g); });
  }

  // Splits one month's net pay into the five buckets from the repayment/investment
  // plan: ①生活开销 ②养老金 ③贷款利息储备 ④应急金(直到攒够目标自动停) ⑤定投(两档金额).
  // emergBalance is the emergency fund balance *before* this month's contribution —
  // callers pass the current live balance; the projected series below reuses that
  // same snapshot for every future month rather than simulating month-by-month
  // growth, which is a deliberate simplification (see getCashFlowSeries).
  function splitFromNetPay(netPay, d, params, emergBalance) {
    var pStart = parseDate(params.pensionStartDate);
    var pension = d >= new Date(pStart.getFullYear(), pStart.getMonth(), 1) ? Number(params.pensionMonthly) : 0;
    var lifeExpense = Number(params.lifeExpenseCommute) + Number(params.lifeExpenseFood) + Number(params.lifeExpenseFamily) + Number(params.lifeExpensePersonal);
    var surplus = round2(netPay - pension - lifeExpense);

    var interestReserveSplit = round2(Math.max(0, Math.min(surplus, Number(params.interestReserveMonthly))));
    var afterInterest = round2(surplus - interestReserveSplit);

    var emergencyTarget = Number(params.emergencyFundTarget) || 0;
    var balanceBefore = Number(emergBalance) || 0;
    var emergencyCap = Number(params.emergencyFundMonthly);
    if (emergencyTarget > 0) emergencyCap = Math.min(emergencyCap, Math.max(0, emergencyTarget - balanceBefore));
    var emergencyContribution = round2(Math.max(0, Math.min(afterInterest, emergencyCap)));
    var emergencyMaxed = emergencyTarget > 0 && (balanceBefore + emergencyContribution) >= emergencyTarget;
    var afterEmergency = round2(afterInterest - emergencyContribution);

    var investTarget = emergencyMaxed ? Number(params.investMonthlyAfterTarget) : Number(params.investMonthlyBeforeTarget);
    var investContribution = round2(Math.max(0, Math.min(afterEmergency, investTarget)));
    var buffer = round2(afterEmergency - investContribution);

    return {
      pension: pension, lifeExpense: lifeExpense, surplus: surplus,
      interestReserveSplit: interestReserveSplit,
      emergencyContribution: emergencyContribution, emergencyMaxed: emergencyMaxed,
      investContribution: investContribution, buffer: buffer
    };
  }

  function computeMonthRow(d, cum, params) {
    var taxableIncome = Number(params.baseSalary) + Number(params.transportPerDay) * Number(params.transportDays);
    var insurance = round2(taxableIncome * params.insuranceRate);
    var hfStart = parseDate(params.housingFundStartDate);
    var housingFund = d >= new Date(hfStart.getFullYear(), hfStart.getMonth(), 1) ? round2(taxableIncome * params.housingFundRate) : 0;

    cum.income += taxableIncome;
    cum.baseDeduction += Number(params.taxBaseDeduction);
    var pStartForDeduction = parseDate(params.pensionStartDate);
    var pensionDeduction = d >= new Date(pStartForDeduction.getFullYear(), pStartForDeduction.getMonth(), 1) ? Number(params.pensionMonthly) : 0;
    cum.specialDeduction += insurance + housingFund + pensionDeduction;

    var cumTaxable = Math.max(0, cum.income - cum.baseDeduction - cum.specialDeduction);
    var bracket = findBracket(cumTaxable);
    var cumTaxPayable = cumTaxable * bracket.rate - bracket.deduction;
    var monthTax = round2(cumTaxPayable - cum.taxWithheld);
    if (monthTax < 0) monthTax = 0;
    cum.taxWithheld += monthTax;

    var netPay = round2(taxableIncome - insurance - housingFund - monthTax);
    var split = splitFromNetPay(netPay, d, params, cum.emergBalance);

    return Object.assign({
      date: d,
      monthLabel: d.getFullYear() + "年" + (d.getMonth() + 1) + "月",
      taxableIncome: taxableIncome,
      insurance: insurance,
      housingFund: housingFund,
      monthTax: monthTax,
      netPay: netPay,
      confirmed: false
    }, split);
  }

  // Projects a series of months. The emergency-fund balance used to decide when
  // buckets ④/⑤ switch phase is snapshotted once (today's real balance) and held
  // constant across every projected month — it does not simulate incremental
  // top-ups month by month — so a projection spanning the actual crossover month
  // will show the "before" split slightly later than it happens in reality. Good
  // enough for a rough look-ahead; the confirmed/current month always uses the
  // live balance via currentMonthCashFlow.
  function getCashFlowSeries(startDate, count) {
    var rows = [];
    var cum = null;
    var year = null;
    var params = state.cashFlowParams;
    var emergBalance = emergencyBalance();
    for (var i = 0; i < count; i++) {
      var d = addMonths(startDate, i);
      if (d.getFullYear() !== year) {
        year = d.getFullYear();
        cum = { income: 0, baseDeduction: 0, specialDeduction: 0, taxWithheld: 0, emergBalance: emergBalance };
      }
      var row = computeMonthRow(d, cum, params);
      var rec = getConfirmedSalary(monthKey(fmtDate(d)));
      if (rec) {
        var split = splitFromNetPay(rec.actualNetPay, d, params, emergBalance);
        row = Object.assign({}, row, split, { netPay: rec.actualNetPay, confirmed: true });
      }
      rows.push(row);
    }
    return rows;
  }

  function getConfirmedSalary(mKey) {
    return state.salaryRecords.find(function (r) { return r.month === mKey; });
  }

  function openConfirmSalaryModal(mKeyOverride) {
    var mKey = mKeyOverride || monthKey(todayStr());
    var existing = getConfirmedSalary(mKey);
    openFormModal({
      title: (mKey === monthKey(todayStr()) ? "确认本月工资" : "确认/补录工资") + " · " + monthLabel(mKey),
      fields: [
        { key: "actualNetPay", label: "本月实发工资（工资条上的实发数额）", type: "number", value: existing ? existing.actualNetPay : "" },
        { key: "note", label: "备注（可选）", type: "text", value: existing ? existing.note : "" },
        { key: "payslipPhoto", label: existing && existing.payslipId ? "工资条截图（已上传，选新的可替换）" : "工资条截图（可选）", type: "file" }
      ],
      submitLabel: "保存",
      showDelete: !!existing,
      onDelete: function () {
        state.salaryRecords = state.salaryRecords.filter(function (r) { return r.month !== mKey; });
        saveState();
        if (existing && existing.payslipId) {
          deletePayslip(existing.payslipId).catch(function () {});
          payslipCache = null;
        }
        closeModal();
        render();
        toast("已删除，改回按测算值显示");
      },
      onSubmit: function (v) {
        var amount = parseFloat(v.actualNetPay);
        if (isNaN(amount) || amount <= 0) { toast("请填写正确的实发工资"); return; }
        var photoFile = v.payslipPhoto;
        var savePhoto = (photoFile && photoFile.size > 0)
          ? compressImageToDataUrl(photoFile, 1280, 0.72)
          : Promise.resolve(null);
        savePhoto.then(function (dataUrl) {
          var payslipId = existing ? existing.payslipId : null;
          if (dataUrl) {
            payslipId = payslipId || uid();
            return savePayslip({ id: payslipId, month: mKey, dataUrl: dataUrl, createdAt: todayStr() }).then(function () {
              payslipCache = null;
              return payslipId;
            });
          }
          return payslipId;
        }).then(function (payslipId) {
          if (existing) {
            existing.actualNetPay = amount;
            existing.note = v.note;
            if (payslipId) existing.payslipId = payslipId;
          } else {
            state.salaryRecords.push({ id: uid(), month: mKey, actualNetPay: amount, note: v.note, payslipId: payslipId });
          }
          saveState();
          closeModal();
          render();
          toast("已确认本月工资");
        }).catch(function () {
          toast("工资条图片保存失败，请重试");
        });
      }
    });
  }

  function currentMonthCashFlow() {
    var now = new Date();
    var yearStart = new Date(now.getFullYear(), 0, 1);
    var monthsSinceYearStart = now.getMonth();
    var series = getCashFlowSeries(yearStart, monthsSinceYearStart + 1);
    return series[series.length - 1];
  }

  /* ---------------- Modal (generic form) ---------------- */
  function closeModal() {
    document.getElementById("modalRoot").innerHTML = "";
  }

  function renderField(f) {
    var val = f.value == null ? "" : f.value;
    var label = '<label>' + escapeHtml(f.label) + "</label>";
    if (f.type === "select") {
      var opts = f.options.map(function (o) {
        var optVal = typeof o === "object" ? o.value : o;
        var optLabel = typeof o === "object" ? o.label : o;
        var sel = String(optVal) === String(val) ? " selected" : "";
        return '<option value="' + escapeHtml(optVal) + '"' + sel + ">" + escapeHtml(optLabel) + "</option>";
      }).join("");
      return '<div class="form-field">' + label + '<select name="' + f.key + '">' + opts + "</select></div>";
    }
    if (f.type === "textarea") {
      return '<div class="form-field">' + label + '<textarea name="' + f.key + '" placeholder="' + escapeHtml(f.placeholder || "") + '">' + escapeHtml(val) + "</textarea></div>";
    }
    if (f.type === "file") {
      return '<div class="form-field">' + label + '<input type="file" name="' + f.key + '" accept="image/*">' + (f.hint ? '<div class="sub-number">' + escapeHtml(f.hint) + "</div>" : "") + "</div>";
    }
    var type = f.type || "text";
    var step = type === "number" ? ' step="0.01" inputmode="decimal"' : "";
    return '<div class="form-field">' + label + '<input type="' + type + '" name="' + f.key + '" value="' + escapeHtml(val) + '" placeholder="' + escapeHtml(f.placeholder || "") + '"' + step + "></div>";
  }

  function openFormModal(opts) {
    var root = document.getElementById("modalRoot");
    var fieldsHtml = opts.fields.map(renderField).join("");
    var deleteBtn = opts.showDelete ? '<button type="button" class="btn btn-danger" id="modalDeleteBtn">删除</button>' : "";
    root.innerHTML =
      '<div class="modal-overlay" id="modalOverlay">' +
      '<div class="modal">' +
      '<div class="modal-header"><h3>' + escapeHtml(opts.title) + '</h3><button type="button" class="modal-close" id="modalCloseBtn">&times;</button></div>' +
      '<form id="modalForm">' +
      fieldsHtml +
      (opts.extraHtml || "") +
      '<div class="form-actions">' +
      deleteBtn +
      '<button type="submit" class="btn btn-primary">' + escapeHtml(opts.submitLabel || "保存") + "</button>" +
      "</div>" +
      "</form>" +
      "</div>" +
      "</div>";

    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", function (e) {
      if (e.target.id === "modalOverlay") closeModal();
    });
    if (opts.afterMount) opts.afterMount(root);

    document.getElementById("modalForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var values = {};
      opts.fields.forEach(function (f) {
        values[f.key] = fd.get(f.key);
      });
      opts.onSubmit(values);
    });

    if (opts.showDelete) {
      document.getElementById("modalDeleteBtn").addEventListener("click", function () {
        if (confirmAction("确定要删除吗？此操作无法撤销。")) {
          opts.onDelete();
        }
      });
    }
  }

  /* ---------------- Router ---------------- */
  var currentPage = "home";
  var expenseMonth = monthKey(todayStr());

  var PAGES = {
    home: { title: "首页", render: renderHome },
    expenses: { title: "记账", render: renderExpenses },
    loans: { title: "还款计划", render: renderLoans },
    goals: { title: "理财计划", render: renderGoals },
    more: { title: "更多", render: renderMore }
  };

  function navigate(page) {
    currentPage = page;
    document.getElementById("pageTitle").textContent = PAGES[page].title;
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
    document.getElementById("content").scrollTop = 0;
    render();
  }

  function render() {
    var content = document.getElementById("content");
    content.innerHTML = PAGES[currentPage].render();
    attachPageHandlers(currentPage);
  }

  /* ---------------- Key dates ---------------- */
  function nextOccurrence(kd, from) {
    if (kd.type === "once") {
      return parseDate(kd.date);
    }
    var y = from.getFullYear();
    var candidate = new Date(y, kd.month - 1, kd.day);
    if (candidate < stripTime(from)) candidate = new Date(y + 1, kd.month - 1, kd.day);
    return candidate;
  }

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysUntil(target, from) {
    var ms = stripTime(target) - stripTime(from);
    return Math.round(ms / 86400000);
  }

  function upcomingKeyDates() {
    var now = new Date();
    return state.keyDates.map(function (kd) {
      var next = nextOccurrence(kd, now);
      return { kd: kd, next: next, days: daysUntil(next, now) };
    }).filter(function (x) { return x.days >= 0 || state_dummy(); })
      .sort(function (a, b) { return a.days - b.days; });
  }
  function state_dummy() { return false; }

  function exportKeyDatesIcs() {
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LedgerApp//RepaymentPlan//CN", "CALSCALE:GREGORIAN"];
    state.keyDates.forEach(function (kd) {
      var next = nextOccurrence(kd, new Date());
      var dstr = fmtDate(next).replace(/-/g, "");
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + kd.id + "@ledgerapp");
      lines.push("DTSTART;VALUE=DATE:" + dstr);
      lines.push("SUMMARY:" + icsEscape(kd.name));
      lines.push("DESCRIPTION:" + icsEscape(kd.note || ""));
      if (kd.type === "annual") lines.push("RRULE:FREQ=YEARLY");
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push("DESCRIPTION:" + icsEscape(kd.name));
      lines.push("TRIGGER:-P1D");
      lines.push("END:VALARM");
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    var blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8;" });
    downloadBlob(blob, "还款关键日期提醒.ics");
    toast("已导出日历文件，导入手机日历App即可获得到点提醒");
  }

  function icsEscape(s) {
    return String(s || "").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  }

  /* ---------------- Home ---------------- */
  function renderHome() {
    var mKey = monthKey(todayStr());
    var monthExpenses = state.expenses.filter(function (x) { return monthKey(x.date) === mKey; });
    var actualSpend = sum(monthExpenses, function (x) { return x.amount; });

    var cf = currentMonthCashFlow();
    var emergBal = emergencyBalance();
    var emergTarget = Number(state.cashFlowParams.emergencyFundTarget) || 0;

    var upcoming = upcomingKeyDates().slice(0, 3);

    var unpaidLoans = state.loanContracts.filter(function (c) { return !c.payoff; });
    var nextDue = unpaidLoans.slice().sort(function (a, b) { return (a.dueDate || "").localeCompare(b.dueDate || ""); })[0];

    var html = "";

    html += renderGreeting();
    html += renderHomeCalendarCard();

    html += '<div class="card">';
    html += '<h3>📅 关键日期</h3>';
    if (!upcoming.length) {
      html += '<div class="empty-state">暂无提醒</div>';
    }
    upcoming.forEach(function (u) {
      html += '<div class="row"><span>' + escapeHtml(u.kd.name) + ' · ' + fmtDate(u.next) + '</span><span style="font-weight:600;color:' + (u.days <= 14 ? "var(--danger)" : "var(--teal-dark)") + ';">' + (u.days === 0 ? "今天" : u.days + " 天后") + '</span></div>';
    });
    html += '<div class="row" style="margin-top:10px;"><button class="btn btn-outline btn-sm btn-block" id="exportIcsBtn">导出到手机日历（可靠提醒）</button></div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>🏁 贷款到期速览</h3>';
    if (!state.loanContracts.length) {
      html += '<div class="empty-state">暂无贷款合同</div>';
    } else if (!unpaidLoans.length) {
      html += '<div class="sub-number">🎉 全部 ' + state.loanContracts.length + ' 笔贷款已结清</div>';
    } else {
      html += '<div class="sub-number">已结清 ' + (state.loanContracts.length - unpaidLoans.length) + ' / ' + state.loanContracts.length + ' 笔 · 剩余本金 ' + money(sum(unpaidLoans, function (c) { return c.principal; })) + '</div>';
      if (nextDue) {
        var g = loanGlideStatus(nextDue);
        html += '<div class="row"><span>最近到期：' + escapeHtml(nextDue.term) + '</span><span style="font-weight:600;">' + nextDue.dueDate + '</span></div>';
        if (g.status === "glide") html += '<div class="sub-number">转现金计划进行中（第 ' + g.yearIndex + '/3 年），详情见"还款"页</div>';
        else if (g.status === "pending") html += '<div class="sub-number">' + g.yearsToStart + ' 年后启动转现金计划，详情见"还款"页</div>';
        else if (g.status === "due") html += '<div class="sub-number" style="color:var(--danger);font-weight:600;">已到期，请尽快结清</div>';
      }
    }
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>💵 本月现金流（' + cf.monthLabel + (cf.confirmed ? '，已确认' : '，测算值') + '）</h3>';
    html += '<div class="row"><span>到手工资</span><span class="big-number" style="font-size:18px;">' + money(cf.netPay) + '</span></div>';
    html += renderAllocationBar(cf);
    if (!cf.confirmed) html += '<div class="sub-number">测算值，实际以工资条为准，去"理财"页点"确认工资"</div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>🏦 资金总览</h3>';
    html += '<div class="row"><span>🏦 贷款利息储备</span><span style="font-weight:600;">' + money(interestReserveBalance()) + '</span></div>';
    html += '<div class="row"><span>🚨 应急金' + (emergTarget > 0 ? '（' + Math.min(100, Math.round(emergBal / emergTarget * 100)) + '%）' : '') + '</span><span style="font-weight:600;">' + money(emergBal) + '</span></div>';
    html += '<div class="row"><span>📈 定投合计</span><span style="font-weight:600;">' + money(autoInvestTotalBalance()) + '</span></div>';
    html += '<div class="row"><span>🍜 本月开销 / 预算</span><span style="font-weight:600;' + (actualSpend > cf.lifeExpense ? "color:var(--danger);" : "") + '">' + money(actualSpend) + ' / ' + money(cf.lifeExpense) + '</span></div>';
    html += '</div>';

    html += '<div class="row" style="gap:10px;">';
    html += '<button class="btn btn-primary" style="flex:1;" data-quick="expense">+ 记一笔</button>';
    html += '<button class="btn btn-outline" style="flex:1;" data-quick="confirm-salary">确认工资</button>';
    html += '<button class="btn btn-outline" style="flex:1;" data-quick="goal-add">+ 小目标</button>';
    html += '</div>';

    return html;
  }

  /* ---------------- Expenses ---------------- */
  function renderExpenses() {
    var list = state.expenses.filter(function (x) { return monthKey(x.date) === expenseMonth; })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });

    var total = sum(list, function (x) { return x.amount; });

    var byCat = {};
    list.forEach(function (x) { byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount); });
    var catKeys = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var maxCat = catKeys.length ? byCat[catKeys[0]] : 0;

    var html = "";
    html += '<div class="month-switch">';
    html += '<button data-nav-month="-1">&lsaquo;</button>';
    html += '<span class="month-label">' + monthLabel(expenseMonth) + '</span>';
    html += '<button data-nav-month="1">&rsaquo;</button>';
    html += '</div>';

    html += '<div class="card"><h3>本月合计</h3><div class="big-number">' + money(total) + '</div></div>';

    var isCurrentMonth = expenseMonth === monthKey(todayStr());
    var budget = state.cashFlowParams.lifeExpenseCommute + state.cashFlowParams.lifeExpenseFood + state.cashFlowParams.lifeExpenseFamily + state.cashFlowParams.lifeExpensePersonal;
    if (budget > 0) {
      var budgetPct = Math.round((total / budget) * 100);
      var over = total > budget;
      html += '<div class="card">';
      html += '<h3>' + (isCurrentMonth ? '本月开销 vs 预算' : '开销 vs 预算') + '</h3>';
      html += '<div class="progress-track"><div class="progress-fill' + (over ? ' over' : '') + '" style="width:' + Math.min(100, budgetPct) + '%"></div></div>';
      html += '<div class="sub-number" style="' + (over ? 'color:var(--danger);font-weight:600;' : '') + '">已花 ' + money(total) + ' / 预算 ' + money(budget) + '（' + budgetPct + '%）' + (over ? ' · 已超支 ' + money(total - budget) : '') + '</div>';
      if (!isCurrentMonth) html += '<div class="sub-number">按当前设置的预算金额对比，不代表当时的预算</div>';
      html += '</div>';
    }

    if (catKeys.length) {
      html += '<div class="card"><h3>分类占比</h3>';
      catKeys.forEach(function (c) {
        var pct = maxCat > 0 ? (byCat[c] / maxCat) * 100 : 0;
        var sharePct = total > 0 ? Math.round((byCat[c] / total) * 100) : 0;
        var cColor = categoryColor(c);
        html += '<div class="bar-row">';
        html += '<span class="bar-label">' + escapeHtml(c) + '</span>';
        html += '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%;background:' + cColor.text + ';"></span><span class="bar-pct">' + sharePct + '%</span></span>';
        html += '<span class="bar-amount">' + money(byCat[c]) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '<div class="card">';
    html += '<h3>明细</h3>';
    if (!list.length) {
      html += '<div class="empty-state">本月暂无记录</div>';
    } else {
      var lastDate = null;
      list.forEach(function (x) {
        if (x.date !== lastDate) {
          html += '<div class="day-group-label">' + x.date + '</div>';
          lastDate = x.date;
        }
        html += '<div class="expense-item" data-exp-id="' + x.id + '">';
        var xCatColor = categoryColor(x.category);
        html += '<div class="exp-main"><span><span class="cat-tag" style="background:' + xCatColor.bg + ';color:' + xCatColor.text + ';">' + escapeHtml(x.category) + '</span></span>';
        if (x.note) html += '<span class="exp-note">' + escapeHtml(x.note) + '</span>';
        html += '</div>';
        html += '<span class="exp-amount">' + money(x.amount) + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';

    html += '<button class="fab" id="addExpenseFab">+</button>';
    return html;
  }

  function openExpenseModal(existing) {
    var fields = [
      { key: "date", label: "日期", type: "date", value: existing ? existing.date : todayStr() },
      { key: "amount", label: "金额", type: "number", value: existing ? existing.amount : "", placeholder: "0.00" },
      { key: "category", label: "分类", type: "select", options: state.categories, value: existing ? existing.category : state.categories[0] },
      { key: "note", label: "备注（可选）", type: "text", value: existing ? existing.note : "" }
    ];
    openFormModal({
      title: existing ? "编辑开销" : "记一笔开销",
      fields: fields,
      showDelete: !!existing,
      onDelete: function () {
        state.expenses = state.expenses.filter(function (x) { return x.id !== existing.id; });
        saveState();
        closeModal();
        render();
        toast("已删除");
      },
      onSubmit: function (v) {
        var amount = parseFloat(v.amount);
        if (!v.date || isNaN(amount) || amount <= 0) {
          toast("请填写正确的日期和金额");
          return;
        }
        if (existing) {
          existing.date = v.date;
          existing.amount = amount;
          existing.category = v.category;
          existing.note = v.note;
        } else {
          state.expenses.push({ id: uid(), date: v.date, amount: amount, category: v.category, note: v.note });
        }
        saveState();
        expenseMonth = monthKey(v.date);
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  /* ---------------- Loans (contracts + repayment plan + reserve fund) ---------------- */
  function reserveBalance() {
    return sum(state.reserveFund.transactions, function (t) { return t.type === "deposit" ? t.amount : -t.amount; });
  }

  function emergencyBalance() {
    return sum(state.emergencyFund.transactions, function (t) { return t.type === "deposit" ? t.amount : -t.amount; });
  }

  function openEmergencyTxModal(type) {
    var fields = [
      { key: "date", label: "日期", type: "date", value: todayStr() },
      { key: "amount", label: "金额", type: "number", value: type === "deposit" ? round2(state.cashFlowParams.emergencyFundMonthly) : "" },
      { key: "note", label: "备注（可选）", type: "text", value: "" }
    ];
    openFormModal({
      title: type === "deposit" ? "存入应急金" : "应急金支出/调整",
      fields: fields,
      submitLabel: "确认",
      onSubmit: function (v) {
        var amount = parseFloat(v.amount);
        if (!v.date || isNaN(amount) || amount <= 0) {
          toast("请填写正确的日期和金额");
          return;
        }
        state.emergencyFund.transactions.push({ id: uid(), date: v.date, type: type, amount: amount, note: v.note });
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  function openInterestReserveTxModal(type) {
    var fields = [
      { key: "date", label: "日期", type: "date", value: todayStr() },
      { key: "amount", label: "金额", type: "number", value: type === "deposit" ? round2(state.cashFlowParams.interestReserveMonthly) : "" },
      { key: "note", label: "备注（可选）", type: "text", value: "" }
    ];
    openFormModal({
      title: type === "deposit" ? "存入贷款利息储备" : "利息储备支出/调整",
      fields: fields,
      submitLabel: "确认",
      onSubmit: function (v) {
        var amount = parseFloat(v.amount);
        if (!v.date || isNaN(amount) || amount <= 0) {
          toast("请填写正确的日期和金额");
          return;
        }
        state.interestReserveFund.transactions.push({ id: uid(), date: v.date, type: type, amount: amount, note: v.note });
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  function openInterestPaymentModal(existing) {
    openFormModal({
      title: existing ? "编辑利息缴纳记录" : "登记年度利息缴纳",
      fields: [
        { key: "date", label: "缴纳日期", type: "date", value: existing ? existing.date : todayStr() },
        { key: "amount", label: "缴纳金额（来自国开行系统账单）", type: "number", value: existing ? existing.amount : "" },
        { key: "source", label: "资金来源", type: "select", options: [{ value: "reserve", label: "从贷款利息储备余额中扣除" }, { value: "other", label: "其他资金来源（不扣储备）" }], value: "reserve" },
        { key: "note", label: "备注（可选）", type: "text", value: existing ? existing.note : "" }
      ],
      submitLabel: "保存",
      showDelete: !!existing,
      onDelete: function () {
        state.interestPayments = state.interestPayments.filter(function (p) { return p.id !== existing.id; });
        saveState();
        closeModal();
        render();
        toast("已删除");
      },
      onSubmit: function (v) {
        var amount = parseFloat(v.amount);
        if (!v.date || isNaN(amount) || amount <= 0) { toast("请填写正确的日期和金额"); return; }
        if (existing) {
          existing.date = v.date;
          existing.amount = amount;
          existing.note = v.note;
        } else {
          state.interestPayments.push({ id: uid(), date: v.date, amount: amount, note: v.note });
          if (v.source === "reserve") {
            state.interestReserveFund.transactions.push({ id: uid(), date: v.date, type: "withdraw", amount: amount, note: "缴纳年度利息" });
          }
        }
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  function renderLoans() {
    var html = "";
    var totalPrincipal = totalLoanPrincipal();

    html += '<div class="card fund-card" style="border-left-color:var(--c-interest);">';
    html += '<div class="row"><h3 style="margin:0;">🏦 贷款利息储备</h3><span class="big-number" style="font-size:20px;">' + money(interestReserveBalance()) + '</span></div>';
    html += '<div class="sub-number">专门用于每年12月20日强制还息，与本金无关</div>';
    html += '<div class="plan-actions">';
    html += '<button class="btn btn-primary btn-sm" id="interestReserveDepositBtn">存入</button>';
    html += '<button class="btn btn-outline btn-sm" id="interestPayBtn">登记利息缴纳</button>';
    html += '<button class="btn btn-outline btn-sm" id="interestReserveHistoryBtn">流水</button>';
    html += '</div>';
    html += '<div class="history-list" id="interestReserveHistory" style="display:none;">';
    if (!state.interestReserveFund.transactions.length && !state.interestPayments.length) {
      html += '<div class="hrow"><span>暂无流水</span></div>';
    } else {
      html += state.interestReserveFund.transactions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (t) {
        return '<div class="hrow"><span>' + t.date + (t.note ? " · " + escapeHtml(t.note) : "") + '</span><span>' + (t.type === "deposit" ? "+" : "-") + money(t.amount) + '</span></div>';
      }).join("");
      if (state.interestPayments.length) {
        html += '<div class="hrow" style="border-top:1px dashed var(--border);margin-top:4px;padding-top:6px;"><span style="font-weight:600;">已缴年度利息</span></div>';
        html += state.interestPayments.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (p) {
          return '<div class="hrow" data-interest-pay-id="' + p.id + '" style="cursor:pointer;"><span>' + p.date + (p.note ? " · " + escapeHtml(p.note) : "") + '</span><span>' + money(p.amount) + '</span></div>';
        }).join("");
      }
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">贷款合同明细</h3><button class="link-btn" id="toggleContracts">展开/收起</button></div>';
    html += '<div class="sub-number">合计本金 ' + money(totalPrincipal) + ' · 共 ' + state.loanContracts.length + ' 笔</div>';
    html += '<div id="contractsList" style="display:none;margin-top:10px;">';
    state.loanContracts.forEach(function (c) {
      html += '<div class="list-item" data-contract-id="' + c.id + '">';
      html += '<div class="exp-main"><span>' + escapeHtml(c.term) + ' · ' + money(c.principal) + (c.payoff ? ' · ✅已结清' : '') + '</span>';
      html += '<span class="exp-note">编号 ' + escapeHtml(c.contractNo) + ' · 利率 ' + (c.rate * 100).toFixed(2) + '% · ' + escapeHtml(c.org) + '</span>';
      html += '<span class="exp-note">发放 ' + c.issueDate + ' · 到期 ' + c.dueDate + ' · 贴息至 ' + c.interestFreeUntil + '</span>';
      html += '</div>';
      html += '</div>';
    });
    html += '<div class="row" style="margin-top:10px;"><button class="btn btn-outline btn-block btn-sm" id="addContractBtn">+ 新增贷款合同</button></div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="section-title"><h2>📅 贷款到期与转现金计划</h2></div>';
    html += '<div class="sub-number" style="margin:-6px 2px 10px;">策略：本金拖到各自到期日一次性结清，到期前3年逐步把对应份额的定投转成现金</div>';
    state.loanContracts.forEach(function (c) {
      var g = loanGlideStatus(c);
      html += '<div class="card plan-card" data-contract-glide="' + c.id + '">';
      html += '<div class="plan-head"><span class="plan-name">' + escapeHtml(c.term) + ' · ' + money(c.principal) + '</span>';
      if (g.status === "paid") html += '<span class="status-badge status-good">已结清</span>';
      else if (g.status === "due") html += '<span class="status-badge status-critical">已到期</span>';
      else if (g.status === "glide") html += '<span class="status-badge status-warning">转换中 ' + g.yearIndex + '/3</span>';
      else html += '<span class="status-badge">未到期</span>';
      html += '</div>';
      html += '<div class="plan-meta">到期日 ' + c.dueDate + '</div>';
      if (g.status === "paid") {
        html += '<div class="plan-meta">结清日期 ' + c.payoff.date + ' · 实还 ' + money(c.payoff.amount) + (c.payoff.note ? " · " + escapeHtml(c.payoff.note) : "") + '</div>';
      } else if (g.status === "pending") {
        html += '<div class="plan-meta">建议 ' + g.startYear + ' 年起分3年（' + g.startYear + '/' + (g.startYear + 1) + '/' + (g.startYear + 2) + '）逐步把对应定投份额转成现金，还有 ' + g.yearsToStart + ' 年</div>';
      } else if (g.status === "glide") {
        html += '<div class="plan-meta">正在转换第 ' + g.yearIndex + ' 年（共3年：' + g.startYear + '-' + (g.startYear + 2) + '），' + g.dueYear + ' 年到期时应已全部转为现金</div>';
        html += '<div class="progress-track"><div class="progress-fill" style="width:' + Math.round(g.yearIndex / 3 * 100) + '%"></div></div>';
      } else if (g.status === "due") {
        html += '<div class="plan-meta" style="color:var(--danger);font-weight:600;">已到还本年份，请核对系统账单并结清本金</div>';
      }
      if (!g.status || g.status === "unknown") html += '<div class="plan-meta">未设置到期日</div>';
      html += '<div class="plan-actions">';
      html += '<button class="btn btn-outline btn-sm" data-contract-payoff="' + c.id + '">' + (c.payoff ? "编辑结清记录" : "登记已还清") + '</button>';
      html += '</div>';
      html += '</div>';
    });
    if (!state.loanContracts.length) {
      html += '<div class="card empty-state">暂无贷款合同</div>';
    }

    if (state.reserveFund.transactions.length) {
      html += '<div class="section-title"><h2>历史记录（旧策略遗留）</h2></div>';
      html += '<div class="card">';
      html += '<div class="row"><h3 style="margin:0;">还款储备金余额</h3><span class="big-number" style="font-size:18px;">' + money(reserveBalance()) + '</span></div>';
      html += '<div class="sub-number">旧的"6年加速还本"方案遗留，当前策略已不再使用，仅供查看历史流水</div>';
      html += '<div class="plan-actions">';
      html += '<button class="btn btn-outline btn-sm" id="reserveHistoryBtn">流水</button>';
      html += '</div>';
      html += '<div class="history-list" id="reserveHistory" style="display:none;">';
      html += state.reserveFund.transactions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (t) {
        return '<div class="hrow"><span>' + t.date + (t.note ? " · " + escapeHtml(t.note) : "") + '</span><span>' + (t.type === "deposit" ? "+" : "-") + money(t.amount) + '</span></div>';
      }).join("");
      html += '</div>';
      html += '</div>';
    }

    return html;
  }

  function openContractModal(existing) {
    var fields = [
      { key: "term", label: "学年/名称", type: "text", value: existing ? existing.term : "" },
      { key: "contractNo", label: "合同编号", type: "text", value: existing ? existing.contractNo : "" },
      { key: "principal", label: "贷款金额", type: "number", value: existing ? existing.principal : "" },
      { key: "issueDate", label: "发放日期", type: "date", value: existing ? existing.issueDate : todayStr() },
      { key: "dueDate", label: "到期日期", type: "date", value: existing ? existing.dueDate : "" },
      { key: "interestFreeUntil", label: "贴息截止日", type: "date", value: existing ? existing.interestFreeUntil : "" },
      { key: "rate", label: "合同利率（如0.028代表2.8%）", type: "number", value: existing ? existing.rate : "0.028" },
      { key: "org", label: "贷款办理机构", type: "text", value: existing ? existing.org : "" },
      { key: "agent", label: "代理结算机构", type: "text", value: existing ? existing.agent : "" }
    ];
    openFormModal({
      title: existing ? "编辑贷款合同" : "新增贷款合同",
      fields: fields,
      showDelete: !!existing,
      onDelete: function () {
        state.loanContracts = state.loanContracts.filter(function (x) { return x.id !== existing.id; });
        saveState();
        closeModal();
        render();
        toast("已删除");
      },
      onSubmit: function (v) {
        var principal = parseFloat(v.principal);
        var rate = parseFloat(v.rate);
        if (!v.term || isNaN(principal) || principal <= 0) {
          toast("请填写完整信息");
          return;
        }
        var obj = { term: v.term, contractNo: v.contractNo, principal: principal, issueDate: v.issueDate, dueDate: v.dueDate, interestFreeUntil: v.interestFreeUntil, rate: isNaN(rate) ? 0 : rate, org: v.org, agent: v.agent };
        if (existing) {
          Object.assign(existing, obj);
        } else {
          obj.id = uid();
          obj.payoff = null;
          state.loanContracts.push(obj);
        }
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  function openLoanPayoffModal(contract) {
    var existing = contract.payoff;
    openFormModal({
      title: (existing ? "编辑" : "登记") + "已还清 · " + contract.term,
      fields: [
        { key: "date", label: "实际结清日期", type: "date", value: existing ? existing.date : todayStr() },
        { key: "amount", label: "实际还本金额", type: "number", value: existing ? existing.amount : contract.principal },
        { key: "note", label: "备注（可选，如资金来源）", type: "text", value: existing ? existing.note : "" }
      ],
      submitLabel: "保存",
      showDelete: !!existing,
      onDelete: function () {
        contract.payoff = null;
        saveState();
        closeModal();
        render();
        toast("已撤销");
      },
      onSubmit: function (v) {
        var amount = parseFloat(v.amount);
        if (!v.date || isNaN(amount) || amount <= 0) { toast("请填写正确的日期和金额"); return; }
        contract.payoff = { date: v.date, amount: amount, note: v.note };
        saveState();
        closeModal();
        render();
        toast("已登记结清");
      }
    });
  }

  /* ---------------- Goals (financial: cash-flow calculator + savings goals) ---------------- */
  function goalCurrentAmount(goal) {
    return sum(goal.contributions, function (c) { return c.amount; });
  }

  function renderGoals() {
    var params = state.cashFlowParams;
    var cf = currentMonthCashFlow();
    var series = getCashFlowSeries(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 6);

    var html = "";

    var emergBal = emergencyBalance();
    var emergTarget = Number(params.emergencyFundTarget) || 0;

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">⚙️ 现金流参数</h3><button class="link-btn" id="editParamsBtn">编辑参数</button></div>';
    html += '<div class="sub-number">基本工资 ' + money(params.baseSalary) + ' · 交通补贴 ' + money(params.transportPerDay * params.transportDays) + '/月</div>';
    html += '<div class="sub-number">五险 ' + (params.insuranceRate * 100).toFixed(1) + '% · 公积金 ' + (params.housingFundRate * 100).toFixed(1) + '%（' + params.housingFundStartDate + ' 起）</div>';
    html += '<div class="sub-number">生活开销 ' + money(params.lifeExpenseCommute + params.lifeExpenseFood + params.lifeExpenseFamily + params.lifeExpensePersonal) + '/月 · 养老金 ' + money(params.pensionMonthly) + '/月 · 利息储备 ' + money(params.interestReserveMonthly) + '/月</div>';
    html += '<div class="sub-number">应急金 ' + money(params.emergencyFundMonthly) + '/月（目标' + (emergTarget > 0 ? money(emergTarget) : '未设置') + '）· 定投 攒够前' + money(params.investMonthlyBeforeTarget) + '/月，攒够后' + money(params.investMonthlyAfterTarget) + '/月</div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">' + (cf.confirmed ? '本月工资（已确认）' : '本月测算（估算）') + ' · ' + cf.monthLabel + '</h3><button class="link-btn" id="confirmSalaryBtn">' + (cf.confirmed ? '修改' : '确认工资') + '</button></div>';
    html += '<div class="row"><span>到手工资</span><span class="big-number" style="font-size:18px;">' + money(cf.netPay) + '</span></div>';
    html += renderAllocationBar(cf);
    if (!cf.confirmed) html += '<div class="sub-number">这是按现金流参数估算的数字，实际工资以工资条为准——拿到工资条后点"确认工资"填入实发数额</div>';
    html += '<button class="btn btn-primary btn-block" id="registerMonthBtn" style="margin-top:10px;">登记本月存入</button>';
    html += '</div>';

    html += '<div class="card fund-card" style="border-left-color:var(--c-emergency);">';
    html += '<div class="row"><h3 style="margin:0;">🚨 应急金（活钱宝）</h3><span class="big-number" style="font-size:18px;">' + money(emergBal) + '</span></div>';
    if (emergTarget > 0) {
      var emergPct = Math.min(100, Math.round(emergBal / emergTarget * 100));
      html += '<div class="progress-track"><div class="progress-fill" style="width:' + emergPct + '%;background:var(--c-emergency);"></div></div>';
      if (emergBal >= emergTarget) {
        html += '<div class="sub-number" style="color:var(--c-interest);font-weight:600;">🎉 已攒够目标 ' + money(emergTarget) + '，之后每月自动全部转入定投</div>';
      } else {
        html += '<div class="sub-number">距目标 ' + money(emergTarget) + ' 还差 ' + money(emergTarget - emergBal) + '（' + emergPct + '%）</div>';
      }
    }
    html += '<div class="plan-actions">';
    html += '<button class="btn btn-primary btn-sm" id="emergencyDepositBtn">存入</button>';
    html += '<button class="btn btn-outline btn-sm" id="emergencyWithdrawBtn">支出</button>';
    html += '<button class="btn btn-outline btn-sm" id="emergencyHistoryBtn">流水</button>';
    html += '</div>';
    html += '<div class="history-list" id="emergencyHistory" style="display:none;">';
    html += state.emergencyFund.transactions.length ? state.emergencyFund.transactions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (t) {
      return '<div class="hrow"><span>' + t.date + (t.note ? " · " + escapeHtml(t.note) : "") + '</span><span>' + (t.type === "deposit" ? "+" : "-") + money(t.amount) + '</span></div>';
    }).join("") : '<div class="hrow"><span>暂无流水</span></div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">未来6个月测算</h3><button class="link-btn" id="toggleSalaryHistory">工资记录</button></div>';
    series.forEach(function (r) {
      var rMonthKey = monthKey(fmtDate(r.date));
      html += '<div class="row" data-confirm-month="' + rMonthKey + '" style="cursor:pointer;"><span>' + r.monthLabel + (r.confirmed ? ' ✓' : '') + '</span><span>到手 ' + money(r.netPay) + ' · 利息 ' + money(r.interestReserveSplit) + ' · 应急 ' + money(r.emergencyContribution) + ' · 定投 ' + money(r.investContribution) + '</span></div>';
    });
    html += '<div class="sub-number">点某个月份可以直接确认/修改那个月的工资</div>';
    html += '<div class="row" style="margin-top:10px;"><button class="btn btn-outline btn-sm btn-block" id="backfillSalaryBtn">+ 补录其他月份工资</button></div>';
    html += '<div class="history-list" id="salaryHistory" style="display:none;">';
    if (!state.salaryRecords.length) {
      html += '<div class="hrow"><span>暂无确认记录</span></div>';
    } else {
      state.salaryRecords.slice().sort(function (a, b) { return b.month.localeCompare(a.month); }).forEach(function (r) {
        var thumbUrl = (r.payslipId && payslipCache && payslipCache[r.payslipId]) ? payslipCache[r.payslipId] : null;
        html += '<div class="hrow payslip-row" data-confirm-month="' + r.month + '" style="cursor:pointer;">';
        if (thumbUrl) {
          html += '<img src="' + thumbUrl + '" class="payslip-thumb" data-payslip-view="' + r.payslipId + '">';
        } else if (r.payslipId) {
          html += '<span class="payslip-thumb payslip-thumb-loading"></span>';
        }
        html += '<span class="payslip-info"><span>' + r.month + (r.note ? " · " + escapeHtml(r.note) : "") + '</span><span>' + money(r.actualNetPay) + '</span></span>';
        html += '</div>';
      });
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="section-title"><h2>🎯 小目标</h2>' + (autoInvestGoals().length ? '<span class="sub-number">定投合计 ' + money(autoInvestTotalBalance()) + '</span>' : '') + '</div>';
    if (!state.goals.length) {
      html += '<div class="card empty-state">暂无理财目标，点击下方按钮新增（把3只定投基金也建成小目标，就能参与"登记本月存入"自动拆分）</div>';
    } else {
      state.goals.forEach(function (goal) {
        var current = goalCurrentAmount(goal);
        var hasTarget = Number(goal.target) > 0;
        var pct = hasTarget ? Math.min(100, Math.round((current / goal.target) * 100)) : null;
        html += '<div class="card plan-card" data-goal-id="' + goal.id + '"' + (goal.autoInvestWeight ? ' style="border-left:3px solid var(--c-invest);"' : '') + '>';
        html += '<div class="plan-head"><span class="plan-name">' + escapeHtml(goal.name) + (goal.autoInvestWeight ? ' <span class="status-badge" style="background:var(--c-invest);color:#fff;">定投 ' + Math.round(goal.autoInvestWeight * 100) + '%</span>' : '') + '</span>' + (pct != null ? '<span>' + pct + '%</span>' : '') + '</div>';
        if (pct != null) {
          html += '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
          html += '<div class="plan-meta">已存 ' + money(current) + ' / 目标 ' + money(goal.target) + '</div>';
        } else {
          html += '<div class="plan-meta">累计已存 ' + money(current) + '</div>';
        }
        if (goal.targetDate) html += '<div class="plan-meta">目标日期：' + goal.targetDate + '</div>';
        if (goal.note) html += '<div class="plan-meta">备注：' + escapeHtml(goal.note) + '</div>';
        html += '<div class="plan-actions">';
        html += '<button class="btn btn-primary btn-sm" data-goal-add="' + goal.id + '">存入</button>';
        html += '<button class="btn btn-outline btn-sm" data-goal-edit="' + goal.id + '">编辑</button>';
        html += '<button class="btn btn-outline btn-sm" data-goal-history="' + goal.id + '">记录</button>';
        html += '</div>';
        html += '<div class="history-list" id="goalHistory-' + goal.id + '" style="display:none;">' + renderGoalHistory(goal) + '</div>';
        html += '</div>';
      });
    }
    html += '<button class="fab" id="addGoalFab">+</button>';
    return html;
  }

  function renderGoalHistory(goal) {
    if (!goal.contributions.length) return '<div class="hrow"><span>暂无存入记录</span></div>';
    return goal.contributions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); })
      .map(function (c) { return '<div class="hrow"><span>' + c.date + '</span><span>' + money(c.amount) + '</span></div>'; })
      .join("");
  }

  function openGoalModal(existing) {
    var fields = [
      { key: "name", label: "目标名称（如：应急基金/买车/纳指100定投）", type: "text", value: existing ? existing.name : "" },
      { key: "target", label: "目标金额（不设目标可填0）", type: "number", value: existing ? existing.target : "0" },
      { key: "targetDate", label: "目标日期（可选）", type: "date", value: existing ? existing.targetDate : "" },
      { key: "autoInvestWeight", label: "参与\"登记本月存入\"自动定投拆分的权重(%，如40代表40%；不参与请留空)", type: "number", value: existing && existing.autoInvestWeight ? round2(existing.autoInvestWeight * 100) : "" },
      { key: "note", label: "备注（可选）", type: "text", value: existing ? existing.note : "" }
    ];
    openFormModal({
      title: existing ? "编辑理财目标" : "新增理财目标",
      fields: fields,
      showDelete: !!existing,
      onDelete: function () {
        state.goals = state.goals.filter(function (x) { return x.id !== existing.id; });
        saveState();
        closeModal();
        render();
        toast("已删除");
      },
      onSubmit: function (v) {
        var target = parseFloat(v.target);
        if (!v.name) {
          toast("请填写目标名称");
          return;
        }
        var weightPct = parseFloat(v.autoInvestWeight);
        var weight = isNaN(weightPct) || weightPct <= 0 ? null : round2(weightPct / 100 * 10000) / 10000;
        if (existing) {
          existing.name = v.name;
          existing.target = isNaN(target) ? 0 : target;
          existing.targetDate = v.targetDate;
          existing.autoInvestWeight = weight;
          existing.note = v.note;
        } else {
          state.goals.push({ id: uid(), name: v.name, target: isNaN(target) ? 0 : target, targetDate: v.targetDate, autoInvestWeight: weight, note: v.note, contributions: [] });
        }
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  function openGoalContributionModal(goal) {
    var fields = [
      { key: "date", label: "存入日期", type: "date", value: todayStr() },
      { key: "amount", label: "存入金额", type: "number", value: "" }
    ];
    openFormModal({
      title: "存入 · " + goal.name,
      fields: fields,
      submitLabel: "确认存入",
      onSubmit: function (v) {
        var amount = parseFloat(v.amount);
        if (!v.date || isNaN(amount) || amount <= 0) {
          toast("请填写正确的日期和金额");
          return;
        }
        goal.contributions.push({ id: uid(), date: v.date, amount: amount });
        saveState();
        closeModal();
        render();
        toast("已登记存入");
      }
    });
  }

  function openCashFlowParamsModal() {
    var p = state.cashFlowParams;
    var fields = [
      { key: "baseSalary", label: "基本工资(元/月，税前)", type: "number", value: p.baseSalary },
      { key: "transportPerDay", label: "交通补贴单价(元/天)", type: "number", value: p.transportPerDay },
      { key: "transportDays", label: "交通补贴天数(天/月)", type: "number", value: p.transportDays },
      { key: "insuranceRate", label: "五险个人缴费比例合计(如0.102代表10.2%)", type: "number", value: p.insuranceRate },
      { key: "housingFundRate", label: "公积金个人缴费比例(如0.05代表5%)", type: "number", value: p.housingFundRate },
      { key: "housingFundStartDate", label: "公积金开始缴费月份", type: "date", value: p.housingFundStartDate },
      { key: "taxBaseDeduction", label: "个税基本减除费用(元/月)", type: "number", value: p.taxBaseDeduction },
      { key: "pensionMonthly", label: "个人养老金月缴存(元)", type: "number", value: p.pensionMonthly },
      { key: "pensionStartDate", label: "个人养老金开始缴存月份", type: "date", value: p.pensionStartDate },
      { key: "lifeExpenseCommute", label: "生活开销-通勤(元/月)", type: "number", value: p.lifeExpenseCommute },
      { key: "lifeExpenseFood", label: "生活开销-伙食(元/月)", type: "number", value: p.lifeExpenseFood },
      { key: "lifeExpenseFamily", label: "生活开销-给家里(元/月)", type: "number", value: p.lifeExpenseFamily },
      { key: "lifeExpensePersonal", label: "生活开销-个人日常(元/月)", type: "number", value: p.lifeExpensePersonal },
      { key: "interestReserveMonthly", label: "贷款利息储备每月存入(元，每年12/21利率调整后请同步核对)", type: "number", value: p.interestReserveMonthly },
      { key: "emergencyFundMonthly", label: "应急金每月定投(元，活钱宝)", type: "number", value: p.emergencyFundMonthly },
      { key: "emergencyFundTarget", label: "应急金目标金额(元，攒够后自动停止新增、转入定投；填0代表不设目标)", type: "number", value: p.emergencyFundTarget },
      { key: "investMonthlyBeforeTarget", label: "定投月供-应急金攒够前(元)", type: "number", value: p.investMonthlyBeforeTarget },
      { key: "investMonthlyAfterTarget", label: "定投月供-应急金攒够后(元)", type: "number", value: p.investMonthlyAfterTarget }
    ];
    openFormModal({
      title: "编辑现金流参数",
      fields: fields,
      submitLabel: "保存",
      onSubmit: function (v) {
        p.baseSalary = parseFloat(v.baseSalary) || 0;
        p.transportPerDay = parseFloat(v.transportPerDay) || 0;
        p.transportDays = parseFloat(v.transportDays) || 0;
        p.insuranceRate = parseFloat(v.insuranceRate) || 0;
        p.housingFundRate = parseFloat(v.housingFundRate) || 0;
        p.housingFundStartDate = v.housingFundStartDate;
        p.taxBaseDeduction = parseFloat(v.taxBaseDeduction) || 0;
        p.pensionMonthly = parseFloat(v.pensionMonthly) || 0;
        p.pensionStartDate = v.pensionStartDate;
        p.lifeExpenseCommute = parseFloat(v.lifeExpenseCommute) || 0;
        p.lifeExpenseFood = parseFloat(v.lifeExpenseFood) || 0;
        p.lifeExpenseFamily = parseFloat(v.lifeExpenseFamily) || 0;
        p.lifeExpensePersonal = parseFloat(v.lifeExpensePersonal) || 0;
        p.interestReserveMonthly = parseFloat(v.interestReserveMonthly) || 0;
        p.emergencyFundMonthly = parseFloat(v.emergencyFundMonthly) || 0;
        p.emergencyFundTarget = parseFloat(v.emergencyFundTarget) || 0;
        p.investMonthlyBeforeTarget = parseFloat(v.investMonthlyBeforeTarget) || 0;
        p.investMonthlyAfterTarget = parseFloat(v.investMonthlyAfterTarget) || 0;
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  /* ---------------- More / Backup ---------------- */
  function renderMore() {
    var html = "";

    if (deferredInstallPrompt) {
      html += '<div class="card">';
      html += '<h3>安装到主屏幕</h3>';
      html += '<div class="sub-number">点这个按钮安装的是真正的App体验（全屏无地址栏），比浏览器菜单里的"添加到桌面"更可靠</div>';
      html += '<button class="btn btn-primary btn-block" id="installAppBtn" style="margin-top:10px;">立即安装</button>';
      html += '</div>';
    }

    html += '<div class="card">';
    html += '<h3>👋 个性化</h3>';
    html += '<div class="form-field"><label>昵称（首页问候语用，可留空）</label><input type="text" id="nicknameInput" value="' + escapeHtml(state.nickname || "") + '" placeholder="怎么称呼你"></div>';
    html += '<div class="form-field" style="margin-bottom:0;"><label>实际开始使用日期（用于首页"第几天"计数）</label><input type="date" id="firstUseDateInput" value="' + escapeHtml(state.firstUseDate || todayStr()) + '"></div>';
    html += '<div class="sub-number" style="margin-top:6px;">已经用了 ' + daysSinceFirstUse() + ' 天</div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>数据备份</h3>';
    html += '<div class="row"><span>导出全部数据（JSON）</span><button class="btn btn-outline btn-sm" id="exportJsonBtn">导出</button></div>';
    html += '<div class="row"><span>导入数据（JSON）恢复</span><button class="btn btn-outline btn-sm" id="importJsonBtn">导入</button></div>';
    html += '<div class="row"><span>导出开销明细（CSV / Excel）</span><button class="btn btn-outline btn-sm" id="exportCsvBtn">导出</button></div>';
    html += '<input type="file" id="importFileInput" accept="application/json" style="display:none;">';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>关键日期提醒</h3>';
    state.keyDates.forEach(function (kd) {
      html += '<div class="list-item" data-keydate-id="' + kd.id + '">';
      html += '<div class="exp-main"><span>' + escapeHtml(kd.name) + '</span><span class="exp-note">' + (kd.type === "once" ? kd.date : "每年 " + kd.month + "月" + kd.day + "日") + '</span></div>';
      html += '</div>';
    });
    html += '<div class="row" style="margin-top:10px;"><button class="btn btn-outline btn-block btn-sm" id="exportIcsBtn2">导出到手机日历（.ics）</button></div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>开销分类管理</h3>';
    html += '<div class="chip-row" id="categoryChips">';
    state.categories.forEach(function (c) {
      var cColor = categoryColor(c);
      html += '<span class="chip" data-cat="' + escapeHtml(c) + '" style="background:' + cColor.bg + ';color:' + cColor.text + ';border-color:transparent;">' + escapeHtml(c) + ' ✕</span>';
    });
    html += '</div>';
    html += '<div class="row" style="margin-top:12px;"><button class="btn btn-outline btn-block" id="addCategoryBtn">+ 新增分类</button></div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>数据统计</h3>';
    html += '<div class="sub-number">开销记录 ' + state.expenses.length + ' 条 · 贷款合同 ' + state.loanContracts.length + ' 笔 · 理财目标 ' + state.goals.length + ' 项</div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>危险操作</h3>';
    html += '<button class="btn btn-danger btn-block" id="resetFundsBtn" style="margin-bottom:10px;">重置各资金池流水+还本记录</button>';
    html += '<div class="sub-number" style="margin-bottom:10px;">清空利息储备/应急金/旧还款储备的存取流水、贷款结清记录、小目标存入记录，贷款合同、现金流参数、记账都不受影响</div>';
    html += '<button class="btn btn-danger btn-block" id="clearAllBtn">清空所有数据</button>';
    html += '</div>';

    html += '<div class="sub-number" style="text-align:center;margin-top:6px;">记账理财工作台 · 数据仅保存在本机浏览器</div>';
    return html;
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    downloadBlob(blob, "记账理财备份_" + todayStr() + ".json");
    toast("已导出备份文件");
  }

  function exportCsv() {
    var rows = [["日期", "分类", "金额", "备注"]];
    state.expenses.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (x) {
      rows.push([x.date, x.category, x.amount, x.note || ""]);
    });
    var csv = "﻿" + rows.map(function (r) {
      return r.map(function (cell) {
        var s = String(cell).replace(/"/g, '""');
        return /[,"\n]/.test(s) ? '"' + s + '"' : s;
      }).join(",");
    }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, "开销明细_" + todayStr() + ".csv");
    toast("已导出CSV文件");
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function importJsonFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || typeof data !== "object") throw new Error("格式错误");
        if (!confirmAction("导入将覆盖当前所有本机数据，确定继续吗？")) return;
        var freshDefaults = defaultState();
        var defaultParams = freshDefaults.cashFlowParams;
        state = Object.assign(freshDefaults, data);
        state.cashFlowParams = Object.assign({}, defaultParams, data.cashFlowParams || {});
        payslipCache = null;
        saveState();
        render();
        toast("导入成功");
      } catch (e) {
        toast("导入失败：文件格式不正确");
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- Event wiring ---------------- */
  function attachPageHandlers(page) {
    if (page === "home") {
      document.querySelectorAll("[data-quick]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var type = btn.dataset.quick;
          if (type === "expense") openExpenseModal(null);
          if (type === "confirm-salary") openConfirmSalaryModal();
          if (type === "goal-add") openGoalModal(null);
        });
      });
      var icsBtn = document.getElementById("exportIcsBtn");
      if (icsBtn) icsBtn.addEventListener("click", exportKeyDatesIcs);

      document.querySelectorAll("[data-cal-view]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          homeCalView = btn.dataset.calView;
          homeCalAnchor = new Date();
          render();
        });
      });
      document.querySelectorAll("[data-cal-nav]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var dir = parseInt(btn.dataset.calNav, 10);
          if (homeCalView === "week") homeCalAnchor = addDays(homeCalAnchor, dir * 7);
          else if (homeCalView === "year") homeCalAnchor = new Date(homeCalAnchor.getFullYear() + dir, homeCalAnchor.getMonth(), 1);
          else homeCalAnchor = addMonths(homeCalAnchor, dir);
          render();
        });
      });
      document.querySelectorAll("[data-cal-day]").forEach(function (cell) {
        cell.addEventListener("click", function () { openDayDetailModal(cell.dataset.calDay); });
      });
      document.querySelectorAll("[data-cal-month]").forEach(function (col) {
        col.addEventListener("click", function () {
          var mk = col.dataset.calMonth;
          var parts = mk.split("-");
          homeCalAnchor = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
          homeCalView = "month";
          render();
        });
      });
    }

    if (page === "expenses") {
      document.querySelectorAll("[data-nav-month]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          expenseMonth = shiftMonth(expenseMonth, parseInt(btn.dataset.navMonth, 10));
          render();
        });
      });
      var fab = document.getElementById("addExpenseFab");
      if (fab) fab.addEventListener("click", function () { openExpenseModal(null); });
      document.querySelectorAll("[data-exp-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var exp = state.expenses.find(function (x) { return x.id === row.dataset.expId; });
          if (exp) openExpenseModal(exp);
        });
      });
    }

    if (page === "loans") {
      document.getElementById("interestReserveDepositBtn").addEventListener("click", function () { openInterestReserveTxModal("deposit"); });
      document.getElementById("interestPayBtn").addEventListener("click", function () { openInterestPaymentModal(null); });
      document.getElementById("interestReserveHistoryBtn").addEventListener("click", function () {
        var box = document.getElementById("interestReserveHistory");
        box.style.display = box.style.display === "none" ? "block" : "none";
      });
      document.querySelectorAll("[data-interest-pay-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var p = state.interestPayments.find(function (x) { return x.id === row.dataset.interestPayId; });
          if (p) openInterestPaymentModal(p);
        });
      });
      document.getElementById("toggleContracts").addEventListener("click", function () {
        var box = document.getElementById("contractsList");
        box.style.display = box.style.display === "none" ? "block" : "none";
      });
      document.getElementById("addContractBtn").addEventListener("click", function () { openContractModal(null); });
      document.querySelectorAll("[data-contract-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          var c = state.loanContracts.find(function (x) { return x.id === row.dataset.contractId; });
          if (c) openContractModal(c);
        });
      });
      document.querySelectorAll("[data-contract-payoff]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var c = state.loanContracts.find(function (x) { return x.id === btn.dataset.contractPayoff; });
          if (c) openLoanPayoffModal(c);
        });
      });
      var reserveHistBtn = document.getElementById("reserveHistoryBtn");
      if (reserveHistBtn) {
        reserveHistBtn.addEventListener("click", function () {
          var box = document.getElementById("reserveHistory");
          box.style.display = box.style.display === "none" ? "block" : "none";
        });
      }
    }

    if (page === "goals") {
      ensurePayslipCache(function () {
        if (currentPage === "goals") render();
      });
      document.querySelectorAll("[data-payslip-view]").forEach(function (img) {
        img.addEventListener("click", function (e) {
          e.stopPropagation();
          openImageLightbox(img.getAttribute("src"));
        });
      });
      document.getElementById("editParamsBtn").addEventListener("click", openCashFlowParamsModal);
      document.getElementById("confirmSalaryBtn").addEventListener("click", function () { openConfirmSalaryModal(); });
      document.querySelectorAll("[data-confirm-month]").forEach(function (row) {
        row.addEventListener("click", function () {
          openConfirmSalaryModal(row.dataset.confirmMonth);
        });
      });
      document.getElementById("backfillSalaryBtn").addEventListener("click", function () {
        openFormModal({
          title: "补录其他月份工资",
          fields: [{ key: "month", label: "选择月份", type: "month", value: monthKey(todayStr()) }],
          submitLabel: "下一步",
          onSubmit: function (v) {
            if (!v.month) { toast("请选择月份"); return; }
            closeModal();
            openConfirmSalaryModal(v.month);
          }
        });
      });
      document.getElementById("toggleSalaryHistory").addEventListener("click", function () {
        var box = document.getElementById("salaryHistory");
        box.style.display = box.style.display === "none" ? "block" : "none";
      });
      document.getElementById("emergencyDepositBtn").addEventListener("click", function () { openEmergencyTxModal("deposit"); });
      document.getElementById("emergencyWithdrawBtn").addEventListener("click", function () { openEmergencyTxModal("withdraw"); });
      document.getElementById("emergencyHistoryBtn").addEventListener("click", function () {
        var box = document.getElementById("emergencyHistory");
        box.style.display = box.style.display === "none" ? "block" : "none";
      });
      document.getElementById("registerMonthBtn").addEventListener("click", function () {
        var cf = currentMonthCashFlow();
        var invGoals = autoInvestGoals();
        var weightSum = sum(invGoals, function (g) { return g.autoInvestWeight; }) || 1;
        var fields = [
          { key: "date", label: "日期", type: "date", value: todayStr() },
          { key: "interestAmount", label: "存入贷款利息储备", type: "number", value: cf.interestReserveSplit },
          { key: "emergencyAmount", label: "存入应急金（活钱宝）" + (cf.emergencyMaxed ? "（已攒够，可填0）" : ""), type: "number", value: cf.emergencyContribution }
        ];
        invGoals.forEach(function (g) {
          fields.push({ key: "goal_" + g.id, label: "定投 · " + g.name + "（权重" + Math.round(g.autoInvestWeight / weightSum * 100) + "%）", type: "number", value: round2(cf.investContribution * g.autoInvestWeight / weightSum) });
        });
        if (!invGoals.length && cf.investContribution > 0) {
          fields.push({ key: "investNote", label: "本月定投额" + money(cf.investContribution) + "——去\"小目标\"新增3只定投基金并设置权重后，这里才能自动拆分", type: "text", value: "" });
        }
        openFormModal({
          title: "登记本月存入 · " + cf.monthLabel,
          fields: fields,
          submitLabel: "确认登记",
          onSubmit: function (v) {
            var note = cf.monthLabel + (cf.confirmed ? " 实际结余" : " 现金流测算");
            var i = parseFloat(v.interestAmount) || 0;
            var e = parseFloat(v.emergencyAmount) || 0;
            if (i > 0) state.interestReserveFund.transactions.push({ id: uid(), date: v.date, type: "deposit", amount: i, note: note });
            if (e > 0) state.emergencyFund.transactions.push({ id: uid(), date: v.date, type: "deposit", amount: e, note: note });
            invGoals.forEach(function (g) {
              var amount = parseFloat(v["goal_" + g.id]) || 0;
              if (amount > 0) g.contributions.push({ id: uid(), date: v.date, amount: amount, note: note });
            });
            saveState();
            closeModal();
            render();
            toast("已登记本月存入");
          }
        });
      });
      var goalFab = document.getElementById("addGoalFab");
      if (goalFab) goalFab.addEventListener("click", function () { openGoalModal(null); });
      document.querySelectorAll("[data-goal-add]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var goal = state.goals.find(function (x) { return x.id === btn.dataset.goalAdd; });
          if (goal) openGoalContributionModal(goal);
        });
      });
      document.querySelectorAll("[data-goal-edit]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var goal = state.goals.find(function (x) { return x.id === btn.dataset.goalEdit; });
          if (goal) openGoalModal(goal);
        });
      });
      document.querySelectorAll("[data-goal-history]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var box = document.getElementById("goalHistory-" + btn.dataset.goalHistory);
          if (box) box.style.display = box.style.display === "none" ? "block" : "none";
        });
      });
    }

    if (page === "more") {
      document.getElementById("nicknameInput").addEventListener("change", function (e) {
        state.nickname = e.target.value.trim();
        saveState();
      });
      document.getElementById("firstUseDateInput").addEventListener("change", function (e) {
        if (!e.target.value) return;
        state.firstUseDate = e.target.value;
        saveState();
        render();
      });
      var installBtn = document.getElementById("installAppBtn");
      if (installBtn) {
        installBtn.addEventListener("click", function () {
          if (!deferredInstallPrompt) return;
          deferredInstallPrompt.prompt();
          deferredInstallPrompt.userChoice.then(function () {
            deferredInstallPrompt = null;
            render();
          });
        });
      }
      document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
      document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
      var icsBtn2 = document.getElementById("exportIcsBtn2");
      if (icsBtn2) icsBtn2.addEventListener("click", exportKeyDatesIcs);
      var fileInput = document.getElementById("importFileInput");
      document.getElementById("importJsonBtn").addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", function () {
        if (fileInput.files[0]) importJsonFile(fileInput.files[0]);
        fileInput.value = "";
      });
      document.getElementById("addCategoryBtn").addEventListener("click", function () {
        openFormModal({
          title: "新增分类",
          fields: [{ key: "name", label: "分类名称", type: "text", value: "" }],
          onSubmit: function (v) {
            var name = (v.name || "").trim();
            if (!name) { toast("请输入分类名称"); return; }
            if (state.categories.indexOf(name) === -1) state.categories.push(name);
            saveState();
            closeModal();
            render();
          }
        });
      });
      document.querySelectorAll("[data-cat]").forEach(function (chip) {
        chip.addEventListener("click", function () {
          var cat = chip.dataset.cat;
          if (state.categories.length <= 1) { toast("至少保留一个分类"); return; }
          if (confirmAction('删除分类 "' + cat + '" ？已有记录不受影响。')) {
            state.categories = state.categories.filter(function (c) { return c !== cat; });
            saveState();
            render();
          }
        });
      });
      document.getElementById("resetFundsBtn").addEventListener("click", function () {
        if (confirmAction("将清空利息储备/应急金/旧还款储备的存取流水、利息缴纳记录、贷款结清记录，且无法恢复。贷款合同/现金流参数/小目标/记账不受影响。确定重置吗？")) {
          state.reserveFund.transactions = [];
          state.emergencyFund.transactions = [];
          state.interestReserveFund.transactions = [];
          state.interestPayments = [];
          state.loanContracts.forEach(function (c) { c.payoff = null; });
          state.repaymentPlan.years.forEach(function (y) { y.actualPayments = []; });
          saveState();
          render();
          toast("已重置");
        }
      });
      document.getElementById("clearAllBtn").addEventListener("click", function () {
        if (confirmAction("将清空全部开销、还款、理财数据，且无法恢复。建议先导出备份。确定清空吗？")) {
          state = defaultState();
          saveState();
          render();
          toast("已清空");
        }
      });
    }
  }

  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { navigate(btn.dataset.page); });
  });

  /* ---------------- Install prompt ---------------- */
  var deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (currentPage === "more") render();
  });
  window.addEventListener("appinstalled", function () {
    deferredInstallPrompt = null;
    if (currentPage === "more") render();
  });

  /* ---------------- Init ---------------- */
  navigate("home");

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").then(function (reg) {
        reg.update();
        setInterval(function () { reg.update(); }, 30 * 60 * 1000);
      }).catch(function (err) {
        console.warn("Service worker 注册失败", err);
      });
      var reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    });
  }
})();
