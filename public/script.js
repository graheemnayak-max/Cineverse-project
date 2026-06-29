// ============================================
// CineVerse — script.js
// Full-stack version: all media data is fetched
// from GET /api/media using query parameters.
// Features:
//   - Skeleton loading states during API latency
//   - Debounced search with fetch()
//   - Server-side category, search, and sort
//   - Client-side "My List" (localStorage)
//   - Detail modal, immersive theater, video fallback
//   - User authentication and watchlist sync
// ============================================

(function () {
  "use strict";

  // === Ambient glow color palette ===
  const GLOW_COLORS = [
    "rgba(138, 43, 226, 0.30)",
    "rgba(220, 20, 60, 0.30)",
    "rgba(0, 139, 139, 0.30)",
    "rgba(75, 0, 130, 0.30)",
    "rgba(199, 21, 133, 0.30)",
  ];

  // === API base URLs ===
  const API_BASE = "https://cineverse-project-koqp.onrender.com/api/media";
  const AUTH_BASE = "/api/auth";
  const USER_BASE = "/api/user";

  // === Live media data (fetched from backend) ===
  let mediaData = [];

  // === Loading state ===
  let isLoading = false;
  let fetchController = null; // AbortController to cancel stale requests

  // === Auth state ===
  let isAuthenticated = false;
  let userEmail = null;

  const HERO_VIDEO_SRC = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  // === Hero carousel slides ===
  const heroSlides = [
    { mediaId: "1", type: "video", videoSrc: HERO_VIDEO_SRC },
    { mediaId: "2", type: "image", image: "https://picsum.photos/seed/glass-orchard/1600/900" },
    { mediaId: "3", type: "image", image: "https://picsum.photos/seed/velvet-circuit/1600/900" },
    { mediaId: "4", type: "image", image: "https://picsum.photos/seed/hollow-frequencies/1600/900" },
    { mediaId: "5", type: "image", image: "https://picsum.photos/seed/neon-requiem/1600/900" },
  ];

  function findMedia(id) {
    // Match on both `id` (our custom field) and `_id` (MongoDB ObjectId as string)
    return mediaData.find((m) => String(m.id) === String(id) || String(m._id) === String(id));
  }

  const MY_LIST_KEY = "cineverse_my_list";

  // ============================================
  // State
  // ============================================
  let activeCategoryFilter = "all";
  let searchTerm = "";
  let sortMode = "match";
  let activeSlideIndex = 0;
  let autoplayTimer = null;
  const AUTOPLAY_MS = 7000;

  // ============================================
  // DOM references
  // ============================================
  const $ = (id) => document.getElementById(id);

  // Header elements
  const siteHeader = $("siteHeader");
  const authButton = $("authButton");
  const userMenu = $("userMenu");
  const userEmailDisplay = $("userEmailDisplay");
  const logoutButton = $("logoutButton");

  // Auth modal elements
  const authModal = $("authModal");
  const authBackdrop = $("authBackdrop");
  const closeAuthBtn = $("closeAuthBtn");
  const authTabs = $("authTabs");
  const loginTab = $("loginTab");
  const registerTab = $("registerTab");
  const authForm = $("authForm");
  const emailInput = $("emailInput");
  const passwordInput = $("passwordInput");
  const authSubmitBtn = $("authSubmitBtn");
  const authError = $("authError");
  const authSuccess = $("authSuccess");

  // Other elements
  const ambientGlow = $("ambientGlow");
  const searchInput = $("searchInput");
  const filterChips = $("filterChips");
  const sortSelect = $("sortSelect");
  const surpriseBtn = $("surpriseBtn");
  const bentoGrid = $("bentoGrid");
  const emptyState = $("emptyState");
  const resultCount = $("resultCount");

  const heroEl = $("home");
  const heroSlidesEl = $("heroSlides");
  const heroDotsEl = $("heroDots");
  const prevSlideBtn = $("prevSlideBtn");
  const nextSlideBtn = $("nextSlideBtn");
  const heroTextInner = $("heroTextInner");
  const heroEyebrow = $("heroEyebrow");
  const heroTitle = $("heroTitle");
  const heroDescription = $("heroDescription");
  const heroDetailBtn = $("heroDetailBtn");
  const heroFallbackBg = $("heroFallbackBg");
  const fallbackPanel = $("fallbackPanel");
  const reinitBtn = $("reinitBtn");
  const immersivePlayBtn = $("immersivePlayBtn");
  const muteToggleBtn = $("muteToggleBtn");

  const theaterModal = $("theaterModal");
  const theaterVideo = $("theaterVideo");
  const closeTheaterBtn = $("closeTheaterBtn");

  const detailModal = $("detailModal");
  const detailBackdrop = $("detailBackdrop");
  const closeDetailBtn = $("closeDetailBtn");
  const detailImage = $("detailImage");
  const detailTitle = $("detailTitle");
  const detailMeta = $("detailMeta");
  const detailDescription = $("detailDescription");
  const detailPlayBtn = $("detailPlayBtn");
  const detailListBtn = $("detailListBtn");

  const myListNavShortcut = document.querySelector('[data-filter-shortcut="mylist"]');

  let currentDetailId = null;

  // ============================================
  // Authentication
  // ============================================

  // Check auth status on page load
  async function checkAuthStatus() {
    try {
      const response = await fetch("/api/auth/status", {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        isAuthenticated = true;
        userEmail = data.email;
        updateAuthUI();
      }
    } catch (err) {
      console.error("Auth check failed:", err);
    }
  }

  // Update UI based on auth status
  function updateAuthUI() {
    if (isAuthenticated) {
      authButton.hidden = true;
      userMenu.hidden = false;
      userEmailDisplay.textContent = userEmail;
    } else {
      authButton.hidden = false;
      userMenu.hidden = true;
    }
  }

  // Show auth modal
  function showAuthModal(mode = "login") {
    authModal.hidden = false;
    document.body.style.overflow = "hidden";
    closeAuthBtn.focus();
    authError.textContent = "";
    authSuccess.textContent = "";
    emailInput.value = "";
    passwordInput.value = "";

    if (mode === "register") {
      loginTab.classList.remove("active");
      registerTab.classList.add("active");
      authSubmitBtn.textContent = "Register";
    } else {
      loginTab.classList.add("active");
      registerTab.classList.remove("active");
      authSubmitBtn.textContent = "Login";
    }
  }

  // Hide auth modal
  function hideAuthModal() {
    authModal.hidden = true;
    document.body.style.overflow = "";
  }

  // Handle auth form submission
  async function handleAuthSubmit(e) {
    e.preventDefault();
    authError.textContent = "";
    authSuccess.textContent = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const isRegister = registerTab.classList.contains("active");

    if (!email || !password) {
      authError.textContent = "Email and password are required";
      return;
    }

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Authentication failed");
      }

      const data = await response.json();
      authSuccess.textContent = isRegister ? "Registration successful! Please log in." : "Login successful!";
      isAuthenticated = true;
      userEmail = email;
      updateAuthUI();
      setTimeout(hideAuthModal, 1500);
    } catch (err) {
      authError.textContent = err.message;
    }
  }

  // Handle logout
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: 'include'
      });
      isAuthenticated = false;
      userEmail = null;
      updateAuthUI();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  // ============================================
  // My List (localStorage)
  // ============================================
  function getMyList() {
    try {
      const raw = localStorage.getItem(MY_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn("Could not read My List from storage:", err);
      return [];
    }
  }

  function saveMyList(list) {
    try {
      localStorage.setItem(MY_LIST_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("Could not save My List to storage:", err);
    }
  }

  function isInMyList(id) {
    const list = getMyList();
    return list.some((lid) => String(lid) === String(id));
  }

  async function toggleMyList(id) {
    if (!isAuthenticated) {
      showAuthModal();
      return false;
    }

    try {
      const method = isInMyList(id) ? "DELETE" : "POST";
      const response = await fetch("/api/user/list", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mediaId: id }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error("Failed to update watchlist");
      }

      // Update local storage
      const list = getMyList();
      const strId = String(id);
      const idx = list.findIndex((lid) => String(lid) === strId);
      if (idx === -1) {
        list.push(strId);
      } else {
        list.splice(idx, 1);
      }
      saveMyList(list);
      return list.some((lid) => String(lid) === strId);
    } catch (err) {
      console.error("Watchlist update failed:", err);
      return false;
    }
  }

  // ============================================
  // Ambient glow rotation
  // ============================================
  let glowIndex = 0;
  function setGlow() {
    ambientGlow.style.background =
      "radial-gradient(circle at center, " + GLOW_COLORS[glowIndex] + " 0%, transparent 70%)";
    glowIndex = (glowIndex + 1) % GLOW_COLORS.length;
  }
  setGlow();
  setInterval(setGlow, 5000);

  // ============================================
  // Header scroll state
  // ============================================
  window.addEventListener("scroll", () => {
    siteHeader.classList.toggle("scrolled", window.scrollY > 40);
  });

  // ============================================
  // Hero carousel — build slides + dots
  // ============================================
  function buildHeroSlides() {
    heroSlides.forEach((slide, i) => {
      const slideEl = document.createElement("div");
      slideEl.className = "hero-slide" + (i === 0 ? " active" : "");

      if (slide.type === "video") {
        const video = document.createElement("video");
        video.className = "hero-slide-video";
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "auto";
        video.dataset.slideIndex = String(i);
        const source = document.createElement("source");
        source.src = slide.videoSrc;
        source.type = "video/mp4";
        video.appendChild(source);
        video.addEventListener("error", showVideoFallback);
        slideEl.appendChild(video);
      } else {
        const bg = document.createElement("div");
        bg.className = "hero-slide-bg";
        bg.style.backgroundImage = "url(" + slide.image + ")";
        slideEl.appendChild(bg);
      }

      heroSlidesEl.appendChild(slideEl);

      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot" + (i === 0 ? " active" : "");
      const media = findMedia(slide.mediaId);
      dot.setAttribute("aria-label", "Show featured title: " + (media ? media.title : "slide " + (i + 1)));
      dot.addEventListener("click", () => { goToSlide(i); resetAutoplay(); });
      heroDotsEl.appendChild(dot);
    });
  }

  function getActiveVideo() {
    return heroSlidesEl.querySelector(".hero-slide-video[data-slide-index='" + activeSlideIndex + "']");
  }

  function updateMuteButtonForSlide() {
    const video = getActiveVideo();
    if (!video) {
      muteToggleBtn.hidden = true;
      return;
    }
    muteToggleBtn.hidden = false;
    muteToggleBtn.textContent = video.muted ? "🔇" : "🔊";
    muteToggleBtn.setAttribute("aria-pressed", String(video.muted));
  }

  function goToSlide(index) {
    const total = heroSlides.length;
    activeSlideIndex = ((index % total) + total) % total;

    const slideEls = heroSlidesEl.querySelectorAll(".hero-slide");
    slideEls.forEach((el, i) => el.classList.toggle("active", i === activeSlideIndex));

    const dotEls = heroDotsEl.querySelectorAll(".dot");
    dotEls.forEach((el, i) => el.classList.toggle("active", i === activeSlideIndex));

    heroSlidesEl.querySelectorAll(".hero-slide-video").forEach((v) => {
      if (Number(v.dataset.slideIndex) === activeSlideIndex) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });

    heroTextInner.classList.add("fade-out");
    setTimeout(() => {
      const media = findMedia(heroSlides[activeSlideIndex].mediaId);
      if (media) {
        heroEyebrow.textContent = activeSlideIndex === 0 ? "Featured Today" : "Also Trending";
        heroTitle.textContent = media.title;
        heroDescription.textContent = media.description;
      }
      heroTextInner.classList.remove("fade-out");
      updateMuteButtonForSlide();
    }, 320);
  }

  function nextSlide() { goToSlide(activeSlideIndex + 1); }
  function prevSlide() { goToSlide(activeSlideIndex - 1); }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(nextSlide, AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
  function resetAutoplay() { startAutoplay(); }

  heroEl.addEventListener("mouseenter", stopAutoplay);
  heroEl.addEventListener("mouseleave", startAutoplay);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  prevSlideBtn.addEventListener("click", () => { prevSlide(); resetAutoplay(); });
  nextSlideBtn.addEventListener("click", () => { nextSlide(); resetAutoplay(); });

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") { prevSlide(); resetAutoplay(); }
    if (e.key === "ArrowRight") { nextSlide(); resetAutoplay(); }
  });

  heroDetailBtn.addEventListener("click", () => {
    const media = findMedia(heroSlides[activeSlideIndex].mediaId);
    if (media) openDetail(media);
  });

  // ============================================
  // Video fallback handling
  // ============================================
  function showVideoFallback() {
    heroFallbackBg.hidden = false;
    fallbackPanel.hidden = false;
  }

  function hideVideoFallback() {
    heroFallbackBg.hidden = true;
    fallbackPanel.hidden = true;
  }

  reinitBtn.addEventListener("click", () => {
    hideVideoFallback();
    const video = heroSlidesEl.querySelector(".hero-slide-video");
    if (video) {
      video.load();
      video.play().catch(() => showVideoFallback());
    }
  });

  muteToggleBtn.addEventListener("click", () => {
    const video = getActiveVideo();
    if (!video) return;
    video.muted = !video.muted;
    updateMuteButtonForSlide();
  });

  // ============================================
  // Theater (immersive) modal
  // ============================================
  function openTheater() {
    theaterModal.hidden = false;
    theaterVideo.currentTime = 0;
    theaterVideo.play().catch(() => {});
    document.body.style.overflow = "hidden";
    closeTheaterBtn.focus();
  }

  function closeTheater() {
    theaterModal.hidden = true;
    theaterVideo.pause();
    document.body.style.overflow = "";
  }

  immersivePlayBtn.addEventListener("click", openTheater);
  closeTheaterBtn.addEventListener("click", closeTheater);
  theaterModal.addEventListener("click", (e) => {
    if (e.target === theaterModal) closeTheater();
  });

  // ============================================
  // Detail modal
  // ============================================
  function openDetail(item) {
    currentDetailId = item.id || item._id;
    detailImage.style.backgroundImage = "url(" + item.image + ")";
    detailTitle.textContent = item.title;
    detailMeta.innerHTML =
      item.year + " &nbsp;•&nbsp; " + item.rating + " &nbsp;•&nbsp; " + item.genre +
      ' &nbsp;•&nbsp; <span class="match">' + item.match + "% Match</span>";
    detailDescription.textContent = item.description;
    refreshDetailListButton();
    detailModal.hidden = false;
    document.body.style.overflow = "hidden";
    closeDetailBtn.focus();
  }

  function closeDetail() {
    detailModal.hidden = true;
    currentDetailId = null;
    document.body.style.overflow = "";
  }

  function refreshDetailListButton() {
    if (!currentDetailId) return;
    const listed = isInMyList(currentDetailId);
    detailListBtn.textContent = listed ? "✓ In My List" : "+ My List";
  }

  closeDetailBtn.addEventListener("click", closeDetail);
  detailBackdrop.addEventListener("click", closeDetail);

  detailPlayBtn.addEventListener("click", () => {
    closeDetail();
    openTheater();
  });

  detailListBtn.addEventListener("click", async () => {
    if (!currentDetailId) return;
    await toggleMyList(currentDetailId);
    refreshDetailListButton();
    renderGrid();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!theaterModal.hidden) closeTheater();
    if (!detailModal.hidden) closeDetail();
    if (!authModal.hidden) hideAuthModal();
  });

  // ============================================
  // API Layer — all data comes from the backend
  // ============================================

  // Map HTML <select> values to API sort param values
  function toApiSort(value) {
    switch (value) {
      case "match":  return "match";
      case "newest": return "year";
      case "az":     return "title";
      default:       return "match";
    }
  }

  // Build the fetch URL from current filter state
  function buildApiUrl(category, search, sort) {
    const params = new URLSearchParams();
    if (category && category !== "all" && category !== "mylist") {
      params.set("category", category);
    }
    if (search) {
      params.set("search", search);
    }
    if (sort) {
      params.set("sort", toApiSort(sort));
    }
    const query = params.toString();
    return API_BASE + (query ? "?" + query : "");
  }

  // Fetch media from the backend with AbortController support
  // to cancel in-flight requests when filters change rapidly.
  async function fetchMedia(category, search, sort) {
    // Cancel any previous in-flight request
    if (fetchController) {
      fetchController.abort();
    }
    fetchController = new AbortController();
    const signal = fetchController.signal;

    const url = buildApiUrl(category, search, sort);

    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error("API error: " + response.status);
    }
    const data = await response.json();

    // Normalize: ensure every item has an `id` string field
    // (MongoDB returns `_id`, our seed data includes `id`)
    return data.map((item) => ({
      ...item,
      id: String(item.id || item._id),
    }));
  }

  // ============================================
  // Skeleton Loading — visual placeholder cards
  // ============================================

  function renderSkeletons(count) {
    bentoGrid.innerHTML = "";
    emptyState.hidden = true;
    resultCount.textContent = "";

    const sizes = ["bento-spotlight", "bento-medium", "bento-small", "bento-small", "bento-small", "bento-small"];
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement("div");
      skeleton.className = "bento-card skeleton-card " + sizes[i % sizes.length];
      skeleton.setAttribute("aria-hidden", "true");
      skeleton.innerHTML =
        '<div class="skeleton-image"></div>' +
        '<div class="card-gradient"></div>' +
        '<div class="card-info">' +
          '<div class="skeleton-line skeleton-title"></div>' +
          '<div class="skeleton-line skeleton-meta"></div>' +
        '</div>';
      bentoGrid.appendChild(skeleton);
    }
  }

  function removeSkeletons() {
    bentoGrid.querySelectorAll(".skeleton-card").forEach((el) => el.remove());
  }

  // ============================================
  // Grid rendering — live data from API
  // ============================================

  function sizeClass(size) {
    if (size === "large") return "bento-spotlight";
    if (size === "medium") return "bento-medium";
    return "bento-small";
  }

  function renderGrid() {
    // "My List" is client-side filtered from the full dataset
    const data = activeCategoryFilter === "mylist"
      ? mediaData.filter((item) => isInMyList(item.id))
      : mediaData;

    // Clear existing cards (but not skeletons — they're replaced below)
    bentoGrid.innerHTML = "";

    if (data.length === 0 && !isLoading) {
      bentoGrid.hidden = true;
      emptyState.hidden = false;
      resultCount.textContent = "";
      return;
    }

    bentoGrid.hidden = false;
    emptyState.hidden = true;

    data.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "bento-card liquid-glass bento-card-hover " + sizeClass(item.size);
      card.setAttribute("aria-label", "View details for " + item.title);

      const listed = isInMyList(item.id);
      const trendingBadge = item.match >= 96 ? '<span class="card-trending">🔥 Trending</span>' : "";

      card.innerHTML =
        '<div class="card-image" style="background-image:url(' + item.image + ')"></div>' +
        '<div class="card-gradient"></div>' +
        trendingBadge +
        '<button type="button" class="card-list-btn' + (listed ? " is-listed" : "") +
          '" aria-label="' + (listed ? "Remove from My List" : "Add to My List") + '" data-id="' + item.id + '">' +
          (listed ? "✓" : "+") +
        "</button>" +
        '<div class="card-play-hint">▶</div>' +
        '<div class="card-info">' +
          '<h3 class="card-title">' + item.title + "</h3>" +
          '<p class="card-meta">' + item.genre + ' • <span class="match">' + item.match + "% Match</span></p>" +
        "</div>";

      // Fade-in animation for freshly loaded cards
      card.classList.add("card-enter");

      card.addEventListener("click", (e) => {
        if (e.target.closest(".card-list-btn")) return;
        openDetail(item);
      });

      const listBtn = card.querySelector(".card-list-btn");
      listBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await toggleMyList(item.id);
        renderGrid();
      });

      bentoGrid.appendChild(card);
    });

    resultCount.textContent = data.length
      ? data.length + (data.length === 1 ? " title" : " titles")
      : "";
  }

  // ============================================
  // Data loading pipeline — shows skeletons during fetch
  // ============================================

  async function loadFilteredData() {
    isLoading = true;

    // Show skeleton placeholders while waiting
    renderSkeletons(8);

    try {
      if (activeCategoryFilter === "mylist") {
        // "My List" is client-side — fetch all data, then filter locally
        mediaData = await fetchMedia("all", "", "");
      } else {
        // Let the API handle category, search, and sort
        mediaData = await fetchMedia(activeCategoryFilter, searchTerm, sortMode);
      }
    } catch (err) {
      // Ignore AbortError (stale request cancelled)
      if (err.name === "AbortError") return;

      console.error("Failed to load media from API:", err);
      mediaData = [];
      bentoGrid.innerHTML = "";
      bentoGrid.hidden = true;
      emptyState.hidden = false;
      emptyState.textContent = "Could not load titles from the server. Please make sure the backend is running.";
      isLoading = false;
      return;
    }

    isLoading = false;
    renderGrid();
  }

  // ============================================
  // Toolbar interactions — all async via API
  // ============================================

  filterChips.addEventListener("click", async (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    activeCategoryFilter = chip.dataset.filter;
    [...filterChips.children].forEach((c) => c.classList.toggle("active", c === chip));
    await loadFilteredData();
  });

  if (myListNavShortcut) {
    myListNavShortcut.addEventListener("click", () => {
      const targetChip = filterChips.querySelector('[data-filter="mylist"]');
      if (targetChip) targetChip.click();
      document.getElementById("featured").scrollIntoView({ behavior: "smooth" });
    });
  }

  // Debounced search — fires API request after 300ms of inactivity
  let searchDebounce;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      searchTerm = e.target.value.trim();
      await loadFilteredData();
    }, 300);
  });

  sortSelect.addEventListener("change", async (e) => {
    sortMode = e.target.value;
    await loadFilteredData();
  });

  surpriseBtn.addEventListener("click", () => {
    // "My List" is client-filtered; otherwise use current fetched data
    const pool = activeCategoryFilter === "mylist"
      ? mediaData.filter((item) => isInMyList(item.id))
      : mediaData;
    const source = pool.length ? pool : mediaData;
    if (!source.length) return;
    const pick = source[Math.floor(Math.random() * source.length)];
    openDetail(pick);
  });

  // ============================================
  // Init — fetch from API, then build UI
  // ============================================
  async function init() {
    // Check auth status first
    await checkAuthStatus();

    try {
      mediaData = await fetchMedia("all", "", "");
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Failed to load media from API:", err);
      emptyState.hidden = false;
      emptyState.textContent = "Could not load titles from the server. Please make sure the backend is running.";
      return;
    }
    buildHeroSlides();
    updateMuteButtonForSlide();
    startAutoplay();
    renderGrid();

    // Set up auth modal event listeners
    authButton.addEventListener("click", () => showAuthModal("login"));
    loginTab.addEventListener("click", () => showAuthModal("login"));
    registerTab.addEventListener("click", () => showAuthModal("register"));
    closeAuthBtn.addEventListener("click", hideAuthModal);
    authBackdrop.addEventListener("click", hideAuthModal);
    authForm.addEventListener("submit", handleAuthSubmit);
    logoutButton.addEventListener("click", handleLogout);
  }

  init();
})();