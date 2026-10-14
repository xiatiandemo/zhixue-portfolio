/* ==========================================================================
   站点交互脚本
   纯静态零构建：不依赖任何框架，直接用浏览器原生 API
   职责：
     1. 由 data/works.js 的数据渲染作品列表与作品详情页
     2. 图片灯箱（缩放 / 平移 / 键盘 / 触摸）
     3. 滚动淡入、导航交互、一键复制联系方式
   ========================================================================== */
(function () {
  "use strict";

  var DATA = window.PORTFOLIO || { site: {}, works: [] };
  var SITE = DATA.site || {};
  var WORKS = Array.isArray(DATA.works) ? DATA.works : [];

  /* ----------------------------------------------------------------------
     小工具
     ---------------------------------------------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /** 转义为 HTML 安全文本（数据里的文本字段走这里，富文本字段故意不走） */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** 该字段是否有内容（空数组 / 空串 / 空对象都算没有） */
  function has(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  }

  /** 图片路径编码：兼容中文文件名，也兼容路径里的空格 */
  function imgSrc(p) {
    return String(p).split("/").map(encodeURIComponent).join("/");
  }

  function byId(id) {
    for (var i = 0; i < WORKS.length; i++) if (WORKS[i].id === id) return WORKS[i];
    return null;
  }

  /* ----------------------------------------------------------------------
     站点基础信息回填（data 里的占位内容 → 页面）
     ---------------------------------------------------------------------- */
  function applySiteInfo() {
    $$("[data-site]").forEach(function (el) {
      var key = el.getAttribute("data-site");
      if (key === "year") { el.textContent = new Date().getFullYear(); return; }
      if (key === "name") { el.textContent = SITE.name || ""; return; }
      if (key === "brand") { el.textContent = SITE.brand || "作品集"; return; }
      if (has(SITE[key])) el.textContent = SITE[key];
    });

    $$("[data-site-href]").forEach(function (el) {
      var key = el.getAttribute("data-site-href");
      var val = SITE[key];
      if (!has(val)) { el.remove(); return; }
      el.href = key === "email" ? "mailto:" + val : val;
      if (key !== "email") { el.target = "_blank"; el.rel = "noopener noreferrer"; }
    });
  }

  /* ----------------------------------------------------------------------
     联系按钮：由 contactCodes 解码后生成，避免明文出现在页面源码中
     ---------------------------------------------------------------------- */
  var CONTACT_FIELDS = [
    { key: "email",  label: "复制邮箱",  type: "copy" },
    { key: "wechat", label: "复制微信",  type: "copy" },
    { key: "github", label: "GitHub",    type: "link" }
  ];

  /** 字符码数组 → 明文字符串 */
  function decodeCodes(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    var s = "";
    for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return s;
  }

  /** 取联系方式的明文：优先用字符码解码，兼容直接写字符串的老写法 */
  function contactValue(key) {
    var codes = (SITE.contactCodes || {})[key];
    var v = decodeCodes(codes);
    if (!v && typeof SITE[key] === "string") v = SITE[key];
    return v || "";
  }

  function renderContact() {
    var box = $("#contact-actions");
    if (!box) return;

    var html = "";
    CONTACT_FIELDS.forEach(function (f) {
      var val = contactValue(f.key);
      if (!val) return;

      if (f.type === "copy") {
        // 明文只写进 data 属性，且按钮文案不含明文
        html += '<button class="btn btn--ghost" type="button" data-copy="' + esc(val) + '">' +
          esc(f.label) + "</button>";
      } else {
        var href = f.key === "email" ? "mailto:" + val : val;
        html += '<a class="btn btn--primary" href="' + esc(href) + '"' +
          (f.key === "email" ? "" : ' target="_blank" rel="noopener noreferrer"') + ">" +
          esc(f.label) + "</a>";
      }
    });

    if (!html) {
      html = '<p style="color:var(--text-subtle);font-size:14.5px;margin:0">' +
        "请在 data/works.js 的 SITE.contactCodes 中填写联系方式。</p>";
    }
    box.innerHTML = html;

    // 说明文字
    var note = $("#contact-note");
    if (note) {
      if (has(SITE.contactNote)) { note.textContent = SITE.contactNote; }
      else { note.remove(); }
    }
  }

  /* ----------------------------------------------------------------------
     滚动淡入
     只有脚本成功运行时才给 <html> 加 js-reveal，从而启用「先隐藏再淡入」。
     这样：脚本没跑 → 内容正常可见；脚本跑了但观察器不触发 → 兜底全部显示。
     ---------------------------------------------------------------------- */
  function initReveal(root) {
    var items = $$(".reveal:not(.is-in)", root || document);
    if (!items.length) return;

    // 标记脚本已接管（CSS 依据此标记才隐藏元素）
    document.documentElement.classList.add("js-reveal");

    function showAll() {
      items.forEach(function (el) { el.classList.add("is-in"); });
    }

    if (!("IntersectionObserver" in window)) { showAll(); return; }

    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

    items.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 60 + "ms";
      io.observe(el);
    });

    // 兜底：4 秒后仍有未显示的元素，说明观察器未能正常工作，直接全部显示
    setTimeout(function () {
      if (done) return;
      done = true;
      var hidden = items.filter(function (el) { return !el.classList.contains("is-in"); });
      if (hidden.length) showAll();
    }, 4000);
  }

  /* ----------------------------------------------------------------------
     卡片 / 元信息 片段
     ---------------------------------------------------------------------- */
  function tagRow(tags, accentFirst) {
    if (!has(tags)) return "";
    return '<div class="tag-row">' + tags.map(function (t, i) {
      var cls = (accentFirst && i === 0) ? "tag tag--accent" : "tag";
      return '<span class="' + cls + '">' + esc(t) + "</span>";
    }).join("") + "</div>";
  }

  function coverMarkup(w, opts) {
    opts = opts || {};
    var fit = w.coverFit === "contain" ? " work-thumb--contain" : "";
    if (!has(w.cover)) {
      return '<div class="work-thumb' + fit + '"><div style="display:flex;align-items:center;' +
        'justify-content:center;height:100%;color:var(--text-subtle);font-size:13px">' +
        "待补充封面</div></div>";
    }
    return '<div class="work-thumb' + fit + '">' +
      '<img src="' + imgSrc(w.cover) + '" alt="' + esc(w.coverAlt || w.title) + '"' +
      (opts.eager ? "" : ' loading="lazy" decoding="async"') + ">" +
      "</div>";
  }

  function workCard(w) {
    return '<a class="work-card card reveal" href="work.html?id=' + encodeURIComponent(w.id) + '">' +
      coverMarkup(w) +
      '<div class="work-body">' +
        "<h3 class=\"work-name\">" + esc(w.title) + "</h3>" +
        '<p class="work-desc">' + esc(w.summary || w.lead || "") + "</p>" +
        '<div class="work-foot">' +
          '<span>' + esc(w.category || "") + "</span>" +
          '<span>' + (has(w.tags) ? esc(w.tags.length + " 个标签") : "") + "</span>" +
        "</div>" +
      "</div>" +
    "</a>";
  }

  /** 作品不足 3 件时用虚线占位卡撑住版面；作品变多后自动消失 */
  function placeholderCards(existing, target) {
    var need = Math.max(0, (target || 3) - existing);
    var out = "";
    for (var i = 0; i < need; i++) {
      out += '<div class="work-card card work-card--placeholder reveal">' +
        '<div class="placeholder-icon">+</div>' +
        "<h3 class=\"work-name\" style=\"font-size:16px\">更多作品筹备中</h3>" +
        '<p style="font-size:13.5px;margin:8px 0 0">持续扩充中</p>' +
      "</div>";
    }
    return out;
  }

  /* ----------------------------------------------------------------------
     首页
     ---------------------------------------------------------------------- */
  function renderHome() {
    if (!$("#works-grid")) return;

    // Hero 文案
    var hero = $("#hero-title");
    if (hero && has(SITE.titleLines)) {
      hero.innerHTML = SITE.titleLines.map(function (line, i) {
        return i === SITE.titleLines.length - 1
          ? '<span class="grad">' + esc(line) + "</span>"
          : esc(line);
      }).join("<br>");
    }
    var lead = $("#hero-lead");
    if (lead && has(SITE.lead)) lead.textContent = SITE.lead;

    var badge = $("#hero-badge-text");
    if (badge && has(SITE.badge)) badge.textContent = SITE.badge;

    var stats = $("#hero-stats");
    if (stats && has(SITE.stats)) {
      stats.innerHTML = SITE.stats.map(function (s) {
        return "<div><span class=\"stat-num\">" + esc(s.num) + "</span>" +
          '<span class="stat-label">' + esc(s.label) + "</span></div>";
      }).join("");
    }

    // 精选作品
    var feat = $("#feature-slot");
    if (feat) {
      var w = WORKS[0];
      if (!w) {
        feat.innerHTML = '<div class="card" style="padding:44px;text-align:center;color:var(--text-muted)">' +
          "还没有作品。请在 data/works.js 中添加。</div>";
      } else {
        feat.innerHTML = '<article class="feature card reveal">' +
          '<div class="feature-media">' +
            (has(w.cover)
              ? '<img src="' + imgSrc(w.cover) + '" alt="' + esc(w.coverAlt || w.title) + '" decoding="async">'
              : "") +
          "</div>" +
          '<div class="feature-body">' +
            tagRow(w.tags, true) +
            '<h3 class="feature-name">' + esc(w.title) + "</h3>" +
            (has(w.subtitle) ? '<p class="feature-sub">' + esc(w.subtitle) + "</p>" : "") +
            '<p class="feature-desc">' + esc(w.summary || w.lead || "") + "</p>" +
            '<div class="feature-meta">' +
              (has(w.category) ? '<span class="tag">' + esc(w.category) + "</span>" : "") +
              (has(w.role) ? '<span class="tag">' + esc(w.role) + "</span>" : "") +
              (has(w.period) ? '<span class="tag">' + esc(w.period) + "</span>" : "") +
            "</div>" +
            '<a class="feature-link" href="work.html?id=' + encodeURIComponent(w.id) + '">' +
              "查看完整案例 <span aria-hidden=\"true\">→</span></a>" +
          "</div>" +
        "</article>";
      }
    }

    // 全部作品网格
    var grid = $("#works-grid");
    grid.innerHTML = WORKS.map(workCard).join("") + placeholderCards(WORKS.length, 3);

    // 关于我
    var about = $("#about-grid");
    if (about && has(SITE.about)) {
      about.innerHTML = SITE.about.map(function (a) {
        return '<div class="about-card card reveal">' +
          '<div class="about-icon" aria-hidden="true">' + esc(a.icon || "◈") + "</div>" +
          "<h3>" + esc(a.title) + "</h3>" +
          "<p>" + esc(a.text) + "</p>" +
        "</div>";
      }).join("");
    }

    // 联系区
    var ct = $("#contact-title");
    if (ct && has(SITE.contactTitle)) ct.textContent = SITE.contactTitle;
    var cx = $("#contact-text");
    if (cx && has(SITE.contactText)) cx.textContent = SITE.contactText;
  }

  /* ----------------------------------------------------------------------
     作品列表页
     ---------------------------------------------------------------------- */
  function renderWorksPage() {
    var grid = $("#works-page-grid");
    if (!grid) return;

    var countEl = $("#works-count");
    if (countEl) countEl.textContent = WORKS.length;

    if (!WORKS.length) {
      grid.innerHTML = '<p style="color:var(--text-muted)">还没有作品。</p>';
      return;
    }
    grid.innerHTML = WORKS.map(workCard).join("");
  }

  /* ----------------------------------------------------------------------
     作品详情页
     ---------------------------------------------------------------------- */
  function renderDetail() {
    var root = $("#work-detail");
    if (!root) return;

    var id = new URLSearchParams(location.search).get("id");
    var w = byId(id) || WORKS[0];

    if (!w) {
      root.innerHTML = '<div class="container" style="padding:90px 28px;text-align:center">' +
        "<h1>作品不存在</h1>" +
        '<p style="color:var(--text-muted);margin-top:14px">' +
        '<a href="works.html" style="color:var(--mint)">返回作品列表</a></p></div>';
      return;
    }

    document.title = w.title + " · " + (SITE.name || "作品集");

    var html = "";

    /* --- 头部 --- */
    html += '<header class="detail-hero"><div class="container">' +
      '<a class="back-link" href="works.html"><span aria-hidden="true">←</span> 返回作品列表</a>' +
      (has(w.tags) ? tagRow(w.tags, true) : "") +
      '<h1 class="detail-title" style="margin-top:16px">' + esc(w.title) + "</h1>" +
      (has(w.subtitle) ? '<p class="detail-sub">' + esc(w.subtitle) + "</p>" : "") +
      (has(w.lead) ? '<p class="detail-lead">' + esc(w.lead) + "</p>" : "") +
    "</div></header>";

    /* --- 元信息条 --- */
    var metas = [
      ["作品类型", w.category],
      ["我的角色", w.role],
      ["时间", w.period],
      ["标签", has(w.tags) ? w.tags.join(" / ") : ""]
    ].filter(function (m) { return has(m[1]); });

    if (metas.length) {
      html += '<div class="container" style="max-width:940px">' +
        '<div class="meta-bar reveal">' +
        metas.map(function (m) {
          return '<div class="meta-item"><span class="meta-key">' + esc(m[0]) + "</span>" +
            '<span class="meta-val">' + esc(m[1]) + "</span></div>";
        }).join("") +
        "</div></div>";
    }

    /* --- 背景与目标 --- */
    if (has(w.background)) {
      html += section("背景与目标", w.background, "问题是什么，为什么要做");
    }

    /* --- 设计思路 --- */
    if (has(w.approach)) {
      html += section("设计思路", w.approach, "为什么这样设计");
    }

    /* --- 架构总览 --- */
    if (has(w.overview) && has(w.overview.src)) {
      var ov = w.overview;
      html += '<section class="detail-section detail-section--wide"><div class="container">' +
        sectionHead("架构总览", "点击图片可放大、缩放、拖拽查看") +
        '<div class="overview-wrap reveal">' +
          '<button class="plate" type="button" data-zoom="' + esc(imgSrc(ov.full || ov.src)) + '"' +
            ' data-caption="' + esc(ov.caption || w.title) + '"' +
            ' style="cursor:zoom-in;width:100%;text-align:left;font:inherit">' +
            '<img src="' + imgSrc(ov.src) + '" alt="' + esc(ov.caption || w.title) + '"' +
            ' decoding="async">' +
          "</button>" +
          (has(ov.caption) ? '<p style="margin-top:14px;font-size:13.5px;color:var(--text-subtle)">' +
            esc(ov.caption) + "</p>" : "") +
        "</div>" +
      "</div></section>";
    }

    /* --- 分层解读 --- */
    if (has(w.layers)) {
      html += '<section class="detail-section detail-section--wide"><div class="container">' +
        sectionHead("分层解读", "拆开看每一层负责什么，以及为什么这样切 · 点击图片可放大") +
        w.layers.map(function (L, i) {
          return '<div class="layer-item reveal" data-layer="' + (i + 1) + '">' +
            (has(L.image)
              ? '<div class="layer-media">' +
                  '<button type="button" data-zoom="' + esc(imgSrc(L.image)) + '"' +
                  ' data-caption="' + esc(L.name) + '"' +
                  ' style="display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in">' +
                  '<img src="' + imgSrc(L.image) + '" alt="' + esc(L.name) + '"' +
                  ' loading="lazy" decoding="async"></button>' +
                "</div>"
              : "") +
            '<div class="layer-head">' +
              '<span class="layer-index"><span class="bar"></span>第 ' + (i + 1) + " 层</span>" +
              '<h3 class="layer-name">' + esc(L.name) + "</h3>" +
              (has(L.text) ? '<p class="layer-text">' + esc(L.text) + "</p>" : "") +
              '<div class="layer-body">' +
                (has(L.points) ? '<ul class="layer-points">' + L.points.map(function (p) {
                  return "<li>" + esc(p) + "</li>";
                }).join("") + "</ul>" : "") +
                (has(L.note) ? '<p class="layer-note">' + esc(L.note) + "</p>" : "") +
              "</div>" +
            "</div>" +
          "</div>";
        }).join("") +
      "</div></section>";
    }

    /* --- 能力清单（原子能力） --- */
    if (has(w.skills)) {
      // 按功能域归组，保持数据里首次出现的顺序
      var order = [];
      var groups = {};
      w.skills.forEach(function (s) {
        var d = s.domain || "其他";
        if (!groups[d]) { groups[d] = []; order.push(d); }
        groups[d].push(s);
      });

      html += '<section class="detail-section detail-section--wide"><div class="container">' +
        sectionHead("能力清单", "共 " + w.skills.length + " 个原子能力 · 每个能力独立可评测、可替换") +
        order.map(function (d) {
          return '<div class="skill-group reveal">' +
            '<div class="skill-group-head">' +
              '<h3 class="skill-domain">' + esc(d) + "</h3>" +
              '<span class="skill-count">' + groups[d].length + " 项</span>" +
            "</div>" +
            '<div class="skill-grid">' +
            groups[d].map(function (s) {
              return '<div class="skill-card">' +
                '<div class="skill-top"><span class="skill-id">' + esc(s.id) + "</span>" +
                '<span class="skill-name">' + esc(s.name) + "</span></div>" +
                '<div class="skill-fn">' + esc(s.fn || "") + "</div>" +
                (has(s.note) ? '<p class="skill-note">' + esc(s.note) + "</p>" : "") +
              "</div>";
            }).join("") +
            "</div>" +
          "</div>";
        }).join("") +
      "</div></section>";
    }

    /* --- 三大核心机制 --- */
    if (has(w.mechanisms)) {
      html += '<section class="detail-section"><div class="container">' +
        sectionHead("核心机制", "支撑这套架构运转的三条关键规则") +
        w.mechanisms.map(function (m, i) {
          return '<div class="mech-card reveal">' +
            '<div class="mech-head">' +
              '<span class="mech-num">' + (i + 1) + "</span>" +
              '<h3 class="mech-name">' + esc(m.name) + "</h3>" +
            "</div>" +
            (has(m.text) ? '<p class="mech-text">' + esc(m.text) + "</p>" : "") +
            (has(m.points) ? '<ul class="mech-points">' + m.points.map(function (p) {
              return "<li>" + esc(p) + "</li>";
            }).join("") + "</ul>" : "") +
          "</div>";
        }).join("") +
      "</div></section>";
    }

    /* --- 应用场景 --- */
    if (has(w.scenarios)) {
      html += '<section class="detail-section"><div class="container">' +
        sectionHead("应用场景", "同一套能力，在不同学习目标下组合出不同链路") +
        w.scenarios.map(function (s) {
          return '<div class="scene reveal">' +
            '<div class="scene-side"><h3 class="scene-name">' + esc(s.name) + "</h3></div>" +
            '<div class="scene-main">' +
              (has(s.scene) ? '<p class="scene-text">' + esc(s.scene) + "</p>" : "") +
              (has(s.chain) ? '<div class="scene-chain"><span class="chain-label">调用链路</span>' +
                '<code>' + esc(s.chain) + "</code></div>" : "") +
              (has(s.value) ? '<p class="scene-value">' + esc(s.value) + "</p>" : "") +
            "</div>" +
          "</div>";
        }).join("") +
      "</div></section>";
    }

    /* --- 端到端示例 --- */
    if (has(w.demo)) {
      html += '<section class="detail-section"><div class="container">' +
        sectionHead("端到端示例", "把 17 个能力串起来跑一遍，看闭环是否真的成立") +
        '<div class="demo-box reveal">' +
          (has(w.demo.title) ? '<h3 class="demo-title">' + esc(w.demo.title) + "</h3>" : "") +
          (has(w.demo.steps) ? '<ol class="demo-steps">' + w.demo.steps.map(function (s) {
            return "<li>" + esc(s) + "</li>";
          }).join("") + "</ol>" : "") +
        "</div>" +
      "</div></section>";
    }

    /* --- 目标用户 --- */
    if (has(w.audience)) {
      html += '<section class="detail-section"><div class="container">' +
        sectionHead("目标用户", "这套系统为谁而做") +
        '<div class="aud-grid">' + w.audience.map(function (a) {
          return '<div class="aud-card reveal">' +
            '<h3 class="aud-group">' + esc(a.group) + "</h3>" +
            '<p class="aud-need">' + esc(a.need || "") + "</p>" +
            (has(a.usage) ? '<p class="aud-usage">' + esc(a.usage) + "</p>" : "") +
          "</div>";
        }).join("") + "</div>" +
      "</div></section>";
    }

    /* --- 非功能需求 --- */
    if (has(w.requirements)) {
      html += '<section class="detail-section detail-section--wide"><div class="container">' +
        sectionHead("非功能需求", "性能、可靠性、可用性等可验收的具体标准") +
        '<div class="req-table reveal">' +
          '<div class="req-row req-row--head">' +
            '<span class="req-cat">类别</span><span class="req-item">需求项</span>' +
            '<span class="req-std">说明 / 标准</span>' +
          "</div>" +
          w.requirements.map(function (r) {
            return '<div class="req-row">' +
              '<span class="req-cat">' + esc(r.category) + "</span>" +
              '<span class="req-item">' + esc(r.item) + "</span>" +
              '<span class="req-std">' + esc(r.standard) + "</span>" +
            "</div>";
          }).join("") +
        "</div>" +
      "</div></section>";
    }

    /* --- 核心闭环 --- */
    if (has(w.loop)) {
      html += '<section class="detail-section"><div class="container">' +
        sectionHead("核心闭环", "让系统能自我校准的那条回路") +
        '<div class="loop-callout reveal">' +
          '<div class="loop-num" aria-hidden="true">↻</div>' +
          "<div>" +
            (has(w.loop.title) ? '<h3 style="font-size:17px;margin-bottom:8px">' +
              esc(w.loop.title) + "</h3>" : "") +
            (has(w.loop.text) ? '<p style="color:var(--text-muted);font-size:15.4px">' +
              esc(w.loop.text) + "</p>" : "") +
          "</div>" +
        "</div>" +
      "</div></section>";
    }

    /* --- 亮点与难点 --- */
    if (has(w.highlights)) {
      html += section("亮点与难点", w.highlights, "哪些设计我认为是对的，哪些还有风险");
    }

    /* --- 后续规划 --- */
    if (has(w.roadmap)) {
      var rm = Array.isArray(w.roadmap)
        ? "<ul>" + w.roadmap.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>"
        : w.roadmap;
      html += section("后续规划", rm, "这件作品接下来会怎么演进");
    }

    /* --- 上一件 / 下一件 --- */
    var idx = WORKS.indexOf(w);
    if (WORKS.length > 1) {
      var prev = idx > 0 ? WORKS[idx - 1] : null;
      var next = idx < WORKS.length - 1 ? WORKS[idx + 1] : null;
      html += '<section class="detail-section"><div class="container">' +
        '<div class="pager">' +
          (prev
            ? '<a class="pager-link" href="work.html?id=' + encodeURIComponent(prev.id) + '">' +
              "<span>← 上一件</span><strong>" + esc(prev.title) + "</strong></a>"
            : "<div></div>") +
          (next
            ? '<a class="pager-link pager-link--next" href="work.html?id=' + encodeURIComponent(next.id) + '">' +
              "<span>下一件 →</span><strong>" + esc(next.title) + "</strong></a>"
            : "<div></div>") +
        "</div>" +
      "</div></section>";
    }

    root.innerHTML = html;

    function sectionHead(title, desc) {
      return '<div class="section-head"><h2 class="section-title">' + esc(title) + "</h2>" +
        (has(desc) ? '<p class="section-desc">' + esc(desc) + "</p>" : "") + "</div>";
    }
    function section(title, body, desc, wide) {
      return '<section class="detail-section' + (wide ? " detail-section--wide" : "") +
        '"><div class="container">' +
        sectionHead(title, desc) +
        '<div class="prose reveal">' + body + "</div>" +
      "</div></section>";
    }
  }

  /* ----------------------------------------------------------------------
     灯箱：缩放 / 平移 / 键盘 / 触摸
     ---------------------------------------------------------------------- */
  var LB = {
    el: null, img: null, cap: null, scaleEl: null, stage: null,
    scale: 1, tx: 0, ty: 0, nat: { w: 0, h: 0 },
    dragging: false, moved: false, lastX: 0, lastY: 0,
    pinch: null, lastFocus: null,
    zoomed: false, panX: 0, panY: 0, startX: 0, startY: 0
  };

  function lbBuild() {
    var el = document.createElement("div");
    el.className = "lightbox";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "图片查看");
    el.innerHTML =
      '<div class="lightbox-bar">' +
        '<div class="lightbox-cap"></div>' +
        '<div class="lightbox-tools">' +
          '<button class="lb-btn" data-lb="out" title="缩小（-）" aria-label="缩小">−</button>' +
          '<span class="lb-scale">100%</span>' +
          '<button class="lb-btn" data-lb="in" title="放大（+）" aria-label="放大">+</button>' +
          '<button class="lb-btn" data-lb="reset" title="重置（0）" aria-label="重置">↺</button>' +
          '<button class="lb-btn" data-lb="close" title="关闭（Esc）" aria-label="关闭">✕</button>' +
        "</div>" +
      "</div>" +
      '<div class="lightbox-stage">' +
        '<img alt="">' +
        '<button class="lb-btn lb-nav lb-nav--prev" data-lb="prev" title="上一张" aria-label="上一张">‹</button>' +
        '<button class="lb-btn lb-nav lb-nav--next" data-lb="next" title="下一张" aria-label="下一张">›</button>' +
      "</div>" +
      '<div class="lightbox-hint">滚轮或 +/− 缩放 · 放大后拖拽平移 · 方向键切换图片 · Esc 关闭</div>';
    document.body.appendChild(el);

    LB.el = el;
    LB.img = $("img", el);
    LB.cap = $(".lightbox-cap", el);
    LB.scaleEl = $(".lb-scale", el);
    LB.stage = $(".lightbox-stage", el);

    el.addEventListener("click", function (e) {
      var act = e.target.closest("[data-lb]");
      if (act) { actLb(act.getAttribute("data-lb")); return; }
      // 点击空白背景关闭
      if (e.target === el || e.target === LB.stage) closeLb();
    });

    LB.img.addEventListener("load", function () {
      LB.nat.w = LB.img.naturalWidth;
      LB.nat.h = LB.img.naturalHeight;
      resetLb(true);
    });

    // 滚轮缩放
    LB.stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      var factor = Math.exp(-e.deltaY * 0.0016);
      zoomAt(e.clientX, e.clientY, LB.scale * factor);
    }, { passive: false });

    // 指针拖拽 + 双指捏合
    LB.stage.addEventListener("pointerdown", function (e) {
      LB.stage.setPointerCapture(e.pointerId);
      if (LB.pinch) return;
      LB.dragging = true;
      LB.moved = false;
      LB.startX = e.clientX; LB.startY = e.clientY;
      LB.panX = LB.tx; LB.panY = LB.ty;
      LB.stage.classList.add("is-grabbing");
    });

    LB.stage.addEventListener("pointermove", function (e) {
      if (LB.pinch) return;   // 双指捏合由 touchmove 处理
      if (!LB.dragging) return;
      var dx = e.clientX - LB.startX, dy = e.clientY - LB.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) LB.moved = true;
      LB.tx = LB.panX + dx;
      LB.ty = LB.panY + dy;
      applyLb();
    });

    function endDrag(e) {
      if (LB.pinch) { LB.pinch = null; }
      LB.dragging = false;
      LB.stage.classList.remove("is-grabbing");
    }
    LB.stage.addEventListener("pointerup", endDrag);
    LB.stage.addEventListener("pointercancel", endDrag);

    // 双指捏合
    LB.stage.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        LB.pinch = {
          d0: dist2(e.touches),
          s0: LB.scale,
          cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          cy: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
        LB.dragging = false;
      }
    }, { passive: true });

    LB.stage.addEventListener("touchmove", function (e) {
      if (LB.pinch && e.touches.length === 2) {
        e.preventDefault();
        var f = dist2(e.touches) / LB.pinch.d0;
        zoomAt(LB.pinch.cx, LB.pinch.cy, LB.pinch.s0 * f);
      }
    }, { passive: false });

    LB.stage.addEventListener("touchend", function () { LB.pinch = null; }, { passive: true });

    function dist2(t) {
      var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.max(1, Math.sqrt(dx * dx + dy * dy));
    }

    // 键盘
    document.addEventListener("keydown", function (e) {
      if (!LB.el.classList.contains("is-open")) return;
      if (e.key === "Escape") { closeLb(); }
      else if (e.key === "+" || e.key === "=") { zoomAt(null, null, LB.scale * 1.3); }
      else if (e.key === "-" || e.key === "_") { zoomAt(null, null, LB.scale / 1.3); }
      else if (e.key === "0") { resetLb(); }
      else if (e.key === "ArrowLeft") { actLb("prev"); }
      else if (e.key === "ArrowRight") { actLb("next"); }
      else return;
      e.preventDefault();
    });
  }

  function dist2(t) {
    var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.max(1, Math.sqrt(dx * dx + dy * dy));
  }

  function applyLb() {
    LB.img.style.transform =
      "translate(" + LB.tx + "px," + LB.ty + "px) scale(" + LB.scale + ")";
    LB.scaleEl.textContent = Math.round(LB.scale * 100) + "%";
  }

  function clampLb(v) { return Math.min(9, Math.max(0.22, v)); }

  /** 以屏幕某点为锚点缩放（锚点为空则围绕中心） */
  function zoomAt(cx, cy, next) {
    var ns = clampLb(next);
    if (cx == null) {
      var r = LB.stage.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    }
    var r2 = LB.stage.getBoundingClientRect();
    var ox = cx - (r2.left + r2.width / 2);
    var oy = cy - (r2.top + r2.height / 2);
    var k = ns / LB.scale;
    LB.tx = ox - k * (ox - LB.tx);
    LB.ty = oy - k * (oy - LB.ty);
    LB.scale = ns;
    applyLb();
  }

  /** 重置为「适应窗口」的初始大小 */
  function resetLb(measure) {
    if (!LB.nat.w) return;
    var r = LB.stage.getBoundingClientRect();
    var pad = 48;
    var fit = Math.min((r.width - pad) / LB.nat.w, (r.height - pad) / LB.nat.h, 1);
    LB.scale = fit > 0 ? fit : 1;
    LB.tx = 0; LB.ty = 0;
    applyLb();
  }

  var lbList = [];
  var lbIndex = -1;

  function openLb(src, caption) {
    if (!LB.el) lbBuild();
    lbList = $$("[data-zoom]").map(function (b) {
      return { src: b.getAttribute("data-zoom"), caption: b.getAttribute("data-caption") || "" };
    });
    lbIndex = -1;
    for (var i = 0; i < lbList.length; i++) if (lbList[i].src === src) { lbIndex = i; break; }
    showLb({ src: src, caption: caption || "" });

    LB.lastFocus = document.activeElement;
    LB.el.classList.add("is-open");
    document.body.classList.add("is-locked");
    $("[data-lb='close']", LB.el).focus();
  }

  function showLb(item) {
    LB.nat.w = 0;
    LB.img.src = item.src;
    LB.img.alt = item.caption;
    LB.cap.textContent = item.caption;
    var multi = lbList.length > 1;
    $("[data-lb='prev']", LB.el).hidden = !multi;
    $("[data-lb='next']", LB.el).hidden = !multi;
    LB.scale = 1; LB.tx = 0; LB.ty = 0;
    applyLb();
    // 图片可能来自缓存，load 不会触发，因此主动测量一次
    if (LB.img.complete && LB.img.naturalWidth) {
      LB.nat.w = LB.img.naturalWidth;
      LB.nat.h = LB.img.naturalHeight;
      resetLb(true);
    }
  }

  function closeLb() {
    LB.el.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    LB.img.removeAttribute("src");
    if (LB.lastFocus && LB.lastFocus.focus) LB.lastFocus.focus();
  }

  function actLb(action) {
    if (action === "close") return closeLb();
    if (action === "in") return zoomAt(null, null, LB.scale * 1.3);
    if (action === "out") return zoomAt(null, null, LB.scale / 1.3);
    if (action === "reset") return resetLb();
    if (!lbList.length) return;
    var i = lbIndex < 0 ? 0 : lbIndex;
    if (action === "prev") i = (i - 1 + lbList.length) % lbList.length;
    if (action === "next") i = (i + 1) % lbList.length;
    lbIndex = i;
    showLb(lbList[i]);
  }

  /* 委托：任何 [data-zoom] 元素点击即打开灯箱 */
  function initLightboxTriggers() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-zoom]");
      if (!btn) return;
      e.preventDefault();
      openLb(btn.getAttribute("data-zoom"), btn.getAttribute("data-caption"));
    });
  }

  /* ----------------------------------------------------------------------
     导航：滚动状态、移动端菜单、锚点高亮
     ---------------------------------------------------------------------- */
  function initNav() {
    var nav = $(".nav");
    if (!nav) return;

    function onScroll() {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var toggle = $(".nav-toggle");
    var links = $(".nav-links");
    if (toggle && links) {
      toggle.addEventListener("click", function () {
        var open = links.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      links.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          links.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    // 锚点高亮（仅首页）
    var anchors = $$('.nav-links a[href^="#"]');
    if (anchors.length && "IntersectionObserver" in window) {
      var map = {};
      anchors.forEach(function (a) {
        var el = $(a.getAttribute("href"));
        if (el) map[el.id] = a;
      });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          anchors.forEach(function (a) { a.classList.remove("is-active"); });
          if (map[en.target.id]) map[en.target.id].classList.add("is-active");
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
    }
  }

  /* ----------------------------------------------------------------------
     一键复制联系方式
     注意：无论成功或失败，都不把明文写回按钮文案 —— 否则会泄露到页面与 DOM 中
     ---------------------------------------------------------------------- */
  var copyTimers = [];

  function flashBtn(btn, text, ok) {
    if (!btn.dataset.orig) btn.dataset.orig = btn.textContent;
    // 清掉该按钮上尚未结束的定时器，避免连续点击时文案错乱
    copyTimers = copyTimers.filter(function (t) {
      if (t.btn === btn) { clearTimeout(t.id); return false; }
      return true;
    });
    btn.textContent = text;
    btn.classList.toggle("copy-ok", !!ok);
    btn.classList.toggle("copy-fail", !ok);
    var id = setTimeout(function () {
      btn.textContent = btn.dataset.orig;
      btn.classList.remove("copy-ok", "copy-fail");
    }, 1800);
    copyTimers.push({ id: id, btn: btn });
  }

  function initCopy() {
    $$("[data-copy]").forEach(function (btn) {
      if (btn.dataset.copyBound) return;      // 防止重复绑定
      btn.dataset.copyBound = "1";

      btn.addEventListener("click", function () {
        var text = btn.getAttribute("data-copy");
        if (!text) return;
        var done = function () { flashBtn(btn, "已复制", true); };
        var fail = function () { flashBtn(btn, "复制失败，请手动选择", false); };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () {
            legacyCopy(text) ? done() : fail();
          });
        } else {
          legacyCopy(text) ? done() : fail();
        }
      });
    });
  }

  /** 兼容 file:// 打开时无剪贴板 API 的情况 */
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* ----------------------------------------------------------------------
     启动
     ---------------------------------------------------------------------- */
  function boot() {
    applySiteInfo();
    renderHome();
    renderWorksPage();
    renderDetail();
    renderContact();
    initReveal();
    initLightboxTriggers();
    initNav();
    initCopy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
