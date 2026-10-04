const STORAGE = {
  favorites: "byu-study-finder:favorites",
  filters: "byu-study-finder:active-filters",
  saved: "byu-study-finder:saved-filters",
  recent: "byu-study-finder:recent-filters",
  userSpots: "byu-study-finder:user-spots"
};

const defaultFilters = () => ({ features: [], building: "", groupSize: "" });
const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const state = {
  page: "start",
  previousPage: "start",
  activeFilters: readJSON(STORAGE.filters, defaultFilters()),
  favorites: readJSON(STORAGE.favorites, []),
  savedFilters: readJSON(STORAGE.saved, []),
  recentFilters: readJSON(STORAGE.recent, []),
  userSpots: readJSON(STORAGE.userSpots, []),
  selectedSpotId: null,
  mapPopupSpotId: null,
  currentBuilding: BUILDINGS[0].name,
  currentFloor: "1",
  sort: "building",
  filterOpen: false,
  homeOpen: false,
  onboardingSelection: [],
  addSpot: { floor: "1", position: null, tags: [], errors: {}, success: false }
};

const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");

const icon = (name, size = 20) => {
  const paths = {
    home: `<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/><path d="M8 21h8"/>`,
    map: `<path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15m6-12v15"/>`,
    list: `<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>`,
    star: `<path d="m12 3 2.8 5.67 6.2.9-4.5 4.4 1.06 6.2L12 17.25 6.44 20.17 7.5 13.97 3 9.57l6.2-.9L12 3Z"/>`,
    close: `<path d="m6 6 12 12M18 6 6 18"/>`,
    arrow: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
    back: `<path d="M19 12H5M11 18l-6-6 6-6"/>`,
    pin: `<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    users: `<path d="M16 20v-1.8a3.2 3.2 0 0 0-3.2-3.2H7.2A3.2 3.2 0 0 0 4 18.2V20"/><circle cx="10" cy="8" r="3"/><path d="M20 20v-1.8a3.2 3.2 0 0 0-2.4-3.1M16 5.1a3 3 0 0 1 0 5.8"/>`,
    sliders: `<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v4m8 2v4m-5 4v4"/>`,
    spark: `<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/>`,
    check: `<path d="m5 12 4 4L19 6"/>`,
    trash: `<path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/>`,
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};

const allSpots = () => [...MOCK_SPOTS, ...state.userSpots];
const buildingNames = () => [...new Set(allSpots().map(s => s.building))].sort();
const isFavorite = id => state.favorites.includes(id);
const filtersAreActive = filters => Boolean(filters.features?.length || filters.building || filters.groupSize);
const featureLabel = key => key === "indoors" ? "Indoors" : FEATURE_META.find(([id]) => id === key)?.[1] || key;
const filtersLabelList = filters => {
  const labels = (filters.features || []).map(featureLabel);
  if (filters.building) labels.push(filters.building);
  if (filters.groupSize) labels.push(filters.groupSize[0].toUpperCase() + filters.groupSize.slice(1));
  return labels;
};
const cloneFilters = filters => ({ features: [...(filters.features || [])], building: filters.building || "", groupSize: filters.groupSize || "" });
const matchesFilters = (spot, filters = state.activeFilters) => {
  if (filters.building && spot.building !== filters.building) return false;
  if (filters.groupSize && spot.groupSize !== filters.groupSize) return false;
  return (filters.features || []).every(feature => {
    if (feature === "indoors") return !spot.features.outdoors;
    return Boolean(spot.features[feature]);
  });
};
const filteredSpots = (filters = state.activeFilters) => allSpots().filter(spot => matchesFilters(spot, filters));
const findSpot = id => allSpots().find(spot => spot.id === id);
const currentBuildingData = () => BUILDINGS.find(b => b.name === state.currentBuilding) || BUILDINGS[0];
const floorsForBuilding = building => [...new Set(allSpots().filter(s => s.building === building).map(s => s.floor))].sort((a,b) => Number(a)-Number(b));
const saveActiveFilters = () => writeJSON(STORAGE.filters, state.activeFilters);
const persistUser = () => {
  writeJSON(STORAGE.favorites, state.favorites);
  writeJSON(STORAGE.saved, state.savedFilters);
  writeJSON(STORAGE.recent, state.recentFilters);
  writeJSON(STORAGE.userSpots, state.userSpots);
};
const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const busyClass = busyness => busyness === "Moderate" ? "busyness-moderate" : busyness === "Usually busy" ? "busyness-busy" : "";
const busynessRank = busyness => BUSYNESS_ORDER[busyness] ?? 1;

function setPage(page, options = {}) {
  if (page !== "start" && page !== "details") state.previousPage = state.page;
  state.page = page;
  state.homeOpen = false;
  state.filterOpen = false;
  if (options.spotId) state.selectedSpotId = options.spotId;
  if (options.building) { state.currentBuilding = options.building; state.currentFloor = floorsForBuilding(options.building)[0] || "1"; }
  if (options.floor) state.currentFloor = options.floor;
  if (options.popupSpotId !== undefined) state.mapPopupSpotId = options.popupSpotId;
  if (options.previousPage) state.previousPage = options.previousPage;
  window.location.hash = page;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(message) {
  toastRegion.innerHTML = `<div class="toast">${escapeHTML(message)}</div>`;
  requestAnimationFrame(() => toastRegion.querySelector(".toast")?.classList.add("show"));
  setTimeout(() => toastRegion.querySelector(".toast")?.classList.remove("show"), 2400);
}

function topBar() {
  const activeMenuPage = state.page === "favorites" ? "favorites" : state.page === "list" ? "list" : state.page === "map" || state.page === "floor" ? "map" : "";
  return `<header class="topbar">
    <a class="brand" href="#start" data-nav="start"><span class="brand-mark">${icon("spark", 18)}</span><span>BYU Study Spot Finder</span></a>
    <nav class="topnav" aria-label="Primary navigation">
      <a href="#map" data-nav="map" class="${activeMenuPage === "map" ? "active" : ""}">Map</a>
      <a href="#list" data-nav="list" class="${activeMenuPage === "list" ? "active" : ""}">List</a>
      <a href="#favorites" data-nav="favorites" class="${activeMenuPage === "favorites" ? "active" : ""}">Favorites</a>
    </nav>
    <div class="topbar-spacer"></div>
    <div class="home-menu-wrap">
      <button class="icon-btn ${state.homeOpen ? "active" : ""}" data-action="toggle-home" aria-label="Open home menu" aria-expanded="${state.homeOpen}">${icon("home")}</button>
      ${state.homeOpen ? `<div class="home-menu" role="menu">
        <button class="${activeMenuPage === "favorites" ? "current" : ""}" data-nav="favorites">${icon("star", 15)} &nbsp; Favorites</button>
        <button class="${activeMenuPage === "list" ? "current" : ""}" data-nav="list">${icon("list", 15)} &nbsp; Study Spot List</button>
        <button class="${activeMenuPage === "map" ? "current" : ""}" data-nav="map">${icon("map", 15)} &nbsp; Campus Map</button>
        <div class="menu-rule"></div>
        <button data-action="start-over">${icon("spark", 15)} &nbsp; Start Over</button>
        <button data-nav="add">${icon("plus", 15)} &nbsp; Add a Spot</button>
      </div>` : ""}
    </div>
  </header>`;
}

function filterChips(filters, removable = false) {
  const labels = filtersLabelList(filters);
  if (!labels.length) return "";
  return labels.map(label => {
    const featureKey = FEATURE_META.find(([, name]) => name === label)?.[0];
    const isGroup = GROUP_SIZES.some(size => size.toLowerCase() === label.toLowerCase());
    const removeAction = featureKey ? `data-remove-feature="${featureKey}"` : isGroup ? `data-remove-group="true"` : `data-remove-building="true"`;
    return `<span class="mini-chip">${escapeHTML(label)}${removable ? `<button ${removeAction} aria-label="Remove ${escapeHTML(label)}">${icon("close", 12)}</button>` : ""}</span>`;
  }).join("");
}

function activeFilterBar() {
  if (!filtersAreActive(state.activeFilters)) return `<div class="active-filter-bar"><span class="modal-note">Showing all spots</span></div>`;
  return `<div class="active-filter-bar">${filterChips(state.activeFilters, true)}<button class="link-btn" data-action="clear-filters">Clear all</button></div>`;
}

function spotCard(spot) {
  const visibleFeatures = FEATURE_META.filter(([key]) => spot.features[key]).slice(0, 4);
  return `<article class="spot-card" data-spot-id="${escapeHTML(spot.id)}" tabindex="0" role="button" aria-label="View ${escapeHTML(spot.name)}">
    <div class="spot-card-top"><div><h3>${escapeHTML(spot.name)}${state.userSpots.some(s => s.id === spot.id) ? `<span class="my-badge">My spot</span>` : ""}</h3><div class="spot-location">${escapeHTML(spot.building)} · Floor ${escapeHTML(spot.floor)}</div></div><button class="star-btn ${isFavorite(spot.id) ? "is-favorite" : ""}" data-favorite="${escapeHTML(spot.id)}" aria-label="${isFavorite(spot.id) ? "Remove from" : "Add to"} favorites">${isFavorite(spot.id) ? "★" : "☆"}</button></div>
    <div class="spot-card-bottom"><div class="feature-icons">${visibleFeatures.map(([key,,short]) => `<span class="feature-pill positive">${escapeHTML(short)}</span>`).join("")}</div><span class="busyness ${busyClass(spot.busyness)}"><i class="busyness-dot"></i>${escapeHTML(spot.busyness)}</span></div>
  </article>`;
}

function startPage() {
  const chips = [
    ["foodAllowed", "Food allowed"], ["talkingAllowed", "Group work / Talking allowed"], ["quietZone", "Quiet zone"], ["outlets", "Outlets"], ["tables", "Tables"], ["comfySeating", "Comfy seating"], ["outdoors", "Outdoors"], ["indoors", "Indoors"]
  ];
  return `<main class="page onboarding"><div class="onboarding-hero"><section><p class="eyebrow">Find your next focus zone</p><h1>What do you want in your study spot?</h1><p class="subtext">Select all that apply. We’ll surface spots across campus that fit the way you want to study today.</p><div class="onboarding-options"><p class="option-label">Your essentials</p><div class="chip-row">${chips.map(([key, label]) => `<button class="filter-chip ${state.onboardingSelection.includes(key) ? "selected" : ""}" data-start-filter="${key}"><span class="chip-check">✓</span>${label}</button>`).join("")}</div><p class="required-note">Choose at least one to get a tailored list.</p></div><div class="hero-actions"><button class="btn btn-primary" data-action="start-go" ${state.onboardingSelection.length ? "" : "disabled"}>Go ${icon("arrow", 17)}</button><button class="btn btn-secondary" data-action="random-spot">${icon("spark", 16)} Find a new study spot!</button></div></section><aside class="onboarding-art" aria-label="Illustration of a campus study map"><div class="art-card small one"><div class="art-label"><i></i> Open now for you</div><strong>Small group tables</strong><p class="modal-note">Talmage Building · Floor 1</p></div><div class="art-card main"><div class="art-label"><i></i> Campus view</div><div class="art-dots">${Array.from({length: 20}, (_, i) => `<span key="${i}"></span>`).join("")}</div><p style="margin:12px 0 0;font-weight:700">Study spots, your way.</p></div><div class="art-card small two"><div class="art-label"><i></i> Typical busyness</div><strong style="font-size:23px;font-family:var(--font-display)">Usually empty</strong></div></aside></div></main>`;
}

function mapPage() {
  const matchesByBuilding = Object.fromEntries(BUILDINGS.map(building => [building.name, filteredSpots().filter(s => s.building === building.name)]));
  const active = filtersAreActive(state.activeFilters);
  const popupSpot = state.mapPopupSpotId ? findSpot(state.mapPopupSpotId) : null;
  return `<main class="page"><div class="page-heading"><div><p class="eyebrow">Explore campus</p><h2>Campus map</h2><p class="subtext">Tap a building to see its study spots. Busyness is typical, estimated activity—not live data.</p></div><button class="btn btn-secondary panel-trigger" data-action="open-filters">${icon("sliders", 17)} Filters${active ? ` · ${filteredSpots().length}` : ""}</button></div><div class="map-layout"><div class="map-card"><div class="map-wrap"><svg class="campus-map" viewBox="0 0 960 600" role="img" aria-label="Simplified BYU campus map"><path class="map-road" d="M-20 210 C180 190 260 210 440 190 S760 175 980 200 M230 -20 C240 160 260 280 220 620 M650 -20 C620 190 670 380 650 620"/><path class="map-path" d="M0 210 C180 190 260 210 440 190 S760 175 960 200 M230 0 C240 160 260 280 220 600 M650 0 C620 190 670 380 650 600"/>${BUILDINGS.map(building => { const spots = matchesByBuilding[building.name] || []; const allInBuilding = allSpots().filter(s => s.building === building.name); const selected = popupSpot?.building === building.name; return `<g data-building="${escapeHTML(building.name)}"><rect class="map-building ${building.color} ${active && !spots.length ? "dim" : ""} ${spots.length ? "highlight" : ""} ${selected ? "selected" : ""}" x="${building.x}" y="${building.y}" width="${building.w}" height="${building.h}" rx="15" tabindex="0"/><text class="map-label" x="${building.x + building.w/2}" y="${building.y + 46}" text-anchor="middle">${escapeHTML(building.short)}</text><text class="map-label" x="${building.x + building.w/2}" y="${building.y + 65}" text-anchor="middle" style="font-size:10px;font-weight:500">${allInBuilding.length} study spot${allInBuilding.length === 1 ? "" : "s"}</text>${active && spots.length ? `<g><rect x="${building.x + building.w - 68}" y="${building.y + 10}" width="56" height="22" rx="11" fill="#0d3b4c"/><text x="${building.x + building.w - 40}" y="${building.y + 25}" text-anchor="middle" fill="white" style="font-size:10px;font-weight:700">${spots.length} spots</text></g>` : ""}</g>`; }).join("")}<text x="480" y="540" text-anchor="middle" fill="#668078" style="font-size:12px;font-weight:700;letter-spacing:.08em">NORTH CAMPUS QUAD</text></svg>${popupSpot ? `<div class="map-popup" style="left: ${Math.min(72, Math.max(4, ((BUILDINGS.find(b => b.name === popupSpot.building)?.x || 0) / 9.6)))}%; top: 12%;"><h3>${escapeHTML(popupSpot.name)}</h3><p>${escapeHTML(popupSpot.building)} · Floor ${escapeHTML(popupSpot.floor)}</p><button class="btn btn-primary btn-small" data-details="${escapeHTML(popupSpot.id)}">View details ${icon("arrow", 13)}</button></div>` : ""}</div></div><aside class="map-side-card"><h3>Make it yours</h3><p>Use filters to narrow the map to spots that fit your study style. Buildings without a match fade into the background.</p><button class="btn btn-primary" style="width:100%;margin-top:8px" data-action="open-filters">${icon("sliders", 16)} ${active ? "Edit filters" : "Filter study spots"}</button><div class="map-legend"><div class="legend-item"><span class="legend-swatch"></span> Building with spots</div><div class="legend-item"><span class="legend-swatch dimmed"></span> No matching spots</div><div class="legend-item"><span class="legend-swatch marker"></span> Selected spot</div></div><div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--line)"><p class="modal-note"><strong>${filteredSpots().length}</strong> of ${allSpots().length} spots match your current filters.</p></div></aside></div>${filterPanel()}</main>`;
}

function filterPanel() {
  const draft = state._draftFilters || state.activeFilters;
  const count = filteredSpots(draft).length;
  return `<div class="filter-overlay ${state.filterOpen ? "open" : ""}" data-action="close-filters"></div><aside class="filter-panel ${state.filterOpen ? "open" : ""}" aria-label="Study spot filters"><div class="filter-panel-header"><h2>Filter spots</h2><button class="icon-btn" data-action="close-filters" aria-label="Close filters">${icon("close", 19)}</button></div><div class="filter-section"><h3>Features</h3><div class="check-grid">${FEATURE_META.map(([key, label]) => `<label class="check-row"><input type="checkbox" data-filter-feature="${key}" ${draft.features.includes(key) ? "checked" : ""}/> <span>${label}</span></label>`).join("")}</div></div><div class="filter-section"><h3>Building</h3><select class="select" style="width:100%" data-filter-building><option value="">All buildings</option>${buildingNames().map(building => `<option value="${escapeHTML(building)}" ${draft.building === building ? "selected" : ""}>${escapeHTML(building)}</option>`).join("")}</select></div><div class="filter-section"><h3>Group size <span style="color:var(--accent)">· key for group study</span></h3><div class="group-size-options"><label class="group-option"><input type="radio" name="group-size" value="" ${!draft.groupSize ? "checked" : ""}/> Any group size</label>${GROUP_SIZES.map(size => `<label class="group-option"><input type="radio" name="group-size" value="${size}" ${draft.groupSize === size ? "checked" : ""}/> ${size[0].toUpperCase() + size.slice(1)}</label>`).join("")}</div></div><div class="filter-panel-actions"><div class="filter-count">Show ${count} spot${count === 1 ? "" : "s"}</div><button class="btn btn-primary" data-action="apply-filters">Apply filters</button><button class="btn btn-secondary" data-action="save-filter">Save these filters</button><button class="btn btn-ghost" data-action="reset-filters">Reset</button></div></aside>`;
}

function floorPage() {
  const building = currentBuildingData();
  const floors = floorsForBuilding(building.name);
  if (!floors.includes(state.currentFloor)) state.currentFloor = floors[0] || "1";
  const floorSpots = allSpots().filter(s => s.building === building.name && s.floor === state.currentFloor);
  return `<main class="page"><a class="back-link" href="#map" data-nav="map">${icon("back", 16)} Back to map</a><div class="page-heading"><div><p class="eyebrow">Building view</p><h2>${escapeHTML(building.name)}</h2><p class="subtext">Choose a floor, then tap a glowing marker or spot below.</p></div></div><div class="floor-tabs" role="tablist">${floors.map(floor => `<button class="floor-tab ${state.currentFloor === floor ? "active" : ""}" data-floor="${escapeHTML(floor)}">Floor ${escapeHTML(floor)}</button>`).join("")}</div><div class="floor-layout"><section class="floor-plan"><div class="floor-plan-inner"><div class="floor-wall one"></div><div class="floor-wall two"></div><div class="floor-wall three"></div><div class="floor-wall four"></div><div class="floor-hall"></div><span class="floor-name-tag">Floor ${escapeHTML(state.currentFloor)} · simplified plan</span>${floorSpots.map(spot => `<button class="floor-marker ${matchesFilters(spot) ? "" : "dim"} ${state.selectedSpotId === spot.id ? "active" : ""}" style="left:${spot.position.x}%;top:${spot.position.y}%" data-details="${escapeHTML(spot.id)}" aria-label="${escapeHTML(spot.name)}"></button>`).join("")}</div></section><section class="floor-list"><div class="floor-list-heading"><h3>Spots on this floor</h3><span>${floorSpots.length} spot${floorSpots.length === 1 ? "" : "s"}</span></div>${floorSpots.map(spot => `<button class="floor-spot-item" data-details="${escapeHTML(spot.id)}"><div class="spot-card-top"><div><h3>${escapeHTML(spot.name)}</h3><div class="spot-location">${escapeHTML(spot.groupSize)} · ${escapeHTML(spot.busyness)}</div></div><span style="color:var(--accent)">${icon("pin", 16)}</span></div><div class="feature-icons">${FEATURE_META.filter(([key]) => spot.features[key]).slice(0, 3).map(([,label]) => `<span class="feature-pill positive">${label}</span>`).join("")}</div></button>`).join("")}</section></div></main>`;
}

function listPage() {
  let spots = filteredSpots();
  if (state.sort === "busy") spots = [...spots].sort((a,b) => busynessRank(a.busyness) - busynessRank(b.busyness) || a.name.localeCompare(b.name));
  if (state.sort === "az") spots = [...spots].sort((a,b) => a.name.localeCompare(b.name));
  let content = "";
  if (!spots.length) content = `<div class="empty-state"><div class="empty-icon">${icon("spark", 24)}</div><h3>No spots match your filters</h3><p>Try removing a filter or looking across more of campus.</p><button class="btn btn-primary" data-action="clear-filters">Clear filters</button></div>`;
  else if (state.sort === "building") {
    const groups = buildingNames().map(building => ({ building, spots: spots.filter(s => s.building === building).sort((a,b) => Number(a.floor) - Number(b.floor) || a.name.localeCompare(b.name)) })).filter(group => group.spots.length);
    content = groups.map(group => `<section class="spot-group"><div class="group-heading"><strong>${escapeHTML(group.building)}</strong><span></span><small>${group.spots.length}</small></div><div class="spot-grid">${group.spots.map(spotCard).join("")}</div></section>`).join("");
  } else content = `<div class="spot-grid">${spots.map(spotCard).join("")}</div>`;
  return `<main class="page"><div class="page-heading"><div><p class="eyebrow">Your campus directory</p><h2>Study spot list</h2><p class="subtext">Every spot in the system, including your personal additions. Typical busyness is an estimate—not live data.</p></div><button class="btn btn-secondary panel-trigger" data-action="open-filters">${icon("sliders", 17)} Filters${filtersAreActive(state.activeFilters) ? ` · ${filteredSpots().length}` : ""}</button></div>${activeFilterBar()}<div class="toolbar"><span class="modal-note"><strong>${spots.length}</strong> spot${spots.length === 1 ? "" : "s"} shown</span><div class="toolbar-actions"><label class="modal-note" for="sort-select">Sort by</label><select class="select" id="sort-select" data-sort><option value="building" ${state.sort === "building" ? "selected" : ""}>Building</option><option value="busy" ${state.sort === "busy" ? "selected" : ""}>Least busy</option><option value="az" ${state.sort === "az" ? "selected" : ""}>A–Z</option></select><button class="btn btn-primary panel-trigger" data-action="open-filters">${icon("sliders", 16)} Filter</button></div></div>${content}${filterPanel()}</main>`;
}

function detailsPage() {
  const spot = findSpot(state.selectedSpotId) || allSpots()[0];
  if (!spot) return `<main class="page"><div class="empty-state"><h3>Spot not found</h3></div></main>`;
  return `<main class="page"><button class="back-link" data-action="close-details">${icon("back", 16)} Back</button><article class="details-card"><div class="detail-top"><div><p class="eyebrow">Spot details</p><h1>${escapeHTML(spot.name)}</h1><p class="spot-location">${escapeHTML(spot.building)} · Floor ${escapeHTML(spot.floor)}</p></div><button class="star-btn ${isFavorite(spot.id) ? "is-favorite" : ""}" data-favorite="${escapeHTML(spot.id)}" aria-label="Toggle favorite">${isFavorite(spot.id) ? "★" : "☆"}</button></div><p class="subtext" style="margin-top:25px">${escapeHTML(spot.description)}</p><div class="detail-actions"><span class="busyness ${busyClass(spot.busyness)}" style="align-self:center"><i class="busyness-dot"></i>${escapeHTML(spot.busyness)}<span class="estimate-note">Typical estimate</span></span><span style="flex:1"></span><button class="btn btn-secondary" data-action="show-on-map" data-spot="${escapeHTML(spot.id)}">${icon("map", 16)} Show on map</button></div><h3>Features</h3><div class="feature-list">${FEATURE_META.map(([key,label]) => `<div class="feature-line ${spot.features[key] ? "" : "off"}"><span class="check">${spot.features[key] ? "✓" : "✗"}</span><strong>${label}</strong></div>`).join("")}<div class="feature-line"><span class="check" style="color:var(--primary)">${icon("users", 18)}</span><strong>Group size: ${escapeHTML(spot.groupSize)}</strong></div></div></article></main>`;
}

function favoritesPage() {
  const favorites = state.favorites.map(findSpot).filter(Boolean);
  const saved = state.savedFilters;
  const recent = state.recentFilters.slice(0, 5);
  const savedCard = filterSet => `<article class="saved-filter"><div class="saved-filter-head"><h3>${escapeHTML(filterSet.name)}</h3>${filterSet.recent ? `<span class="recent-label">Recent</span>` : ""}</div><div class="chip-row">${filterChips(filterSet.filters) || `<span class="tiny-chip">All spots</span>`}</div><div class="saved-actions"><button class="link-btn" data-apply-filter="${escapeHTML(filterSet.id)}">Apply</button>${!filterSet.recent ? `<button class="link-btn" data-rename-filter="${escapeHTML(filterSet.id)}">Rename</button><button class="link-btn" data-delete-filter="${escapeHTML(filterSet.id)}">Delete</button>` : ""}</div></article>`;
  return `<main class="page"><div class="page-heading"><div><p class="eyebrow">Your shortcuts</p><h2>Favorites & saved filters</h2><p class="subtext">Keep your favorite corners close and reuse the filters that fit your routine.</p></div></div><div class="two-column"><section class="section-card"><h3>Favorite spots <span style="color:var(--muted);font-size:13px;font-family:var(--font-body)">${favorites.length}</span></h3>${favorites.length ? `<div class="favorite-list">${favorites.map(spot => `<article class="favorite-row"><div><button class="link-btn" data-details="${escapeHTML(spot.id)}" style="font-size:16px;text-decoration:none">${escapeHTML(spot.name)}</button><div class="favorite-meta">${escapeHTML(spot.building)} · Floor ${escapeHTML(spot.floor)}</div></div><div class="favorite-actions"><button class="btn btn-secondary btn-small" data-map-spot="${escapeHTML(spot.id)}">${icon("map", 13)} View on map</button><button class="icon-btn" data-remove-favorite="${escapeHTML(spot.id)}" aria-label="Remove favorite">${icon("trash", 15)}</button></div></article>`).join("")}</div>` : `<div class="empty-state" style="padding:28px 14px;border:0;background:#f7faf8"><div class="empty-icon">★</div><h3 style="font-size:18px">No favorites yet</h3><p style="font-size:13px">Tap the ★ on any spot to save it.</p></div>`}</section><section class="section-card"><h3>Saved filters</h3>${saved.length ? `<div class="saved-list">${saved.map(savedCard).join("")}</div>` : `<div class="empty-state" style="padding:28px 14px;border:0;background:#f7faf8"><div class="empty-icon">${icon("sliders", 22)}</div><h3 style="font-size:18px">No saved filters yet</h3><p style="font-size:13px">Save a filter set from the Map or List to find it here.</p></div>`}<div style="margin-top:26px;padding-top:21px;border-top:1px solid var(--line)"><h3>Recent <span style="color:var(--muted);font-size:13px;font-family:var(--font-body)">last 5</span></h3>${recent.length ? `<div class="saved-list">${recent.map(item => savedCard({ ...item, recent: true })).join("")}</div>` : `<p class="modal-note">Filter combinations you use with “Go” will appear here.</p>`}</div></section></div></main>`;
}

function addPage() {
  const draft = state.addSpot;
  const building = document.querySelector("#add-building")?.value || draft.building || buildingNames()[0];
  const floors = floorsForBuilding(building);
  if (!floors.includes(draft.floor)) draft.floor = floors[0] || "1";
  const errors = draft.errors || {};
  const tags = FEATURE_META.map(([key,label]) => `<button type="button" class="filter-chip ${draft.tags.includes(key) ? "selected" : ""}" data-add-tag="${key}">${draft.tags.includes(key) ? "✓ " : ""}${label}</button>`).join("");
  return `<main class="page"><a class="back-link" href="#list" data-nav="list">${icon("back", 16)} Back to study spot list</a><div class="page-heading"><div><p class="eyebrow">Make campus better</p><h2>Add a study spot</h2><p class="subtext">Save a spot you discovered to your personal list. It will only appear for you on this device.</p></div></div><form class="form-card" id="add-spot-form" novalidate>${draft.success ? `<div class="success-banner">Spot saved! Opening your study spot list…</div>` : ""}<div class="form-grid"><div class="field full"><label for="add-name">Spot name <span style="color:#b45245">*</span></label><input id="add-name" name="name" placeholder="e.g. Humanities reading nook" value="${escapeHTML(draft.name || "")}" />${errors.name ? `<span class="field-error">${errors.name}</span>` : ""}</div><div class="field"><label for="add-building">Building <span style="color:#b45245">*</span></label><select id="add-building" name="building">${buildingNames().map(name => `<option value="${escapeHTML(name)}" ${building === name ? "selected" : ""}>${escapeHTML(name)}</option>`).join("")}</select></div><div class="field"><label for="add-floor">Floor <span style="color:#b45245">*</span></label><select id="add-floor" name="floor">${floors.map(floor => `<option value="${escapeHTML(floor)}" ${draft.floor === floor ? "selected" : ""}>Floor ${escapeHTML(floor)}</option>`).join("")}</select></div></div>${errors.location ? `<span class="field-error" style="display:block;margin-top:9px">${errors.location}</span>` : ""}<div class="placement-wrap"><div><div class="placement-map" id="placement-map" aria-label="Click to place a pin"><div class="place-wall a"></div><div class="place-wall b"></div><div class="place-wall c"></div>${draft.position ? `<span class="placement-pin" style="left:${draft.position.x}%;top:${draft.position.y}%"></span>` : ""}</div><p class="placement-hint">Click the simplified floor plan to place your pin.</p></div><div class="modal-note"><strong>Location tip</strong><br /><br />Pick the area closest to your spot. The marker helps you remember where it is.</div></div><div class="form-section"><h3>What is it like?</h3><div class="field"><label>Group size <span style="color:#b45245">*</span></label><div class="group-size-options" style="grid-template-columns:repeat(3,1fr)">${GROUP_SIZES.map(size => `<label class="group-option"><input type="radio" name="add-group" value="${size}" ${draft.groupSize === size ? "checked" : ""}/> ${size[0].toUpperCase() + size.slice(1)}</label>`).join("")}</div>${errors.groupSize ? `<span class="field-error">${errors.groupSize}</span>` : ""}</div><div class="field" style="margin-top:21px"><label>Tags</label><div class="tag-grid">${tags}</div></div><div class="field" style="margin-top:21px"><label for="add-description">Short description <span class="modal-note">(optional)</span></label><textarea id="add-description" name="description" placeholder="What makes this spot useful?">${escapeHTML(draft.description || "")}</textarea></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-nav="list">Cancel</button><button type="submit" class="btn btn-primary">${icon("plus", 16)} Add spot</button></div></form></main>`;
}

function render() {
  const page = state.page === "start" ? startPage() : state.page === "map" ? mapPage() : state.page === "floor" ? floorPage() : state.page === "details" ? detailsPage() : state.page === "favorites" ? favoritesPage() : state.page === "add" ? addPage() : listPage();
  app.innerHTML = `<div class="app-shell">${topBar()}${page}</div>`;
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach(element => element.addEventListener("click", event => { event.preventDefault(); setPage(element.dataset.nav); }));
  document.querySelectorAll("[data-details]").forEach(element => element.addEventListener("click", event => { event.stopPropagation(); setPage("details", { spotId: element.dataset.details, previousPage: state.page }); }));
  document.querySelectorAll("[data-spot-id]").forEach(element => element.addEventListener("click", () => setPage("details", { spotId: element.dataset.spotId, previousPage: state.page })));
  document.querySelectorAll("[data-favorite]").forEach(element => element.addEventListener("click", event => { event.stopPropagation(); toggleFavorite(element.dataset.favorite); }));
  document.querySelectorAll("[data-start-filter]").forEach(element => element.addEventListener("click", () => { const key = element.dataset.startFilter; state.onboardingSelection = state.onboardingSelection.includes(key) ? state.onboardingSelection.filter(item => item !== key) : [...state.onboardingSelection, key]; render(); }));
  document.querySelectorAll("[data-building]").forEach(element => element.addEventListener("click", () => { state.currentBuilding = element.dataset.building; state.currentFloor = floorsForBuilding(state.currentBuilding)[0] || "1"; setPage("floor", { building: state.currentBuilding }); }));
  document.querySelectorAll("[data-floor]").forEach(element => element.addEventListener("click", () => { state.currentFloor = element.dataset.floor; render(); }));
  document.querySelectorAll("[data-action]").forEach(element => element.addEventListener("click", () => handleAction(element.dataset.action, element)));
  document.querySelectorAll("[data-remove-feature]").forEach(element => element.addEventListener("click", () => updateActiveFilters({ features: state.activeFilters.features.filter(key => key !== element.dataset.removeFeature) })));
  document.querySelectorAll("[data-remove-group]").forEach(element => element.addEventListener("click", () => updateActiveFilters({ groupSize: "" })));
  document.querySelectorAll("[data-remove-building]").forEach(element => element.addEventListener("click", () => updateActiveFilters({ building: "" })));
  document.querySelectorAll("[data-filter-feature]").forEach(element => element.addEventListener("change", () => {
    const key = element.dataset.filterFeature;
    const features = element.checked ? [...new Set([...(state._draftFilters?.features || []), key])] : (state._draftFilters?.features || []).filter(item => item !== key);
    state._draftFilters = { ...(state._draftFilters || cloneFilters(state.activeFilters)), features };
    const countNode = document.querySelector(".filter-count");
    if (countNode) { const count = filteredSpots(state._draftFilters).length; countNode.textContent = `Show ${count} spot${count === 1 ? "" : "s"}`; }
  }));
  document.querySelector("[data-filter-building]")?.addEventListener("change", event => {
    state._draftFilters = { ...(state._draftFilters || cloneFilters(state.activeFilters)), building: event.target.value };
    const countNode = document.querySelector(".filter-count");
    if (countNode) { const count = filteredSpots(state._draftFilters).length; countNode.textContent = `Show ${count} spot${count === 1 ? "" : "s"}`; }
  });
  document.querySelectorAll("input[name='group-size']").forEach(element => element.addEventListener("change", () => {
    state._draftFilters = { ...(state._draftFilters || cloneFilters(state.activeFilters)), groupSize: element.value };
    const countNode = document.querySelector(".filter-count");
    if (countNode) { const count = filteredSpots(state._draftFilters).length; countNode.textContent = `Show ${count} spot${count === 1 ? "" : "s"}`; }
  }));
  document.querySelector("[data-sort]")?.addEventListener("change", event => { state.sort = event.target.value; render(); });
  document.querySelectorAll("[data-map-spot]").forEach(element => element.addEventListener("click", () => setPage("map", { popupSpotId: element.dataset.mapSpot })));
  document.querySelectorAll("[data-remove-favorite]").forEach(element => element.addEventListener("click", () => toggleFavorite(element.dataset.removeFavorite)));
  document.querySelectorAll("[data-apply-filter]").forEach(element => element.addEventListener("click", () => applySavedFilter(element.dataset.applyFilter)));
  document.querySelectorAll("[data-rename-filter]").forEach(element => element.addEventListener("click", () => renameSavedFilter(element.dataset.renameFilter)));
  document.querySelectorAll("[data-delete-filter]").forEach(element => element.addEventListener("click", () => deleteSavedFilter(element.dataset.deleteFilter)));
  document.querySelectorAll("[data-add-tag]").forEach(element => element.addEventListener("click", () => { const key = element.dataset.addTag; state.addSpot.tags = state.addSpot.tags.includes(key) ? state.addSpot.tags.filter(item => item !== key) : [...state.addSpot.tags, key]; render(); }));
  document.querySelector("#add-building")?.addEventListener("change", event => { state.addSpot.building = event.target.value; state.addSpot.floor = floorsForBuilding(event.target.value)[0] || "1"; state.addSpot.position = null; render(); });
  document.querySelector("#add-floor")?.addEventListener("change", event => { state.addSpot.floor = event.target.value; state.addSpot.position = null; render(); });
  document.querySelector("#placement-map")?.addEventListener("click", event => { const rect = event.currentTarget.getBoundingClientRect(); state.addSpot.position = { x: Math.round(((event.clientX - rect.left) / rect.width) * 100), y: Math.round(((event.clientY - rect.top) / rect.height) * 100) }; render(); });
  document.querySelector("#add-spot-form")?.addEventListener("submit", submitAddSpot);
  document.onkeydown = handleKeydown;
}

function handleKeydown(event) { if (event.key === "Escape") { if (state.homeOpen || state.filterOpen) { state.homeOpen = false; state.filterOpen = false; render(); } } }

function handleAction(action, element) {
  if (action === "toggle-home") { state.homeOpen = !state.homeOpen; render(); return; }
  if (action === "start-over") { state.activeFilters = defaultFilters(); state.onboardingSelection = []; saveActiveFilters(); setPage("start"); return; }
  if (action === "random-spot") { const spots = allSpots(); const spot = spots[Math.floor(Math.random() * spots.length)]; setPage("details", { spotId: spot.id, previousPage: "start" }); return; }
  if (action === "start-go") { state.activeFilters = { features: state.onboardingSelection.filter(key => key !== "indoors"), building: "", groupSize: "" }; if (state.onboardingSelection.includes("indoors")) state.activeFilters.features.push("indoors"); saveActiveFilters(); addRecentFilter(state.activeFilters); setPage("list"); return; }
  if (action === "open-filters") { state._draftFilters = cloneFilters(state.activeFilters); state.filterOpen = true; render(); return; }
  if (action === "close-filters") { state.filterOpen = false; render(); return; }
  if (action === "apply-filters") { state.activeFilters = cloneFilters(state._draftFilters || state.activeFilters); delete state._draftFilters; saveActiveFilters(); state.filterOpen = false; render(); return; }
  if (action === "reset-filters") { state._draftFilters = defaultFilters(); render(); return; }
  if (action === "clear-filters") { updateActiveFilters(defaultFilters()); return; }
  if (action === "save-filter") { const current = cloneFilters(state._draftFilters || state.activeFilters); const name = prompt("Name this filter set", filtersLabelList(current).join(" + ") || "All study spots"); if (name?.trim()) { state.savedFilters.unshift({ id: `saved-${Date.now()}`, name: name.trim(), filters: current }); state.savedFilters = state.savedFilters.slice(0, 20); persistUser(); toast("Filter set saved"); } return; }
  if (action === "show-on-map") { setPage("map", { popupSpotId: element.dataset.spot }); return; }
  if (action === "close-details") { setPage(state.previousPage || "list"); return; }
}

function updateActiveFilters(partial) { state.activeFilters = partial.features !== undefined && partial.building === undefined && partial.groupSize === undefined ? { ...state.activeFilters, ...partial } : { ...state.activeFilters, ...partial }; saveActiveFilters(); render(); }

function toggleFavorite(id) { state.favorites = isFavorite(id) ? state.favorites.filter(favorite => favorite !== id) : [...state.favorites, id]; persistUser(); toast(isFavorite(id) ? "Added to favorites" : "Removed from favorites"); render(); }

function addRecentFilter(filters) { const signature = JSON.stringify(filters); state.recentFilters = [{ id: `recent-${Date.now()}`, name: filtersLabelList(filters).join(" + ") || "All study spots", filters: cloneFilters(filters) }, ...state.recentFilters.filter(item => JSON.stringify(item.filters) !== signature)].slice(0, 5); persistUser(); }

function applySavedFilter(id) { const item = [...state.savedFilters, ...state.recentFilters].find(filter => filter.id === id); if (!item) return; state.activeFilters = cloneFilters(item.filters); saveActiveFilters(); setPage("list"); }
function renameSavedFilter(id) { const item = state.savedFilters.find(filter => filter.id === id); if (!item) return; const name = prompt("Rename filter set", item.name); if (name?.trim()) { item.name = name.trim(); persistUser(); render(); } }
function deleteSavedFilter(id) { state.savedFilters = state.savedFilters.filter(filter => filter.id !== id); persistUser(); render(); toast("Filter set deleted"); }

function submitAddSpot(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const draft = state.addSpot;
  draft.name = String(form.get("name") || "").trim(); draft.building = String(form.get("building") || ""); draft.floor = String(form.get("floor") || ""); draft.groupSize = String(form.get("add-group") || ""); draft.description = String(form.get("description") || "").trim();
  draft.errors = {};
  if (!draft.name) draft.errors.name = "Give your spot a name.";
  if (!draft.building || !draft.floor || !draft.position) draft.errors.location = "Choose a building, floor, and a pin location.";
  if (!draft.groupSize) draft.errors.groupSize = "Choose the best group size.";
  if (Object.keys(draft.errors).length) { render(); return; }
  const features = Object.fromEntries(FEATURE_META.map(([key]) => [key, draft.tags.includes(key)]));
  state.userSpots.push({ id: `user-${Date.now()}`, name: draft.name, building: draft.building, floor: draft.floor, position: draft.position, features, groupSize: draft.groupSize, busyness: "Usually empty", description: draft.description || "A spot you added to your personal campus list." });
  persistUser(); draft.success = true; render(); setTimeout(() => setPage("list"), 850);
}

document.addEventListener("click", event => {
  if (state.homeOpen && !event.target.closest(".home-menu-wrap")) { state.homeOpen = false; render(); }
});

render();
