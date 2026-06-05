class CourseDeck {
  constructor() {
    this.stage = document.querySelector(".deck-stage");
    this.slides = Array.from(document.querySelectorAll(".slide"));
    this.currentSlide = 0;
    this.currentStep = 0;
    this.dots = [];
    this.touchStartX = 0;
    this.pointerStartedOnInteractive = false;
    this.previewTimer = null;
    this.previewPopover = null;
    this.isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
    this.storageKey = `course-deck-position:${window.location.pathname}`;

    this.anchorDeckChrome();
    this.applyPreviewMode();
    this.buildSlideHeaders();
    this.buildDots();
    this.scaleStage();
    this.initReshapeLinks();
    this.initTransposeLinks();
    this.initMatrixMultiplication();
    this.initBournemouthCharts();
    this.bindEvents();
    const savedPosition = this.loadPosition();
    this.show(savedPosition.slide, savedPosition.step);
  }

  applyPreviewMode() {
    if (!this.isPreview) return;
    document.body.classList.add("deck-preview-mode");
  }

  anchorDeckChrome() {
    document.querySelectorAll(".deck-controls, .deck-status").forEach((element) => {
      if (element.parentElement !== this.stage) this.stage.appendChild(element);
    });
  }

  scaleStage() {
    const update = () => {
      const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
      const x = (window.innerWidth - 1600 * scale) / 2;
      const y = (window.innerHeight - 900 * scale) / 2;
      this.stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    };

    update();
    window.addEventListener("resize", update);
  }

  buildSlideHeaders() {
    const template = document.getElementById("deckHeaderTemplate");
    if (!template) return;

    this.slides.forEach((slide) => {
      let header = slide.querySelector(":scope > .slide-kicker");
      if (!header) {
        header = document.createElement("header");
        header.className = "slide-kicker";
        slide.prepend(header);
      }
      header.replaceChildren(template.content.cloneNode(true));
    });
  }

  buildDots() {
    const rail = document.querySelector(".dot-rail");
    if (!rail) return;

    this.slides.forEach((slide, index) => {
      const dot = document.createElement("button");
      dot.className = "dot";
      dot.type = "button";
      dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
      if (this.fragmentsFor(index).length > 0) dot.classList.add("has-fragments");
      dot.addEventListener("click", (event) => {
        this.hideSlidePreview();
        const step = event.altKey || event.metaKey ? this.fragmentsFor(index).length : 0;
        this.show(index, step);
      });
      dot.addEventListener("mouseenter", () => this.queueSlidePreview(index, dot));
      dot.addEventListener("mouseleave", () => this.hideSlidePreview());
      dot.addEventListener("focus", () => this.queueSlidePreview(index, dot));
      dot.addEventListener("blur", () => this.hideSlidePreview());
      rail.appendChild(dot);
      this.dots.push(dot);
    });
  }

  queueSlidePreview(index, dot) {
    this.hideSlidePreview();
    this.previewTimer = window.setTimeout(() => {
      this.showSlidePreview(index, dot);
    }, 10);
  }

  hideSlidePreview() {
    if (this.previewTimer) {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.previewPopover) {
      this.previewPopover.remove();
      this.previewPopover = null;
    }
  }

  showSlidePreview(index, dot) {
    if (!this.slides[index] || !dot) return;
    const finalStep = this.fragmentsFor(index).length;

    const previewUrl = new URL(window.location.href);
    previewUrl.searchParams.set("slide", String(index + 1));
    previewUrl.searchParams.set("step", String(finalStep));
    previewUrl.searchParams.set("preview", "1");

    const iframe = document.createElement("iframe");
    iframe.className = "deck-preview-iframe";
    iframe.src = previewUrl.toString();
    iframe.loading = "eager";
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;

    const popover = document.createElement("div");
    popover.className = "deck-preview-popover";
    popover.appendChild(iframe);

    const dotRect = dot.getBoundingClientRect();
    popover.style.left = `${dotRect.left + dotRect.width / 2}px`;
    popover.style.top = `${Math.max(12, dotRect.top - 134.5)}px`;

    document.body.appendChild(popover);
    requestAnimationFrame(() => popover.classList.add("visible"));
    this.previewPopover = popover;
  }

  bindEvents() {
    document.getElementById("nextSlide")?.addEventListener("click", () => this.next());
    document.getElementById("prevSlide")?.addEventListener("click", () => this.prev());
    document.getElementById("skipSteps")?.addEventListener("click", () => this.skipSteps());

    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        if (this.isPageStartJump(event) && event.key === "ArrowRight") {
          this.nextPageStart();
          return;
        }
        if (this.isPageEndJump(event) && event.key === "ArrowRight") {
          this.nextPage();
          return;
        }
        this.next();
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        if (this.isPageStartJump(event) && event.key === "ArrowLeft") {
          this.prevPageStart();
          return;
        }
        if (this.isPageEndJump(event) && event.key === "ArrowLeft") {
          this.prevPage();
          return;
        }
        this.prev();
      }
      if (event.key === "Home") {
        event.preventDefault();
        this.show(0, 0);
      }
      if (event.key === "End") {
        event.preventDefault();
        const last = this.slides.length - 1;
        this.show(last, this.fragmentsFor(last).length);
      }
    });

    window.addEventListener("pointerdown", (event) => {
      this.touchStartX = event.clientX;
      this.pointerStartedOnInteractive = this.isInteractiveTarget(event.target);
    });

    window.addEventListener("pointerup", (event) => {
      if (this.pointerStartedOnInteractive || this.isInteractiveTarget(event.target)) return;
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed && selection.toString().trim()) return;
      const dx = event.clientX - this.touchStartX;
      if (Math.abs(dx) > 48) {
        dx < 0 ? this.next() : this.prev();
        return;
      }
      event.clientX > window.innerWidth / 2 ? this.next() : this.prev();
    });
  }

  fragmentsFor(index) {
    return Array.from(this.slides[index].querySelectorAll(".fragment"));
  }

  isPageEndJump(event) {
    return event.altKey;
  }

  isPageStartJump(event) {
    return !event.altKey && (event.ctrlKey || event.metaKey);
  }

  isInteractiveTarget(target) {
    return Boolean(
      target.closest(
        "a, button, input, select, textarea, summary, [contenteditable], .deck-controls, .slide-lecture-nav",
      ),
    );
  }

  initReshapeLinks() {
    document.querySelectorAll(".reshape-row, .reshape-tensor-row").forEach((row) => {
      row.querySelectorAll(".reshape-cell").forEach((cell) => {
        cell.dataset.reshapeKey = cell.textContent.trim();
      });

      row.querySelectorAll(":scope > .tensor-shape-group").forEach((group) => {
        let layerIndex = 0;
        group.querySelectorAll(".reshape-stack").forEach((stack) => {
          Array.from(stack.querySelectorAll(".stack-layers polygon")).reverse().forEach((layer) => {
            layer.dataset.reshapeKey = String(layerIndex);
            layerIndex += 1;
          });
        });
      });

      row.addEventListener("pointerover", (event) => {
        const target = event.target.closest("[data-reshape-key]");
        if (!target || !row.contains(target)) return;
        this.highlightReshapeKey(row, target.dataset.reshapeKey);
      });

      row.addEventListener("pointerleave", () => {
        this.clearReshapeHighlights(row);
      });
    });
  }

  highlightReshapeKey(row, key) {
    this.clearReshapeHighlights(row);
    row.querySelectorAll(`[data-reshape-key="${key}"]`).forEach((target) => {
      target.classList.add("reshape-linked-highlight");
    });
  }

  clearReshapeHighlights(row) {
    row.querySelectorAll(".reshape-linked-highlight").forEach((target) => {
      target.classList.remove("reshape-linked-highlight");
    });
  }

  initTransposeLinks() {
    document.querySelectorAll(".transpose-expression").forEach((expression) => {
      const source2d = expression.querySelector(".matrix-two-three");
      const target2d = expression.querySelector(".matrix-three-two");
      if (source2d && target2d) {
        this.assignTransposeKeys(source2d.querySelectorAll(".transpose-cell"), [0, 1, 2, 3, 4, 5]);
        this.assignTransposeKeys(target2d.querySelectorAll(".transpose-cell"), [0, 3, 1, 4, 2, 5]);
      }

      const flatMatrix = expression.querySelector(".matrix-eight-three");
      const stack = expression.querySelector(".transpose-stack");
      if (flatMatrix && stack) {
        this.assignTransposeKeys(
          flatMatrix.querySelectorAll(".transpose-cell"),
          Array.from({ length: 24 }, (_, index) => index),
        );

        [
          [".layer-svg-front", 0],
          [".layer-svg-mid", 1],
          [".layer-svg-deep", 2],
        ].forEach(([selector, timeIndex]) => {
          stack.querySelectorAll(`${selector} .transpose-tile`).forEach((tile, spaceIndex) => {
            tile.dataset.transposeKey = String(spaceIndex * 3 + timeIndex);
          });
        });
      }

      expression.addEventListener("pointerover", (event) => {
        const target = this.closestDataTarget(event.target, "transposeKey", expression);
        if (!target || !expression.contains(target)) return;
        this.highlightTransposeKey(expression, target.dataset.transposeKey);
      });

      expression.addEventListener("pointerleave", () => {
        this.clearTransposeHighlights(expression);
      });
    });
  }

  assignTransposeKeys(elements, keys) {
    elements.forEach((element, index) => {
      element.dataset.transposeKey = String(keys[index]);
    });
  }

  highlightTransposeKey(expression, key) {
    this.clearTransposeHighlights(expression);
    expression.querySelectorAll(`[data-transpose-key="${key}"]`).forEach((target) => {
      target.classList.add("transpose-linked-highlight");
    });
  }

  clearTransposeHighlights(expression) {
    expression.querySelectorAll(".transpose-linked-highlight").forEach((target) => {
      target.classList.remove("transpose-linked-highlight");
    });
  }

  initMatrixMultiplication() {
    const slide = document.querySelector(".matrix-multiply-slide");
    if (!slide) return;

    slide.querySelectorAll(".matrix-grid").forEach((grid) => {
      const matrix = grid.dataset.matrix;
      const rows = Number(grid.dataset.rows);
      const cols = Number(grid.dataset.cols);
      grid.style.setProperty("--matrix-cols", String(cols));

      for (let row = 1; row <= rows; row += 1) {
        for (let col = 1; col <= cols; col += 1) {
          const cell = document.createElement("span");
          cell.className = "matrix-cell";
          cell.dataset.matrix = matrix;
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.innerHTML = `<sub>${row},${col}</sub>`;
          grid.append(cell);
        }
      }
    });

    slide.querySelectorAll('.matrix-a .matrix-cell').forEach((cell) => {
      cell.addEventListener("pointerenter", () => {
        this.highlightMatrixProduct(slide, Number(cell.dataset.row), Number(cell.dataset.col));
      });
    });
    slide.querySelector(".matrix-a")?.addEventListener("pointerleave", () => {
      this.clearMatrixProductHighlights(slide);
    });
  }

  highlightMatrixProduct(slide, row, col) {
    this.clearMatrixProductHighlights(slide);
    slide.querySelector(`.matrix-a [data-row="${row}"][data-col="${col}"]`)?.classList.add("matrix-result-highlight");
    slide.querySelectorAll(`.matrix-b [data-row="${row}"]`).forEach((cell) => {
      cell.classList.add("matrix-row-highlight");
    });
    slide.querySelectorAll(`.matrix-c [data-col="${col}"]`).forEach((cell) => {
      cell.classList.add("matrix-column-highlight");
    });
    const rowArrow = slide.querySelector(".matrix-b .matrix-grid");
    const columnArrow = slide.querySelector(".matrix-c .matrix-grid");
    rowArrow?.style.setProperty("--active-row", String(row - 1));
    rowArrow?.classList.add("matrix-arrow-row");
    columnArrow?.style.setProperty("--active-col", String(col - 1));
    columnArrow?.classList.add("matrix-arrow-column");

    const generic = slide.querySelector(".matrix-formula-generic");
    const specific = slide.querySelector(".matrix-formula-specific");
    if (generic) generic.innerHTML = `A<sub>${row},${col}</sub> = &Sigma;<sub>k</sub> B<sub>${row},k</sub> x C<sub>k,${col}</sub>`;
    if (specific) {
      specific.innerHTML = `A<sub>${row},${col}</sub> = B<sub>${row},1</sub> x C<sub>1,${col}</sub> + B<sub>${row},2</sub> x C<sub>2,${col}</sub> + B<sub>${row},3</sub> x C<sub>3,${col}</sub>`;
    }
  }

  clearMatrixProductHighlights(slide) {
    slide.querySelectorAll(".matrix-result-highlight, .matrix-row-highlight, .matrix-column-highlight").forEach((cell) => {
      cell.classList.remove("matrix-result-highlight", "matrix-row-highlight", "matrix-column-highlight");
    });
    slide.querySelectorAll(".matrix-arrow-row, .matrix-arrow-column").forEach((grid) => {
      grid.classList.remove("matrix-arrow-row", "matrix-arrow-column");
    });
    const generic = slide.querySelector(".matrix-formula-generic");
    const specific = slide.querySelector(".matrix-formula-specific");
    if (generic) generic.innerHTML = "A<sub>i,j</sub> = &Sigma;<sub>k</sub> B<sub>i,k</sub> x C<sub>k,j</sub>";
    if (specific) specific.textContent = "Hover over a cell in A";
  }

  closestDataTarget(target, datasetKey, boundary) {
    let node = target;
    while (node && node !== boundary) {
      if (node.dataset?.[datasetKey] !== undefined) return node;
      node = node.parentElement || node.parentNode;
    }
    return null;
  }

  initBournemouthCharts() {
    const timeSeries = document.getElementById("bournemouthTimeSeries");
    const monthlyMean = document.getElementById("bournemouthMonthlyMean");
    const heatmap = document.getElementById("bournemouthHeatmap");
    if (!timeSeries && !monthlyMean && !heatmap) return;

    const rows = this.bournemouthMonthlyTemperatureRows();
    const climatology = this.monthlyClimatology(rows);
    const anomalies = this.temperatureAnomalyRows(rows, climatology);
    if (timeSeries) this.drawTimeSeriesChart(timeSeries, rows, anomalies);
    if (monthlyMean) this.drawMonthlyMeanChart(monthlyMean, rows, anomalies, climatology);
    if (heatmap) this.drawHeatmapChart(heatmap, rows, anomalies);
  }

  bournemouthMonthlyTemperatureRows() {
    return [
      [1973, 0, 4.9815],
      [1973, 1, 4.6502],
      [1973, 2, 5.5735],
      [1973, 3, 7.6296],
      [1973, 4, 11.5771],
      [1973, 5, 15.0185],
      [1973, 6, 15.8781],
      [1973, 7, 17.3477],
      [1973, 8, 14.5926],
      [1973, 9, 9.3011],
      [1973, 10, 6.9444],
      [1973, 11, 5.8961],
      [1974, 0, 7.5986],
      [1974, 1, 6.2698],
      [1974, 2, 6.0573],
      [1974, 3, 8.7037],
      [1974, 4, 11.0573],
      [1974, 5, 14.463],
      [1974, 6, 15.6093],
      [1974, 7, 15.1971],
      [1974, 8, 12.6111],
      [1974, 9, 7.9211],
      [1974, 10, 8.2963],
      [1974, 11, 9.0143],
      [1975, 0, 7.9749],
      [1975, 1, 5.4365],
      [1975, 2, 5.2509],
      [1975, 3, 5.9722],
      [1975, 4, 10.7407],
      [1975, 5, 15.5185],
      [1975, 6, 17.3297],
      [1975, 7, 18.0287],
      [1975, 8, 13.7037],
      [1975, 9, 10.3763],
      [1975, 10, 6.963],
      [1975, 11, 4.767],
      [1976, 0, 6.362],
      [1976, 1, 5],
      [1976, 2, 5.1971],
      [1976, 3, 7.9815],
      [1976, 4, 12.4259],
      [1976, 5, 17.4074],
      [1976, 6, 18.9606],
      [1976, 7, 17.5627],
      [1976, 8, 13.8148],
      [1976, 9, 11.6129],
      [1976, 10, 6.6852],
      [1976, 11, 2.724],
      [1977, 0, 3.9427],
      [1977, 1, 6.627],
      [1977, 2, 7.6882],
      [1977, 3, 7.463],
      [1977, 4, 11.2186],
      [1977, 5, 12.7037],
      [1977, 6, 16.4516],
      [1977, 7, 15.3943],
      [1977, 8, 13.1296],
      [1977, 9, 12.6165],
      [1977, 10, 7.3148],
      [1977, 11, 7.509],
      [1978, 0, 4.4624],
      [1978, 1, 3.2143],
      [1978, 2, 6.81],
      [1978, 3, 6.9074],
      [1978, 4, 11.81],
      [1978, 5, 13.963],
      [1978, 6, 15.2509],
      [1978, 7, 15.3047],
      [1978, 8, 13.8889],
      [1978, 9, 12.0251],
      [1978, 10, 9.1481],
      [1978, 11, 6.0753],
      [1979, 0, 1.2186],
      [1979, 1, 2.2619],
      [1979, 2, 5.5197],
      [1979, 3, 8.1296],
      [1979, 4, 9.6953],
      [1979, 5, 13.8148],
      [1979, 6, 16.8638],
      [1979, 7, 15.0358],
      [1979, 8, 13.1481],
      [1979, 9, 11.9713],
      [1979, 10, 7.5741],
      [1979, 11, 6.6667],
      [1980, 0, 2.1685],
      [1980, 1, 6.705],
      [1980, 2, 5.4839],
      [1980, 3, 8.8889],
      [1980, 4, 11.3799],
      [1980, 5, 13.8519],
      [1980, 6, 14.6953],
      [1980, 7, 16.147],
      [1980, 8, 14.9259],
      [1980, 9, 9.2652],
      [1980, 10, 6.5741],
      [1980, 11, 6.0215],
      [1981, 0, 5.4839],
      [1981, 1, 3.4722],
      [1981, 2, 8.4259],
      [1981, 3, 8.3333],
      [1981, 4, 11.2366],
      [1981, 5, 13.4444],
      [1981, 6, 16.0394],
      [1981, 7, 16.6308],
      [1981, 8, 14.4815],
      [1981, 9, 8.9964],
      [1981, 10, 7.8333],
      [1981, 11, 2.6344],
      [1982, 0, 4.4265],
      [1982, 1, 5.7341],
      [1982, 2, 5.8423],
      [1982, 3, 8.5],
      [1982, 4, 11.5412],
      [1982, 5, 15.7222],
      [1982, 6, 16.8817],
      [1982, 7, 15.9857],
      [1982, 8, 14.5],
      [1982, 9, 10.7348],
      [1982, 10, 8.7407],
      [1982, 11, 5.3943],
      [1983, 0, 7.724],
      [1983, 1, 2.6786],
      [1983, 2, 6.1649],
      [1983, 3, 7.0926],
      [1983, 4, 10.5735],
      [1983, 5, 14.8704],
      [1983, 6, 19.552],
      [1983, 7, 17.4552],
      [1983, 8, 14.037],
      [1983, 9, 10.5197],
      [1983, 10, 7.8333],
      [1983, 11, 6.1649],
      [1984, 0, 5.1075],
      [1984, 1, 4.3678],
      [1984, 2, 5],
      [1984, 3, 8.037],
      [1984, 4, 10.1613],
      [1984, 5, 15.0556],
      [1984, 6, 16.4695],
      [1984, 7, 17.0609],
      [1984, 8, 13.9815],
      [1984, 9, 11.5771],
      [1984, 10, 8.5741],
      [1984, 11, 5.8065],
      [1985, 0, 1.0394],
      [1985, 1, 2.6786],
      [1985, 2, 4.6953],
      [1985, 3, 8.4074],
      [1985, 4, 11.3799],
      [1985, 5, 13.4815],
      [1985, 6, 16.3978],
      [1985, 7, 15.0538],
      [1985, 8, 14.2593],
      [1985, 9, 10.8961],
      [1985, 10, 4.6852],
      [1985, 11, 7.7061],
      [1986, 0, 4.6057],
      [1986, 1, -0.5952],
      [1986, 2, 4.9642],
      [1986, 3, 5.7778],
      [1986, 4, 10.5197],
      [1986, 5, 15.2963],
      [1986, 6, 16.2366],
      [1986, 7, 14.1039],
      [1986, 8, 11.0556],
      [1986, 9, 11.3799],
      [1986, 10, 8.3704],
      [1986, 11, 6.6129],
      [1987, 0, 1.0573],
      [1987, 1, 4.1468],
      [1987, 2, 4.767],
      [1987, 3, 9.463],
      [1987, 4, 10.8781],
      [1987, 5, 13.4074],
      [1987, 6, 16.4875],
      [1987, 7, 15.9498],
      [1987, 8, 14.1852],
      [1987, 9, 10.5018],
      [1987, 10, 6.7407],
      [1987, 11, 6.3799],
      [1988, 0, 6.2724],
      [1988, 1, 4.9042],
      [1988, 2, 7.0789],
      [1988, 3, 8.1111],
      [1988, 4, 12.4731],
      [1988, 5, 15],
      [1988, 6, 15.0538],
      [1988, 7, 15.3584],
      [1988, 8, 13.7778],
      [1988, 9, 11.5771],
      [1988, 10, 5.7037],
      [1988, 11, 7.9749],
      [1989, 0, 6.5771],
      [1989, 1, 6.6865],
      [1989, 2, 8.0645],
      [1989, 3, 6.8704],
      [1989, 4, 13.8351],
      [1989, 5, 15.2222],
      [1989, 6, 18.9427],
      [1989, 7, 17.0968],
      [1989, 8, 15],
      [1989, 9, 12.4552],
      [1989, 10, 7.0556],
      [1989, 11, 6.3799],
      [1990, 0, 7.8674],
      [1990, 1, 8.5119],
      [1990, 2, 8.1004],
      [1990, 3, 8.3333],
      [1990, 4, 13.1541],
      [1990, 5, 13.6296],
      [1990, 6, 17.1864],
      [1990, 7, 18.2079],
      [1990, 8, 13.2778],
      [1990, 9, 12.4194],
      [1990, 10, 7.6481],
      [1990, 11, 4.6595],
      [1991, 0, 4.5878],
      [1991, 1, 1.8452],
      [1991, 2, 7.9032],
      [1991, 3, 8.1481],
      [1991, 4, 11.3799],
      [1991, 5, 12.6852],
      [1991, 6, 16.7204],
      [1991, 7, 17.1685],
      [1991, 8, 14.7407],
      [1991, 9, 10.1792],
      [1991, 10, 7.2222],
      [1991, 11, 5.3226],
      [1992, 0, 3.7814],
      [1992, 1, 5.364],
      [1992, 2, 7.6523],
      [1992, 3, 8.5185],
      [1992, 4, 13.6918],
      [1992, 5, 15.7407],
      [1992, 6, 16.7204],
      [1992, 7, 16.129],
      [1992, 8, 14.2037],
      [1992, 9, 7.8853],
      [1992, 10, 8.9074],
      [1992, 11, 4.6416],
      [1993, 0, 7.491],
      [1993, 1, 5.3373],
      [1993, 2, 6.4158],
      [1993, 3, 9.7037],
      [1993, 4, 12.3477],
      [1993, 5, 15.2593],
      [1993, 6, 15.5018],
      [1993, 7, 14.8746],
      [1993, 8, 12.4444],
      [1993, 9, 8.7634],
      [1993, 10, 4.963],
      [1993, 11, 6.3978],
      [1994, 0, 6.0753],
      [1994, 1, 4.4246],
      [1994, 2, 8.0466],
      [1994, 3, 7.8889],
      [1994, 4, 11.0394],
      [1994, 5, 14.537],
      [1994, 6, 18.0287],
      [1994, 7, 16.6129],
      [1994, 8, 13.4259],
      [1994, 9, 10.1792],
      [1994, 10, 11.2593],
      [1994, 11, 7.2581],
      [1995, 0, 6.1649],
      [1995, 1, 7.877],
      [1995, 2, 5.9677],
      [1995, 3, 9.2222],
      [1995, 4, 12.0251],
      [1995, 5, 15.3148],
      [1995, 6, 18.7993],
      [1995, 7, 19.7849],
      [1995, 8, 13.8519],
      [1995, 9, 13.3871],
      [1995, 10, 8.1296],
      [1995, 11, 3.5663],
      [1996, 0, 5.9857],
      [1996, 1, 3.3142],
      [1996, 2, 5.233],
      [1996, 3, 8.4074],
      [1996, 4, 9.5341],
      [1996, 5, 14.6852],
      [1996, 6, 16.828],
      [1996, 7, 16.4875],
      [1996, 8, 13.4815],
      [1996, 9, 12.509],
      [1996, 10, 6.2778],
      [1996, 11, 3.7455],
      [1997, 0, 2.4731],
      [1997, 1, 7.3016],
      [1997, 2, 8.2616],
      [1997, 3, 8.6111],
      [1997, 4, 12.0609],
      [1997, 5, 14.5741],
      [1997, 6, 16.9534],
      [1997, 7, 18.7634],
      [1997, 8, 14.1481],
      [1997, 9, 10.9857],
      [1997, 10, 8.963],
      [1997, 11, 6.5233],
      [1998, 0, 6.147],
      [1998, 1, 6.6468],
      [1998, 2, 8.6022],
      [1998, 3, 8.1111],
      [1998, 4, 14.2115],
      [1998, 5, 14.7407],
      [1998, 6, 15.8423],
      [1998, 7, 16.5233],
      [1998, 8, 15.1667],
      [1998, 9, 11.4875],
      [1998, 10, 6.9815],
      [1998, 11, 6.81],
      [1999, 0, 6.9444],
      [1999, 1, 5.8929],
      [1999, 2, 7.1147],
      [1999, 3, 9.4815],
      [1999, 4, 13.2616],
      [1999, 5, 14.2407],
      [1999, 6, 18.0287],
      [1999, 7, 16.6487],
      [1999, 8, 15.8333],
      [1999, 9, 10.8244],
      [1999, 10, 8.1481],
      [1999, 11, 5.9319],
      [2000, 0, 4.8208],
      [2000, 1, 7.2031],
      [2000, 2, 7.3297],
      [2000, 3, 7.963],
      [2000, 4, 12.5448],
      [2000, 5, 14.963],
      [2000, 6, 15.8961],
      [2000, 7, 17.043],
      [2000, 8, 15.2222],
      [2000, 9, 11.1828],
      [2000, 10, 7.7037],
      [2000, 11, 6.828],
      [2001, 0, 4.552],
      [2001, 1, 5.3373],
      [2001, 2, 6.5233],
      [2001, 3, 8.4074],
      [2001, 4, 12.509],
      [2001, 5, 14.6852],
      [2001, 6, 17.2222],
      [2001, 7, 16.8459],
      [2001, 8, 14.2037],
      [2001, 9, 14.0323],
      [2001, 10, 7.5],
      [2001, 11, 3.8889],
      [2002, 0, 6.9176],
      [2002, 1, 7.8571],
      [2002, 2, 7.9391],
      [2002, 3, 9.537],
      [2002, 4, 11.9713],
      [2002, 5, 14.2222],
      [2002, 6, 16.129],
      [2002, 7, 16.6129],
      [2002, 8, 14.1111],
      [2002, 9, 11.1828],
      [2002, 10, 10.0185],
      [2002, 11, 7.1505],
      [2003, 0, 4.8925],
      [2003, 1, 4.9802],
      [2003, 2, 7.6523],
      [2003, 3, 9.6852],
      [2003, 4, 11.8459],
      [2003, 5, 15.9259],
      [2003, 6, 17.5269],
      [2003, 7, 18.7276],
      [2003, 8, 13.8704],
      [2003, 9, 9.3907],
      [2003, 10, 9.1111],
      [2003, 11, 5.9857],
      [2004, 0, 6.3441],
      [2004, 1, 5.3831],
      [2004, 2, 6.4516],
      [2004, 3, 9.2037],
      [2004, 4, 12.4194],
      [2004, 5, 16.0741],
      [2004, 6, 16.2545],
      [2004, 7, 17.509],
      [2004, 8, 15.4259],
      [2004, 9, 11.2724],
      [2004, 10, 8.2407],
      [2004, 11, 5.5556],
      [2005, 0, 6.9534],
      [2005, 1, 4.6032],
      [2005, 2, 7.1685],
      [2005, 3, 9.1481],
      [2005, 4, 11.5771],
      [2005, 5, 15.7963],
      [2005, 6, 17.1505],
      [2005, 7, 16.3978],
      [2005, 8, 15.3148],
      [2005, 9, 13.7634],
      [2005, 10, 6.1852],
      [2005, 11, 4.2832],
      [2006, 0, 4.7849],
      [2006, 1, 3.7698],
      [2006, 2, 5.6093],
      [2006, 3, 9.2037],
      [2006, 4, 12.3477],
      [2006, 5, 16.0926],
      [2006, 6, 19.5161],
      [2006, 7, 17.1685],
      [2006, 8, 16.9074],
      [2006, 9, 13.9785],
      [2006, 10, 8.7593],
      [2006, 11, 7.4014],
      [2007, 0, 7.9211],
      [2007, 1, 7.3413],
      [2007, 2, 7.5448],
      [2007, 3, 11.8333],
      [2007, 4, 12.957],
      [2007, 5, 15.7778],
      [2007, 6, 15.6631],
      [2007, 7, 15.9677],
      [2007, 8, 14.037],
      [2007, 9, 10.9857],
      [2007, 10, 7.5926],
      [2007, 11, 5.681],
      [2008, 0, 7.6165],
      [2008, 1, 5.5364],
      [2008, 2, 7.0789],
      [2008, 3, 8.5556],
      [2008, 4, 14.2473],
      [2008, 5, 14.9815],
      [2008, 6, 16.5591],
      [2008, 7, 16.4158],
      [2008, 8, 13.3889],
      [2008, 9, 9.9642],
      [2008, 10, 8.1296],
      [2008, 11, 4.1756],
      [2009, 0, 3.8351],
      [2009, 1, 4.6825],
      [2009, 2, 6.8638],
      [2009, 3, 9.9815],
      [2009, 4, 12.6165],
      [2009, 5, 15.6481],
      [2009, 6, 16.5771],
      [2009, 7, 16.6129],
      [2009, 8, 14.4815],
      [2009, 9, 12.276],
      [2009, 10, 10.0556],
      [2009, 11, 4.3011],
      [2010, 0, 1.7025],
      [2010, 1, 4.2063],
      [2010, 2, 6.0573],
      [2010, 3, 8.8148],
      [2010, 4, 11.3082],
      [2010, 5, 15.8148],
      [2010, 6, 17.8495],
      [2010, 7, 15.9319],
      [2010, 8, 14],
      [2010, 9, 11.129],
      [2010, 10, 6.5],
      [2010, 11, 1.0036],
      [2011, 0, 4.8208],
      [2011, 1, 7.3016],
      [2011, 2, 6.7921],
      [2011, 3, 11.9815],
      [2011, 4, 12.7419],
      [2011, 5, 14.463],
      [2011, 6, 15.6272],
      [2011, 7, 15.7348],
      [2011, 8, 15.2407],
      [2011, 9, 13.0824],
      [2011, 10, 11.0926],
      [2011, 11, 7.3118],
      [2012, 0, 6.362],
      [2012, 1, 4.4636],
      [2012, 2, 8.172],
      [2012, 3, 7.7222],
      [2012, 4, 12.7061],
      [2012, 5, 14.2037],
      [2012, 6, 15.6631],
      [2012, 7, 17.0251],
      [2012, 8, 13.4259],
      [2012, 9, 10.9319],
      [2012, 10, 7.4444],
      [2012, 11, 6.2545],
      [2013, 0, 5.3943],
      [2013, 1, 3.7698],
      [2013, 2, 3.853],
      [2013, 3, 7.5741],
      [2013, 4, 10.7527],
      [2013, 5, 14.5741],
      [2013, 6, 18.7097],
      [2013, 7, 17.2581],
      [2013, 8, 14.537],
      [2013, 9, 13.2258],
      [2013, 10, 7.1667],
      [2013, 11, 7.1685],
      [2014, 0, 6.9713],
      [2014, 1, 7.4405],
      [2014, 2, 7.8495],
      [2014, 3, 10.2963],
      [2014, 4, 12.3835],
      [2014, 5, 16.037],
      [2014, 6, 18.5842],
      [2014, 7, 15.8244],
      [2014, 8, 15.3519],
      [2014, 9, 13.4409],
      [2014, 10, 9.463],
      [2014, 11, 5.681],
      [2015, 0, 5.7348],
      [2015, 1, 4.4444],
      [2015, 2, 6.8996],
      [2015, 3, 9.5556],
      [2015, 4, 11.9713],
      [2015, 5, 15.1667],
      [2015, 6, 16.6667],
      [2015, 7, 16.2724],
      [2015, 8, 13.1852],
      [2015, 9, 11.4158],
      [2015, 10, 11.1111],
      [2015, 11, 11.7921],
      [2016, 0, 6.7384],
      [2016, 1, 5.9387],
      [2016, 2, 6.2724],
      [2016, 3, 8.1296],
      [2016, 4, 12.7957],
      [2016, 5, 15.2963],
      [2016, 6, 17.3118],
      [2016, 7, 17.4552],
      [2016, 8, 16.4815],
      [2016, 9, 10.7348],
      [2016, 10, 6.5926],
      [2016, 11, 6.595],
      [2017, 0, 4.1935],
      [2017, 1, 6.9444],
      [2017, 2, 9.3728],
      [2017, 3, 9.3333],
      [2017, 4, 13.6022],
      [2017, 5, 16.7222],
      [2017, 6, 17.6882],
      [2017, 7, 16.2545],
      [2017, 8, 13.9074],
      [2017, 9, 12.8315],
      [2017, 10, 7.4074],
      [2017, 11, 5.9857],
      [2018, 0, 6.7742],
      [2018, 1, 3.2937],
      [2018, 2, 5.8244],
      [2018, 3, 10.4444],
      [2018, 4, 13.7097],
      [2018, 5, 16.9815],
      [2018, 6, 19.767],
      [2018, 7, 17.3477],
      [2018, 8, 14.0556],
      [2018, 9, 10.7706],
      [2018, 10, 9.0926],
      [2018, 11, 8.5484],
      [2019, 0, 4.3548],
      [2019, 1, 6.4484],
      [2019, 2, 8.6201],
      [2019, 3, 9.6481],
      [2019, 4, 12.0789],
      [2019, 5, 15.1667],
      [2019, 6, 18.2616],
      [2019, 7, 17.2581],
      [2019, 8, 15.2963],
      [2019, 9, 11.4875],
      [2019, 10, 7.6481],
      [2019, 11, 7.2401],
      [2020, 0, 7.276],
      [2020, 1, 7.7778],
      [2020, 2, 7.3656],
      [2020, 3, 11.0741],
      [2020, 4, 13.3692],
      [2020, 5, 15.8519],
      [2020, 6, 16.7025],
      [2020, 7, 18.405],
      [2020, 8, 14.6852],
      [2020, 9, 11.3978],
      [2020, 10, 9.8333],
      [2020, 11, 6.129],
      [2021, 0, 4.4982],
      [2021, 1, 6.2179],
      [2021, 2, 7.2401],
      [2021, 3, 6.7593],
      [2021, 4, 10.5735],
      [2021, 5, 15.9815],
      [2021, 6, 17.9391],
      [2021, 7, 16.3262],
      [2021, 8, 15.9815],
      [2021, 9, 12.8674],
      [2021, 10, 7.5741],
      [2021, 11, 8.2796],
      [2022, 0, 5.1075],
      [2022, 1, 8.0159],
      [2022, 2, 8.172],
      [2022, 3, 9.6111],
      [2022, 4, 13.2796],
      [2022, 5, 15.6481],
      [2022, 6, 18.8351],
      [2022, 7, 19.1219],
      [2022, 8, 14.7407],
      [2022, 9, 14.1039],
      [2022, 10, 10.3704],
      [2022, 11, 4.6057],
      [2023, 0, 5.2688],
      [2023, 1, 6.0516],
      [2023, 2, 7.957],
      [2023, 3, 8.9259],
      [2023, 4, 13.3692],
      [2023, 5, 17.9074],
      [2023, 6, 16.8459],
      [2023, 7, 16.6129],
      [2023, 8, 17.1296],
      [2023, 9, 13.1004],
      [2023, 10, 8.7037]
    ].map(([year, month, temperatureC]) => ({
      date: new Date(year, month, 1),
      month,
      temperatureC,
    }));
  }

  monthlyClimatology(rows) {
    return Array.from({ length: 12 }, (_, month) => {
      const values = rows.filter((row) => row.month === month).map((row) => row.temperatureC);
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    });
  }

  temperatureAnomalyRows(rows, climatology) {
    return rows.map((row) => ({
      ...row,
      anomalyC: row.temperatureC - climatology[row.month],
    }));
  }

  drawTimeSeriesChart(svg, rows, anomalies) {
    const width = 1180;
    const height = 260;
    const margin = { top: 18, right: 24, bottom: 42, left: 58 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const minDate = rows[0].date.getTime();
    const maxDate = rows[rows.length - 1].date.getTime();
    const values = rows.map((row) => row.temperatureC);
    const yMin = Math.floor(Math.min(...values));
    const yMax = Math.ceil(Math.max(...values));
    const x = (date) => margin.left + ((date.getTime() - minDate) / (maxDate - minDate)) * plotWidth;
    const y = (value) => margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
    const path = rows.map((row, index) => `${index === 0 ? "M" : "L"}${x(row.date).toFixed(1)} ${y(row.temperatureC).toFixed(1)}`).join(" ");
    const years = [1980, 1990, 2000, 2010, 2020];
    const yTicks = [0, 5, 10, 15, 20].filter((tick) => tick >= yMin && tick <= yMax);

    svg.replaceChildren();
    this.drawChartFrame(svg, width, height, margin, yTicks, y, `${yMin} to ${yMax}`);
    years.forEach((year) => {
      const xPos = x(new Date(`${year}-01-01`));
      svg.append(this.svgLine(xPos, margin.top, xPos, margin.top + plotHeight, "data-chart-grid"));
      svg.append(this.svgText(xPos - 14, height - 14, String(year), "data-chart-tick"));
    });
    svg.append(this.svgPath(path, "data-chart-line"));
    this.addTimeSeriesTooltip(svg, rows, x, y, margin, plotHeight);
    svg.append(this.svgText(10, 110, "T (°C)", "data-chart-label", "rotate(-90 18 128)"));
    svg.append(this.drawAnomalyTimeSeriesLayer(anomalies, width, height, margin));
  }

  drawAnomalyTimeSeriesLayer(rows, width, height, margin) {
    const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("class", "seasonal-anomaly-layer");
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const minDate = rows[0].date.getTime();
    const maxDate = rows[rows.length - 1].date.getTime();
    const values = rows.map((row) => row.anomalyC);
    const bound = Math.ceil(Math.max(...values.map((value) => Math.abs(value))));
    const yMin = -bound;
    const yMax = bound;
    const x = (date) => margin.left + ((date.getTime() - minDate) / (maxDate - minDate)) * plotWidth;
    const y = (value) => margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
    const path = rows.map((row, index) => `${index === 0 ? "M" : "L"}${x(row.date).toFixed(1)} ${y(row.anomalyC).toFixed(1)}`).join(" ");
    const yTicks = [-bound, 0, bound];

    layer.append(this.svgRect(0, 0, width, height, "seasonal-anomaly-bg"));
    this.drawChartFrame(layer, width, height, margin, [], y, "");
    [1980, 1990, 2000, 2010, 2020].forEach((year) => {
      const xPos = x(new Date(`${year}-01-01`));
      layer.append(this.svgLine(xPos, margin.top, xPos, margin.top + plotHeight, "data-chart-grid"));
      layer.append(this.svgText(xPos - 14, height - 14, String(year), "data-chart-tick"));
    });
    yTicks.forEach((tick) => {
      layer.append(this.svgLine(margin.left, y(tick), width - margin.right, y(tick), tick === 0 ? "data-chart-zero" : "data-chart-grid"));
      layer.append(this.svgText(14, y(tick) + 5, String(tick), "data-chart-tick"));
    });
    layer.append(this.svgPath(path, "seasonal-anomaly-line"));
    this.addTimeSeriesTooltip(layer, rows, x, y, margin, plotHeight, "anomalyC");
    layer.append(this.svgRect(-30, 56, 32, 156, "seasonal-anomaly-label-cover"));
    layer.append(this.svgText(10, 108, "T' (°C)", "data-chart-label seasonal-anomaly-y-label", "rotate(-90 18 128)"));
    return layer;
  }

  addTimeSeriesTooltip(svg, rows, xScale, yScale, margin, plotHeight, valueKey = "temperatureC") {
    const tooltip = document.createElementNS("http://www.w3.org/2000/svg", "g");
    tooltip.setAttribute("class", "data-chart-tooltip");
    tooltip.setAttribute("visibility", "hidden");

    const box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    box.setAttribute("width", 124);
    box.setAttribute("height", 48);
    box.setAttribute("rx", 6);
    box.setAttribute("ry", 6);

    const dateText = this.svgText(10, 20, "", "data-chart-tooltip-text");
    const tempText = this.svgText(10, 38, "", "data-chart-tooltip-text");
    const marker = this.svgCircle(0, 0, 5, "data-chart-hover-dot");

    tooltip.append(box, dateText, tempText);
    svg.append(marker, tooltip);

    rows.forEach((row) => {
      const x = xScale(row.date);
      const value = row[valueKey];
      const y = yScale(value);
      const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hitArea.setAttribute("class", "data-chart-hit-area");
      hitArea.setAttribute("x", x - 4);
      hitArea.setAttribute("y", margin.top);
      hitArea.setAttribute("width", 8);
      hitArea.setAttribute("height", plotHeight);
      hitArea.addEventListener("pointerenter", () => {
        const year = row.date.getFullYear();
        const month = String(row.date.getMonth() + 1).padStart(2, "0");
        const tooltipX = Math.min(Math.max(x + 10, margin.left), 1042);
        const tooltipY = Math.max(y - 58, 8);
        dateText.textContent = `${year}-${month}`;
        tempText.textContent = `${value.toFixed(1)} °C`;
        marker.setAttribute("cx", x);
        marker.setAttribute("cy", y);
        marker.setAttribute("visibility", "visible");
        tooltip.setAttribute("transform", `translate(${tooltipX}, ${tooltipY})`);
        tooltip.setAttribute("visibility", "visible");
      });
      hitArea.addEventListener("pointerleave", () => {
        marker.setAttribute("visibility", "hidden");
        tooltip.setAttribute("visibility", "hidden");
      });
      svg.append(hitArea);
    });

    marker.setAttribute("visibility", "hidden");
  }

  drawMonthlyMeanChart(svg, rows, anomalies, climatology) {
    const width = 430;
    const height = 260;
    const margin = { top: 8, right: 20, bottom: 58, left: 78 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const yearlyCycles = this.yearlySeasonalCycles(rows);
    const monthly = Array.from({ length: 12 }, (_, month) => {
      const values = rows.filter((row) => row.month === month).map((row) => row.temperatureC);
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    });
    const allValues = yearlyCycles.flatMap((cycle) => cycle.values.map((point) => point.temperatureC)).concat(monthly);
    const yMin = Math.floor(Math.min(...allValues));
    const yMax = Math.ceil(Math.max(...allValues));
    const x = (month) => margin.left + (month / 11) * plotWidth;
    const y = (value) => margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
    const path = monthly.map((value, month) => `${month === 0 ? "M" : "L"}${x(month).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");

    svg.replaceChildren();
    const yTicks = [5, 10, 15, 20].filter((tick) => tick >= yMin && tick <= yMax);
    this.drawChartFrame(svg, width, height, margin, [], y, "");
    yTicks.forEach((tick) => {
      svg.append(this.svgLine(margin.left, y(tick), width - margin.right, y(tick), "data-chart-grid"));
      svg.append(this.svgText(margin.left - 38, y(tick) + 5, String(tick), "data-chart-tick"));
    });
    [0, 2, 4, 6, 8, 10].forEach((month) => {
      svg.append(this.svgText(x(month) - 4, height - 36, String(month + 1), "data-chart-tick"));
    });
    yearlyCycles.forEach((cycle, index) => {
      const cyclePath = cycle.values.map((point, pointIndex) => {
        return `${pointIndex === 0 ? "M" : "L"}${x(point.month).toFixed(1)} ${y(point.temperatureC).toFixed(1)}`;
      }).join(" ");
      const pathNode = this.svgPath(cyclePath, "seasonal-year-cycle");
      pathNode.style.setProperty("--cycle-delay", `${Math.min(index * 18, 620)}ms`);
      svg.append(pathNode);
    });
    svg.append(this.svgPath(path, "seasonal-mean-cycle"));
    monthly.forEach((value, month) => svg.append(this.svgCircle(x(month), y(value), 4.5, "data-chart-dot seasonal-mean-dot")));
    this.addMonthlyMeanTooltip(svg, monthly, x, y, margin, plotHeight);
    svg.append(this.svgText(30, 112, "T (°C)", "data-chart-label", "rotate(-90 30 112)"));
    svg.append(this.svgText(218, 252, "month", "data-chart-label"));
    svg.append(this.drawAnomalyMonthlyLayer(anomalies, climatology, width, height, margin));
  }

  drawAnomalyMonthlyLayer(rows, climatology, width, height, margin) {
    const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("class", "seasonal-anomaly-layer");
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const yearlyCycles = this.yearlySeasonalCycles(rows, "anomalyC");
    const allValues = yearlyCycles.flatMap((cycle) => cycle.values.map((point) => point.anomalyC));
    const bound = Math.ceil(Math.max(...allValues.map((value) => Math.abs(value))));
    const yMin = -bound;
    const yMax = bound;
    const x = (month) => margin.left + (month / 11) * plotWidth;
    const y = (value) => margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
    const monthlyMean = Array.from({ length: 12 }, (_, month) => {
      const values = rows.filter((row) => row.month === month).map((row) => row.anomalyC);
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    });
    const meanPath = monthlyMean.map((value, month) => {
      return `${month === 0 ? "M" : "L"}${x(month).toFixed(1)} ${y(value).toFixed(1)}`;
    }).join(" ");

    layer.append(this.svgRect(0, 0, width, height, "seasonal-anomaly-bg"));
    this.drawChartFrame(layer, width, height, margin, [], y, "");
    [-bound, 0, bound].forEach((tick) => {
      layer.append(this.svgLine(margin.left, y(tick), width - margin.right, y(tick), tick === 0 ? "data-chart-zero" : "data-chart-grid"));
      layer.append(this.svgText(margin.left - 44, y(tick) + 5, String(tick), "data-chart-tick"));
    });
    [0, 2, 4, 6, 8, 10].forEach((month) => {
      layer.append(this.svgText(x(month) - 4, height - 36, String(month + 1), "data-chart-tick"));
    });
    yearlyCycles.forEach((cycle) => {
      const cyclePath = cycle.values.map((point, pointIndex) => {
        return `${pointIndex === 0 ? "M" : "L"}${x(point.month).toFixed(1)} ${y(point.anomalyC).toFixed(1)}`;
      }).join(" ");
      layer.append(this.svgPath(cyclePath, "seasonal-anomaly-cycle"));
    });
    layer.append(this.svgPath(meanPath, "seasonal-anomaly-mean-cycle"));
    monthlyMean.forEach((value, month) => layer.append(this.svgCircle(x(month), y(value), 4.5, "data-chart-dot seasonal-anomaly-mean-dot")));
    this.addMonthlyMeanTooltip(layer, monthlyMean, x, y, margin, plotHeight);
    layer.append(this.svgRect(0, 70, 62, 120, "seasonal-anomaly-label-cover"));
    layer.append(this.svgText(30, 112, "T' (°C)", "data-chart-label seasonal-anomaly-y-label", "rotate(-90 30 112)"));
    layer.append(this.svgText(218, 252, "month", "data-chart-label"));
    return layer;
  }

  addMonthlyMeanTooltip(svg, monthly, xScale, yScale, margin, plotHeight) {
    const tooltip = document.createElementNS("http://www.w3.org/2000/svg", "g");
    tooltip.setAttribute("class", "data-chart-tooltip seasonal-mean-tooltip");
    tooltip.setAttribute("visibility", "hidden");

    const box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    box.setAttribute("width", 120);
    box.setAttribute("height", 48);
    box.setAttribute("rx", 6);
    box.setAttribute("ry", 6);

    const monthText = this.svgText(10, 20, "", "data-chart-tooltip-text");
    const tempText = this.svgText(10, 38, "", "data-chart-tooltip-text");
    const marker = this.svgCircle(0, 0, 6, "data-chart-hover-dot seasonal-mean-tooltip-marker");

    tooltip.append(box, monthText, tempText);
    svg.append(marker, tooltip);

    monthly.forEach((value, month) => {
      const x = xScale(month);
      const y = yScale(value);
      const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      hitArea.setAttribute("class", "data-chart-hit-area seasonal-mean-hit-area");
      hitArea.setAttribute("cx", x);
      hitArea.setAttribute("cy", y);
      hitArea.setAttribute("r", 12);
      hitArea.addEventListener("pointerenter", () => {
        const tooltipX = Math.min(Math.max(x + 10, margin.left), 292);
        const tooltipY = Math.max(y - 58, 8);
        monthText.textContent = `Month ${month + 1}`;
        tempText.textContent = `${value.toFixed(1)} °C`;
        marker.setAttribute("cx", x);
        marker.setAttribute("cy", y);
        marker.setAttribute("visibility", "visible");
        tooltip.setAttribute("transform", `translate(${tooltipX}, ${tooltipY})`);
        tooltip.setAttribute("visibility", "visible");
      });
      hitArea.addEventListener("pointerleave", () => {
        marker.setAttribute("visibility", "hidden");
        tooltip.setAttribute("visibility", "hidden");
      });
      svg.append(hitArea);
    });

    marker.setAttribute("visibility", "hidden");
  }

  yearlySeasonalCycles(rows, valueKey = "temperatureC") {
    const years = new Map();
    rows.forEach((row) => {
      const year = row.date.getFullYear();
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(row);
    });

    return Array.from(years.entries()).map(([year, values]) => ({
      year,
      values: values
        .filter((row) => row.month >= 0 && row.month <= 11 && Number.isFinite(row[valueKey]))
        .sort((a, b) => a.month - b.month),
    })).filter((cycle) => cycle.values.length >= 10);
  }

  drawHeatmapChart(svg, rows, anomalies) {
    const width = 560;
    const height = 560;
    const margin = { top: 28, right: 116, bottom: 76, left: 142 };
    const plotWidth = 300;
    const plotHeight = 380;
    const cellWidth = plotWidth / 12;
    const yearly = this.yearlySeasonalCycles(rows).filter((cycle) => cycle.values.length === 12);
    const minYear = yearly[0].year;
    const maxYear = yearly[yearly.length - 1].year;
    const cellHeight = plotHeight / yearly.length;
    const values = yearly.flatMap((cycle) => cycle.values.map((point) => point.temperatureC));
    const minValue = Math.floor(Math.min(...values));
    const maxValue = Math.ceil(Math.max(...values));
    const yearY = (year) => margin.top + ((maxYear - year) / (maxYear - minYear + 1)) * plotHeight;

    svg.replaceChildren();

    yearly.forEach((cycle, yearIndex) => {
      const y = margin.top + (yearly.length - 1 - yearIndex) * cellHeight;
      cycle.values.forEach((point) => {
        const rect = this.svgRect(margin.left + point.month * cellWidth, y, cellWidth, cellHeight, "heatmap-cell");
        rect.setAttribute("fill", this.temperatureColor(point.temperatureC, minValue, maxValue));
        svg.append(rect);
      });
    });

    svg.append(this.svgLine(margin.left, margin.top, margin.left, margin.top + plotHeight, "heatmap-axis-line"));
    svg.append(this.svgLine(margin.left, margin.top + plotHeight, margin.left + plotWidth, margin.top + plotHeight, "heatmap-axis-line"));
    [1980, 1990, 2000, 2010, 2020].forEach((year) => {
      const y = yearY(year);
      svg.append(this.svgLine(margin.left, y, margin.left + plotWidth, y, "data-chart-grid"));
      svg.append(this.svgText(margin.left - 60, y + 6, String(year), "heatmap-axis-label"));
    });
    [1, 3, 5, 7, 9, 11].forEach((month) => {
      const x = margin.left + month * cellWidth + cellWidth / 2;
      svg.append(this.svgText(x - 6, margin.top + plotHeight + 30, String(month + 1), "heatmap-axis-label"));
    });

    svg.append(this.svgText(50, margin.top + plotHeight / 2 + 72, "Year", "heatmap-axis-title", `rotate(-90 20 ${margin.top + plotHeight / 2 + 28})`));
    svg.append(this.svgText(margin.left + plotWidth / 2 - 30, margin.top + plotHeight + 58, "Month", "heatmap-axis-title"));
    svg.append(this.svgText(10, margin.top + plotHeight / 2, "axis 0", "heatmap-axis-title heatmap-dimension-axis", `rotate(-90 16 ${margin.top + plotHeight / 2})`));
    this.appendHeatmapArrow(svg, 30, margin.top + 2, 30, margin.top + plotHeight - 2);
    svg.append(this.svgText(margin.left + 125, margin.top + plotHeight + 100, "axis 1", "heatmap-axis-title heatmap-dimension-axis"));
    this.appendHeatmapArrow(svg, margin.left + 0, margin.top + plotHeight + 70, margin.left + 300, margin.top + plotHeight + 70);

    const colorbarX = margin.left + plotWidth + 26;
    this.drawHeatmapColorbar(svg, colorbarX, margin.top, 14, plotHeight, minValue, maxValue, "monthly temperature (°C)");
    svg.append(this.drawAnomalyHeatmapLayer(anomalies, margin, plotWidth, plotHeight, cellWidth, cellHeight, colorbarX));
  }

  drawAnomalyHeatmapLayer(rows, margin, plotWidth, plotHeight, cellWidth, cellHeight, colorbarX) {
    const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("class", "heatmap-anomaly-layer");
    const yearly = this.yearlySeasonalCycles(rows, "anomalyC").filter((cycle) => cycle.values.length === 12);
    const values = yearly.flatMap((cycle) => cycle.values.map((point) => point.anomalyC));
    const bound = Math.ceil(Math.max(...values.map((value) => Math.abs(value))));

    layer.append(this.svgRect(margin.left, margin.top, plotWidth, plotHeight, "heatmap-anomaly-cover"));
    layer.append(this.svgRect(colorbarX - 4, margin.top - 10, 126, plotHeight + 12, "heatmap-anomaly-cover"));
    yearly.forEach((cycle, yearIndex) => {
      const y = margin.top + (yearly.length - 1 - yearIndex) * cellHeight;
      cycle.values.forEach((point) => {
        const rect = this.svgRect(margin.left + point.month * cellWidth, y, cellWidth, cellHeight, "heatmap-cell");
        rect.setAttribute("fill", this.temperatureAnomalyColor(point.anomalyC, -bound, bound));
        layer.append(rect);
      });
    });
    layer.append(this.svgLine(margin.left, margin.top, margin.left, margin.top + plotHeight, "heatmap-axis-line"));
    layer.append(this.svgLine(margin.left, margin.top + plotHeight, margin.left + plotWidth, margin.top + plotHeight, "heatmap-axis-line"));
    this.drawHeatmapColorbar(layer, colorbarX, margin.top, 14, plotHeight, -bound, bound, "monthly Temp anomaly (°C)");
    return layer;
  }

  drawHeatmapColorbar(svg, x, y, width, height, minValue, maxValue, label) {
    const steps = 72;
    for (let index = 0; index < steps; index += 1) {
      const ratio = index / (steps - 1);
      const rect = this.svgRect(x, y + (1 - ratio) * height, width, height / steps + 1, "");
      const value = minValue + ratio * (maxValue - minValue);
      rect.setAttribute("fill", minValue < 0 ? this.temperatureAnomalyColor(value, minValue, maxValue) : this.temperatureColor(value, minValue, maxValue));
      svg.append(rect);
    }
    svg.append(this.svgLine(x, y, x, y + height, "heatmap-axis-line"));
    svg.append(this.svgLine(x + width, y, x + width, y + height, "heatmap-axis-line"));
    const ticks = minValue < 0 ? [minValue, 0, maxValue] : [0, 5, 10, 15, 20];
    ticks.filter((tick) => tick >= minValue && tick <= maxValue).forEach((tick) => {
      const ratio = (tick - minValue) / (maxValue - minValue);
      const tickY = y + (1 - ratio) * height;
      svg.append(this.svgLine(x + width, tickY, x + width + 7, tickY, "heatmap-axis-line"));
      svg.append(this.svgText(x + width + 12, tickY + 6, String(tick), "heatmap-axis-label"));
    });
    svg.append(this.svgText(x + 35, y + height / 2 + 120, label, "heatmap-colorbar-label", `rotate(-90 ${x + 48} ${y + height / 2 + 96})`));
  }

  temperatureColor(value, minValue, maxValue) {
    const stops = [
      [49, 97, 170],
      [146, 197, 222],
      [247, 247, 247],
      [244, 165, 130],
      [178, 24, 43],
    ];
    const ratio = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    const scaled = ratio * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(scaled));
    const local = scaled - index;
    const color = stops[index].map((channel, channelIndex) => {
      return Math.round(channel + (stops[index + 1][channelIndex] - channel) * local);
    });
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }

  temperatureAnomalyColor(value, minValue, maxValue) {
    const stops = [
      [49, 97, 170],
      [146, 197, 222],
      [247, 247, 247],
      [244, 165, 130],
      [178, 24, 43],
    ];
    const ratio = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    const scaled = ratio * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(scaled));
    const local = scaled - index;
    const color = stops[index].map((channel, channelIndex) => {
      return Math.round(channel + (stops[index + 1][channelIndex] - channel) * local);
    });
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }

  appendHeatmapArrow(svg, x1, y1, x2, y2) {
    svg.append(this.svgLine(x1, y1, x2, y2, "heatmap-axis-line heatmap-dimension-axis"));
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = 12;
    const spread = 0.46;
    const leftX = x2 - length * Math.cos(angle - spread);
    const leftY = y2 - length * Math.sin(angle - spread);
    const rightX = x2 - length * Math.cos(angle + spread);
    const rightY = y2 - length * Math.sin(angle + spread);
    const arrow = this.svgPath(
      `M${leftX.toFixed(1)} ${leftY.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${rightX.toFixed(1)} ${rightY.toFixed(1)}`,
      "heatmap-axis-arrow heatmap-dimension-axis",
    );
    svg.append(arrow);
  }

  drawChartFrame(svg, width, height, margin, yTicks, yScale) {
    const x0 = margin.left;
    const y0 = margin.top;
    const x1 = width - margin.right;
    const y1 = height - margin.bottom;
    yTicks.forEach((tick) => {
      svg.append(this.svgLine(x0, yScale(tick), x1, yScale(tick), "data-chart-grid"));
      svg.append(this.svgText(14, yScale(tick) + 5, tick.toFixed(tick % 1 === 0 ? 0 : 1), "data-chart-tick"));
    });
    svg.append(this.svgLine(x0, y0, x0, y1, "data-chart-axis"));
    svg.append(this.svgLine(x0, y1, x1, y1, "data-chart-axis"));
  }

  svgLine(x1, y1, x2, y2, className) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("class", className);
    return line;
  }

  svgPath(d, className) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", className);
    return path;
  }

  svgCircle(cx, cy, r, className) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", r);
    circle.setAttribute("class", className);
    return circle;
  }

  svgRect(x, y, width, height, className) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);
    rect.setAttribute("class", className);
    return rect;
  }

  svgText(x, y, text, className, transform = "") {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
    node.setAttribute("x", x);
    node.setAttribute("y", y);
    node.setAttribute("class", className);
    if (transform) node.setAttribute("transform", transform);
    node.textContent = text;
    return node;
  }

  loadPosition() {
    const params = new URLSearchParams(window.location.search);
    const linkedSlide = Number(params.get("slide"));
    const linkedStep = Number(params.get("step"));
    if (Number.isInteger(linkedSlide) && linkedSlide > 0) {
      return {
        slide: linkedSlide - 1,
        step: Number.isInteger(linkedStep) && linkedStep >= 0 ? linkedStep : 0,
      };
    }

    try {
      const saved = JSON.parse(window.localStorage.getItem(this.storageKey));
      return {
        slide: Number.isInteger(saved?.slide) ? saved.slide : 0,
        step: Number.isInteger(saved?.step) ? saved.step : 0,
      };
    } catch {
      return { slide: 0, step: 0 };
    }
  }

  savePosition() {
    if (this.isPreview) return;
    window.localStorage.setItem(
      this.storageKey,
      JSON.stringify({
        slide: this.currentSlide,
        step: this.currentStep,
      }),
    );
  }

  show(index, step = 0) {
    this.hideSlidePreview();
    this.currentSlide = Math.max(0, Math.min(index, this.slides.length - 1));
    const fragments = this.fragmentsFor(this.currentSlide);
    this.currentStep = Math.max(0, Math.min(step, fragments.length));

    this.slides.forEach((slide, slideIndex) => {
      const active = slideIndex === this.currentSlide;
      slide.classList.toggle("active", active);
      slide.dataset.step = active ? String(this.currentStep) : "0";

      const slideFragments = this.fragmentsFor(slideIndex);
      slideFragments.forEach((fragment, fragmentIndex) => {
        fragment.classList.toggle("visible", active && fragmentIndex < this.currentStep);
      });
    });

    this.dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === this.currentSlide);
    });

    const skipButton = document.getElementById("skipSteps");
    if (skipButton) {
      skipButton.disabled = fragments.length === 0 || this.currentStep === fragments.length;
    }

    const status = document.querySelector(".deck-status");
    if (status) {
      const slideText = `page ${this.currentSlide + 1} / ${this.slides.length}`;
      const stepText = fragments.length ? `step ${this.currentStep + 1}/${fragments.length + 1} ｜ ` : "";
      status.textContent = `${stepText}${slideText}`;
    }

    this.savePosition();
  }

  next() {
    const fragments = this.fragmentsFor(this.currentSlide);
    if (this.currentStep < fragments.length) {
      this.show(this.currentSlide, this.currentStep + 1);
      return;
    }
    if (this.currentSlide < this.slides.length - 1) {
      this.show(this.currentSlide + 1, 0);
    }
  }

  prev() {
    if (this.currentStep > 0) {
      this.show(this.currentSlide, this.currentStep - 1);
      return;
    }
    if (this.currentSlide > 0) {
      const previous = this.currentSlide - 1;
      this.show(previous, this.fragmentsFor(previous).length);
    }
  }

  nextPage() {
    if (this.currentSlide >= this.slides.length - 1) return;
    const next = this.currentSlide + 1;
    this.show(next, this.fragmentsFor(next).length);
  }

  prevPage() {
    if (this.currentSlide <= 0) return;
    const previous = this.currentSlide - 1;
    this.show(previous, this.fragmentsFor(previous).length);
  }

  nextPageStart() {
    if (this.currentSlide >= this.slides.length - 1) return;
    this.show(this.currentSlide + 1, 0);
  }

  prevPageStart() {
    if (this.currentSlide <= 0) return;
    this.show(this.currentSlide - 1, 0);
  }

  skipSteps() {
    const fragments = this.fragmentsFor(this.currentSlide);
    if (fragments.length === 0) return;
    this.show(this.currentSlide, fragments.length);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".deck-stage")) new CourseDeck();
});
