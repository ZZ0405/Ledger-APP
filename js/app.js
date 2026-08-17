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

      goals: [],

      salaryRecords: [],

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
      return Object.assign(base, parsed);
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

  function monthsBetween(d1, d2) {
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
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

  /* ---------------- Tax / cash-flow engine ---------------- */
  function findBracket(cumulativeTaxable) {
    var picked = TAX_BRACKETS[0];
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      if (cumulativeTaxable >= TAX_BRACKETS[i].lower) picked = TAX_BRACKETS[i];
    }
    return picked;
  }

  function reserveMonthlyTarget() {
    var p = state.cashFlowParams;
    if (p.reserveMonthlyOverride != null && p.reserveMonthlyOverride !== "") return Number(p.reserveMonthlyOverride);
    var years = state.repaymentPlan.targetYears || 6;
    return totalLoanPrincipal() / years / 12;
  }

  function splitFromNetPay(netPay, d, params) {
    var pStart = parseDate(params.pensionStartDate);
    var pension = d >= new Date(pStart.getFullYear(), pStart.getMonth(), 1) ? Number(params.pensionMonthly) : 0;
    var lifeExpense = Number(params.lifeExpenseCommute) + Number(params.lifeExpenseFood) + Number(params.lifeExpenseFamily) + Number(params.lifeExpensePersonal);
    var surplus = round2(netPay - pension - lifeExpense);
    var reserveTarget = reserveMonthlyTarget();
    var reserveSplit = round2(Math.max(0, Math.min(surplus, reserveTarget)));
    var savingsSplit = round2(surplus - reserveSplit);
    return { pension: pension, lifeExpense: lifeExpense, surplus: surplus, reserveSplit: reserveSplit, savingsSplit: savingsSplit };
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
    var split = splitFromNetPay(netPay, d, params);

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

  function getCashFlowSeries(startDate, count) {
    var rows = [];
    var cum = null;
    var year = null;
    var params = state.cashFlowParams;
    for (var i = 0; i < count; i++) {
      var d = addMonths(startDate, i);
      if (d.getFullYear() !== year) {
        year = d.getFullYear();
        cum = { income: 0, baseDeduction: 0, specialDeduction: 0, taxWithheld: 0 };
      }
      var row = computeMonthRow(d, cum, params);
      var rec = getConfirmedSalary(monthKey(fmtDate(d)));
      if (rec) {
        var split = splitFromNetPay(rec.actualNetPay, d, params);
        row = Object.assign({}, row, split, { netPay: rec.actualNetPay, confirmed: true });
      }
      rows.push(row);
    }
    return rows;
  }

  function getConfirmedSalary(mKey) {
    return state.salaryRecords.find(function (r) { return r.month === mKey; });
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
    var reserveBalance = sum(state.reserveFund.transactions, function (t) { return t.type === "deposit" ? t.amount : -t.amount; });
    var savingsGoalsTotal = sum(state.goals, function (g) { return goalCurrentAmount(g); });

    var now = new Date();
    var activeYear = state.repaymentPlan.years.find(function (y, idx) {
      var start = addMonths(parseDate(state.repaymentPlan.startDate), idx * 12);
      var end = addMonths(parseDate(state.repaymentPlan.startDate), (idx + 1) * 12);
      return now >= start && now < end;
    }) || state.repaymentPlan.years[0];
    var actualCum = activeYear ? sum(activeYear.actualPayments, function (p) { return p.amount; }) : 0;
    var priorYearsActual = 0;
    state.repaymentPlan.years.forEach(function (y) {
      if (activeYear && y.index < activeYear.index) priorYearsActual += sum(y.actualPayments, function (p) { return p.amount; });
    });
    var totalActualPaid = priorYearsActual + actualCum;
    var remainingPrincipal = Math.max(0, totalLoanPrincipal() - totalActualPaid);

    var upcoming = upcomingKeyDates().slice(0, 3);

    var html = "";

    html += '<div class="card">';
    html += '<h3>关键日期</h3>';
    upcoming.forEach(function (u) {
      html += '<div class="row"><span>' + escapeHtml(u.kd.name) + ' · ' + fmtDate(u.next) + '</span><span style="font-weight:600;color:' + (u.days <= 14 ? "var(--danger)" : "var(--teal-dark)") + ';">' + (u.days === 0 ? "今天" : u.days + " 天后") + '</span></div>';
    });
    html += '<div class="row" style="margin-top:10px;"><button class="btn btn-outline btn-sm btn-block" id="exportIcsBtn">导出到手机日历（可靠提醒）</button></div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>本年还款进度' + (activeYear ? '（' + activeYear.periodLabel + '）' : '') + '</h3>';
    if (activeYear) {
      var pct = activeYear.targetCumulative > 0 ? Math.min(100, Math.round((totalActualPaid / activeYear.targetCumulative) * 100)) : 0;
      html += '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="sub-number">累计已还 ' + money(totalActualPaid) + ' / 本年目标 ' + money(activeYear.targetCumulative) + '</div>';
      html += '<div class="sub-number">剩余本金 ' + money(remainingPrincipal) + '</div>';
    } else {
      html += '<div class="sub-number">暂无还款计划</div>';
    }
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>本月现金流（' + cf.monthLabel + (cf.confirmed ? '，已确认' : '，测算值') + '）</h3>';
    html += '<div class="row"><span>到手工资</span><span class="big-number" style="font-size:18px;">' + money(cf.netPay) + '</span></div>';
    html += '<div class="row"><span>预计结余</span><span>' + money(cf.surplus) + '</span></div>';
    html += '<div class="row"><span>→ 还款储备</span><span>' + money(cf.reserveSplit) + '</span></div>';
    html += '<div class="row"><span>→ 个人储蓄</span><span>' + money(cf.savingsSplit) + '</span></div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>资金余额</h3>';
    html += '<div class="row"><span>还款储备金余额</span><span style="font-weight:600;">' + money(reserveBalance) + '</span></div>';
    html += '<div class="row"><span>个人储蓄合计</span><span style="font-weight:600;">' + money(savingsGoalsTotal) + '</span></div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<h3>本月实际开销（记账）</h3>';
    html += '<div class="row"><span>已记录支出</span><span>' + money(actualSpend) + '</span></div>';
    html += '<div class="row"><span>生活开销预算</span><span>' + money(cf.lifeExpense) + '</span></div>';
    html += '</div>';

    html += '<div class="row" style="gap:10px;">';
    html += '<button class="btn btn-primary" style="flex:1;" data-quick="expense">+ 记一笔</button>';
    html += '<button class="btn btn-outline" style="flex:1;" data-quick="repay">+ 登记还款</button>';
    html += '<button class="btn btn-outline" style="flex:1;" data-quick="reserve">+ 存入储备</button>';
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

    if (expenseMonth === monthKey(todayStr())) {
      var budget = state.cashFlowParams.lifeExpenseCommute + state.cashFlowParams.lifeExpenseFood + state.cashFlowParams.lifeExpenseFamily + state.cashFlowParams.lifeExpensePersonal;
      if (budget > 0) {
        var budgetPct = Math.round((total / budget) * 100);
        var over = total > budget;
        html += '<div class="card">';
        html += '<h3>本月开销 vs 预算</h3>';
        html += '<div class="progress-track"><div class="progress-fill' + (over ? ' over' : '') + '" style="width:' + Math.min(100, budgetPct) + '%"></div></div>';
        html += '<div class="sub-number" style="' + (over ? 'color:var(--danger);font-weight:600;' : '') + '">已花 ' + money(total) + ' / 预算 ' + money(budget) + '（' + budgetPct + '%）' + (over ? ' · 已超支 ' + money(total - budget) : '') + '</div>';
        html += '</div>';
      }
    }

    if (catKeys.length) {
      html += '<div class="card"><h3>分类占比</h3>';
      catKeys.forEach(function (c) {
        var pct = maxCat > 0 ? (byCat[c] / maxCat) * 100 : 0;
        html += '<div class="bar-row"><span class="bar-label">' + escapeHtml(c) + '</span><span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span><span class="bar-amount">' + money(byCat[c]) + '</span></div>';
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
        html += '<div class="exp-main"><span><span class="cat-tag">' + escapeHtml(x.category) + '</span></span>';
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

  function yearActualCumulative(uptoIndex) {
    var total = 0;
    state.repaymentPlan.years.forEach(function (y) {
      if (y.index <= uptoIndex) total += sum(y.actualPayments, function (p) { return p.amount; });
    });
    return total;
  }

  function renderLoans() {
    var html = "";

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">还款储备金余额</h3><span class="big-number" style="font-size:20px;">' + money(reserveBalance()) + '</span></div>';
    html += '<div class="plan-actions">';
    html += '<button class="btn btn-primary btn-sm" id="reserveDepositBtn">存入</button>';
    html += '<button class="btn btn-outline btn-sm" id="reserveWithdrawBtn">支出/调整</button>';
    html += '<button class="btn btn-outline btn-sm" id="reserveHistoryBtn">流水</button>';
    html += '</div>';
    html += '<div class="history-list" id="reserveHistory" style="display:none;">';
    if (!state.reserveFund.transactions.length) {
      html += '<div class="hrow"><span>暂无流水</span></div>';
    } else {
      state.reserveFund.transactions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).forEach(function (t) {
        html += '<div class="hrow"><span>' + t.date + (t.note ? " · " + escapeHtml(t.note) : "") + '</span><span>' + (t.type === "deposit" ? "+" : "-") + money(t.amount) + '</span></div>';
      });
    }
    html += '</div>';
    html += '</div>';

    var totalPrincipal = totalLoanPrincipal();

    if (totalPrincipal > 0) {
      var totalActualPaidAll = 0;
      state.repaymentPlan.years.forEach(function (y) { totalActualPaidAll += sum(y.actualPayments, function (p) { return p.amount; }); });
      var allocatedTotal = totalActualPaidAll + reserveBalance();
      var remainingToAllocate = Math.max(0, totalPrincipal - allocatedTotal);
      var startDate = parseDate(state.repaymentPlan.startDate);
      var now = new Date();
      var monthsElapsed = Math.max(1, monthsBetween(startDate, now) + 1);
      var avgMonthlyAllocation = allocatedTotal / monthsElapsed;
      var targetEndDate = addMonths(startDate, state.repaymentPlan.targetYears * 12);

      html += '<div class="card">';
      html += '<h3>预计提前还清</h3>';
      if (remainingToAllocate <= 0) {
        html += '<div class="sub-number">🎉 已攒够/还清全部本金</div>';
      } else if (avgMonthlyAllocation <= 0) {
        html += '<div class="sub-number">暂无储备或还款记录，开始存入后即可推算</div>';
      } else {
        var monthsRemaining = Math.ceil(remainingToAllocate / avgMonthlyAllocation);
        var payoffDate = addMonths(now, monthsRemaining);
        var diffMonths = monthsBetween(payoffDate, targetEndDate);
        html += '<div class="sub-number">按目前平均每月 ' + money(avgMonthlyAllocation) + ' 的存入/还款速度推算</div>';
        html += '<div class="big-number" style="font-size:20px;">' + payoffDate.getFullYear() + '年' + (payoffDate.getMonth() + 1) + '月 还清</div>';
        if (diffMonths > 0) {
          html += '<div class="sub-number" style="color:var(--teal-dark);font-weight:600;">比原计划（' + state.repaymentPlan.targetYears + '年）提前约 ' + diffMonths + ' 个月</div>';
        } else if (diffMonths < 0) {
          html += '<div class="sub-number" style="color:var(--danger);font-weight:600;">比原计划（' + state.repaymentPlan.targetYears + '年）晚约 ' + (-diffMonths) + ' 个月</div>';
        } else {
          html += '<div class="sub-number">与原计划基本一致</div>';
        }
      }
      html += '</div>';
    }

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">贷款合同明细</h3><button class="link-btn" id="toggleContracts">展开/收起</button></div>';
    html += '<div class="sub-number">合计本金 ' + money(totalPrincipal) + ' · 共 ' + state.loanContracts.length + ' 笔</div>';
    html += '<div id="contractsList" style="display:none;margin-top:10px;">';
    state.loanContracts.forEach(function (c) {
      html += '<div class="list-item" data-contract-id="' + c.id + '">';
      html += '<div class="exp-main"><span>' + escapeHtml(c.term) + ' · ' + money(c.principal) + '</span>';
      html += '<span class="exp-note">编号 ' + escapeHtml(c.contractNo) + ' · 利率 ' + (c.rate * 100).toFixed(2) + '% · ' + escapeHtml(c.org) + '</span>';
      html += '<span class="exp-note">发放 ' + c.issueDate + ' · 到期 ' + c.dueDate + ' · 贴息至 ' + c.interestFreeUntil + '</span>';
      html += '</div>';
      html += '</div>';
    });
    html += '<div class="row" style="margin-top:10px;"><button class="btn btn-outline btn-block btn-sm" id="addContractBtn">+ 新增贷款合同</button></div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="section-title"><h2>6年还款进度</h2></div>';
    state.repaymentPlan.years.forEach(function (y) {
      var actualCum = yearActualCumulative(y.index);
      var remaining = Math.max(0, totalPrincipal - actualCum);
      var pct = y.targetCumulative > 0 ? Math.min(100, Math.round((actualCum / y.targetCumulative) * 100)) : 0;
      html += '<div class="card plan-card" data-year-idx="' + y.index + '">';
      html += '<div class="plan-head"><span class="plan-name">第' + y.index + '年 · ' + escapeHtml(y.periodLabel) + '</span><span>' + pct + '%</span></div>';
      html += '<div class="progress-track"><div class="progress-fill' + (actualCum > y.targetCumulative ? '' : '') + '" style="width:' + pct + '%"></div></div>';
      html += '<div class="plan-meta">本年目标还本 ' + money(y.targetAnnual) + ' · 累计目标 ' + money(y.targetCumulative) + '</div>';
      html += '<div class="plan-meta">累计实际已还 ' + money(actualCum) + ' · 剩余本金 ' + money(remaining) + '</div>';
      html += '<div class="plan-meta">当年应付利息：' + (y.annualInterest != null ? money(y.annualInterest) : '未登记') + '</div>';
      if (y.note) html += '<div class="plan-meta">备注：' + escapeHtml(y.note) + '</div>';
      html += '<div class="plan-actions">';
      html += '<button class="btn btn-primary btn-sm" data-year-pay="' + y.index + '">登记还本</button>';
      html += '<button class="btn btn-outline btn-sm" data-year-interest="' + y.index + '">登记利息</button>';
      html += '<button class="btn btn-outline btn-sm" data-year-history="' + y.index + '">记录</button>';
      html += '</div>';
      html += '<div class="history-list" id="yearHistory-' + y.index + '" style="display:none;">';
      if (!y.actualPayments.length) {
        html += '<div class="hrow"><span>暂无还款记录</span></div>';
      } else {
        y.actualPayments.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).forEach(function (p) {
          html += '<div class="hrow"><span>' + p.date + '</span><span>' + money(p.amount) + '</span></div>';
        });
      }
      html += '</div>';
      html += '</div>';
    });

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
          state.loanContracts.push(obj);
        }
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  function openYearPaymentModal(year) {
    var fields = [
      { key: "date", label: "实际操作日期", type: "date", value: todayStr() },
      { key: "amount", label: "还款金额", type: "number", value: round2(Math.max(0, Math.min(reserveBalance(), year.targetAnnual))) },
      { key: "source", label: "资金来源", type: "select", options: [{ value: "reserve", label: "从还款储备金余额中扣除" }, { value: "other", label: "其他资金来源（不扣储备金）" }], value: "reserve" }
    ];
    openFormModal({
      title: "登记还本 · 第" + year.index + "年",
      fields: fields,
      submitLabel: "确认登记",
      onSubmit: function (v) {
        var amount = parseFloat(v.amount);
        if (!v.date || isNaN(amount) || amount <= 0) {
          toast("请填写正确的日期和金额");
          return;
        }
        year.actualPayments.push({ id: uid(), date: v.date, amount: amount });
        if (v.source === "reserve") {
          state.reserveFund.transactions.push({ id: uid(), date: v.date, type: "withdraw", amount: amount, note: "用于第" + year.index + "年还本" });
        }
        saveState();
        closeModal();
        render();
        toast("已登记还本");
      }
    });
  }

  function openYearInterestModal(year) {
    var fields = [
      { key: "annualInterest", label: "当年应付利息（来自系统账单）", type: "number", value: year.annualInterest != null ? year.annualInterest : "" },
      { key: "note", label: "备注（可选）", type: "text", value: year.note || "" }
    ];
    openFormModal({
      title: "登记利息 · 第" + year.index + "年",
      fields: fields,
      submitLabel: "保存",
      onSubmit: function (v) {
        var val = parseFloat(v.annualInterest);
        year.annualInterest = isNaN(val) ? null : val;
        year.note = v.note;
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  function openReserveTxModal(type) {
    var fields = [
      { key: "date", label: "日期", type: "date", value: todayStr() },
      { key: "amount", label: "金额", type: "number", value: type === "deposit" ? round2(reserveMonthlyTarget()) : "" },
      { key: "note", label: "备注（可选）", type: "text", value: "" }
    ];
    openFormModal({
      title: type === "deposit" ? "存入还款储备金" : "储备金支出/调整",
      fields: fields,
      submitLabel: "确认",
      onSubmit: function (v) {
        var amount = parseFloat(v.amount);
        if (!v.date || isNaN(amount) || amount <= 0) {
          toast("请填写正确的日期和金额");
          return;
        }
        state.reserveFund.transactions.push({ id: uid(), date: v.date, type: type, amount: amount, note: v.note });
        saveState();
        closeModal();
        render();
        toast("已保存");
      }
    });
  }

  /* ---------------- Goals (financial: cash-flow calculator + savings goals) ---------------- */
  function goalCurrentAmount(goal) {
    return sum(goal.contributions, function (c) { return c.amount; });
  }

  function findOrCreatePersonalSavingsGoal() {
    var g = state.goals.find(function (x) { return x.name === "个人储蓄"; });
    if (!g) {
      g = { id: uid(), name: "个人储蓄", target: 0, targetDate: "", note: "", contributions: [] };
      state.goals.push(g);
    }
    return g;
  }

  function renderGoals() {
    var params = state.cashFlowParams;
    var cf = currentMonthCashFlow();
    var series = getCashFlowSeries(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 6);

    var html = "";

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">现金流参数</h3><button class="link-btn" id="editParamsBtn">编辑参数</button></div>';
    html += '<div class="sub-number">基本工资 ' + money(params.baseSalary) + ' · 交通补贴 ' + money(params.transportPerDay * params.transportDays) + '/月</div>';
    html += '<div class="sub-number">五险 ' + (params.insuranceRate * 100).toFixed(1) + '% · 公积金 ' + (params.housingFundRate * 100).toFixed(1) + '%（' + params.housingFundStartDate + ' 起）</div>';
    html += '<div class="sub-number">生活开销合计 ' + money(params.lifeExpenseCommute + params.lifeExpenseFood + params.lifeExpenseFamily + params.lifeExpensePersonal) + '/月 · 目标还款年限 ' + state.repaymentPlan.targetYears + ' 年</div>';
    html += '<div class="sub-number">每月还款储备目标 ' + money(reserveMonthlyTarget()) + '</div>';
    html += '</div>';

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">' + (cf.confirmed ? '本月工资（已确认）' : '本月测算（估算）') + ' · ' + cf.monthLabel + '</h3><button class="link-btn" id="confirmSalaryBtn">' + (cf.confirmed ? '修改' : '确认工资') + '</button></div>';
    html += '<div class="row"><span>到手工资</span><span>' + money(cf.netPay) + '</span></div>';
    html += '<div class="row"><span>结余</span><span>' + money(cf.surplus) + '</span></div>';
    html += '<div class="row"><span>划入还款储备</span><span>' + money(cf.reserveSplit) + '</span></div>';
    html += '<div class="row"><span>划入个人储蓄</span><span>' + money(cf.savingsSplit) + '</span></div>';
    if (!cf.confirmed) html += '<div class="sub-number">这是按现金流参数估算的数字，实际工资以工资条为准——拿到工资条后点"确认工资"填入实发数额</div>';
    html += '<button class="btn btn-primary btn-block" id="registerMonthBtn" style="margin-top:10px;">登记本月存入</button>';
    html += '</div>';

    html += '<div class="card">';
    html += '<div class="row"><h3 style="margin:0;">未来6个月测算</h3><button class="link-btn" id="toggleSalaryHistory">工资记录</button></div>';
    series.forEach(function (r) {
      html += '<div class="row"><span>' + r.monthLabel + (r.confirmed ? ' ✓' : '') + '</span><span>到手 ' + money(r.netPay) + ' · 储备 ' + money(r.reserveSplit) + ' · 储蓄 ' + money(r.savingsSplit) + '</span></div>';
    });
    html += '<div class="history-list" id="salaryHistory" style="display:none;">';
    if (!state.salaryRecords.length) {
      html += '<div class="hrow"><span>暂无确认记录</span></div>';
    } else {
      state.salaryRecords.slice().sort(function (a, b) { return b.month.localeCompare(a.month); }).forEach(function (r) {
        html += '<div class="hrow"><span>' + r.month + (r.note ? " · " + escapeHtml(r.note) : "") + '</span><span>' + money(r.actualNetPay) + '</span></div>';
      });
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="section-title"><h2>理财 / 储蓄目标</h2></div>';
    if (!state.goals.length) {
      html += '<div class="card empty-state">暂无理财目标，点击下方按钮新增</div>';
    } else {
      state.goals.forEach(function (goal) {
        var current = goalCurrentAmount(goal);
        var hasTarget = Number(goal.target) > 0;
        var pct = hasTarget ? Math.min(100, Math.round((current / goal.target) * 100)) : null;
        html += '<div class="card plan-card" data-goal-id="' + goal.id + '">';
        html += '<div class="plan-head"><span class="plan-name">' + escapeHtml(goal.name) + '</span>' + (pct != null ? '<span>' + pct + '%</span>' : '') + '</div>';
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
      { key: "name", label: "目标名称（如：应急基金/买车）", type: "text", value: existing ? existing.name : "" },
      { key: "target", label: "目标金额（不设目标可填0）", type: "number", value: existing ? existing.target : "0" },
      { key: "targetDate", label: "目标日期（可选）", type: "date", value: existing ? existing.targetDate : "" },
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
        if (existing) {
          existing.name = v.name;
          existing.target = isNaN(target) ? 0 : target;
          existing.targetDate = v.targetDate;
          existing.note = v.note;
        } else {
          state.goals.push({ id: uid(), name: v.name, target: isNaN(target) ? 0 : target, targetDate: v.targetDate, note: v.note, contributions: [] });
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
      { key: "targetYears", label: "目标还款年限(年)", type: "number", value: state.repaymentPlan.targetYears },
      { key: "reserveMonthlyOverride", label: "每月还款储备目标（留空则自动=总本金/年限/12）", type: "number", value: p.reserveMonthlyOverride != null ? p.reserveMonthlyOverride : "" }
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
        var ty = parseInt(v.targetYears, 10);
        if (ty > 0 && ty !== state.repaymentPlan.targetYears) {
          state.repaymentPlan.targetYears = ty;
        }
        var override = parseFloat(v.reserveMonthlyOverride);
        p.reserveMonthlyOverride = isNaN(override) ? null : override;
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
      html += '<span class="chip" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + ' ✕</span>';
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
        state = Object.assign(defaultState(), data);
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
          if (type === "repay") {
            var now = new Date();
            var activeYear = state.repaymentPlan.years.find(function (y, idx) {
              var start = addMonths(parseDate(state.repaymentPlan.startDate), idx * 12);
              var end = addMonths(parseDate(state.repaymentPlan.startDate), (idx + 1) * 12);
              return now >= start && now < end;
            }) || state.repaymentPlan.years[0];
            if (activeYear) openYearPaymentModal(activeYear);
          }
          if (type === "reserve") openReserveTxModal("deposit");
        });
      });
      var icsBtn = document.getElementById("exportIcsBtn");
      if (icsBtn) icsBtn.addEventListener("click", exportKeyDatesIcs);
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
      document.getElementById("reserveDepositBtn").addEventListener("click", function () { openReserveTxModal("deposit"); });
      document.getElementById("reserveWithdrawBtn").addEventListener("click", function () { openReserveTxModal("withdraw"); });
      document.getElementById("reserveHistoryBtn").addEventListener("click", function () {
        var box = document.getElementById("reserveHistory");
        box.style.display = box.style.display === "none" ? "block" : "none";
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
      document.querySelectorAll("[data-year-pay]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var y = state.repaymentPlan.years.find(function (x) { return x.index === parseInt(btn.dataset.yearPay, 10); });
          if (y) openYearPaymentModal(y);
        });
      });
      document.querySelectorAll("[data-year-interest]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var y = state.repaymentPlan.years.find(function (x) { return x.index === parseInt(btn.dataset.yearInterest, 10); });
          if (y) openYearInterestModal(y);
        });
      });
      document.querySelectorAll("[data-year-history]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var box = document.getElementById("yearHistory-" + btn.dataset.yearHistory);
          if (box) box.style.display = box.style.display === "none" ? "block" : "none";
        });
      });
    }

    if (page === "goals") {
      document.getElementById("editParamsBtn").addEventListener("click", openCashFlowParamsModal);
      document.getElementById("confirmSalaryBtn").addEventListener("click", function () {
        var now = new Date();
        var mKey = monthKey(fmtDate(now));
        var existing = getConfirmedSalary(mKey);
        openFormModal({
          title: "确认本月工资 · " + monthLabel(mKey),
          fields: [
            { key: "actualNetPay", label: "本月实发工资（工资条上的实发数额）", type: "number", value: existing ? existing.actualNetPay : "" },
            { key: "note", label: "备注（可选）", type: "text", value: existing ? existing.note : "" }
          ],
          submitLabel: "保存",
          showDelete: !!existing,
          onDelete: function () {
            state.salaryRecords = state.salaryRecords.filter(function (r) { return r.month !== mKey; });
            saveState();
            closeModal();
            render();
            toast("已删除，改回按测算值显示");
          },
          onSubmit: function (v) {
            var amount = parseFloat(v.actualNetPay);
            if (isNaN(amount) || amount <= 0) { toast("请填写正确的实发工资"); return; }
            if (existing) {
              existing.actualNetPay = amount;
              existing.note = v.note;
            } else {
              state.salaryRecords.push({ id: uid(), month: mKey, actualNetPay: amount, note: v.note });
            }
            saveState();
            closeModal();
            render();
            toast("已确认本月工资");
          }
        });
      });
      document.getElementById("toggleSalaryHistory").addEventListener("click", function () {
        var box = document.getElementById("salaryHistory");
        box.style.display = box.style.display === "none" ? "block" : "none";
      });
      document.getElementById("registerMonthBtn").addEventListener("click", function () {
        var cf = currentMonthCashFlow();
        openFormModal({
          title: "登记本月存入 · " + cf.monthLabel,
          fields: [
            { key: "date", label: "日期", type: "date", value: todayStr() },
            { key: "reserveAmount", label: "存入还款储备金", type: "number", value: cf.reserveSplit },
            { key: "savingsAmount", label: "存入个人储蓄", type: "number", value: cf.savingsSplit }
          ],
          submitLabel: "确认登记",
          onSubmit: function (v) {
            var r = parseFloat(v.reserveAmount) || 0;
            var s = parseFloat(v.savingsAmount) || 0;
            if (r > 0) state.reserveFund.transactions.push({ id: uid(), date: v.date, type: "deposit", amount: r, note: cf.monthLabel + (cf.confirmed ? " 实际工资" : " 现金流测算") });
            if (s > 0) {
              var goal = findOrCreatePersonalSavingsGoal();
              goal.contributions.push({ id: uid(), date: v.date, amount: s });
            }
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

  /* ---------------- Init ---------------- */
  navigate("home");

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function (err) {
        console.warn("Service worker 注册失败", err);
      });
    });
  }
})();
