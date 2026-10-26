"use strict";
const $ = (s) => document.querySelector(s),
  uid = () => crypto.randomUUID(),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const INITIAL_COMPANY_ID = (() => {
  const id = new URLSearchParams(location.search).get("workspace");
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
})();
let companyContext = {id: INITIAL_COMPANY_ID, userId:null, role:null, name:"", ready:false};
let KEY = INITIAL_COMPANY_ID ? "tour-mapper-pending-company" : "tour-atlas-v1";
const seeds = [
  ["Traverse Theatre", "Edinburgh", 55.9465, -3.2052],
  ["Tron Theatre", "Glasgow", 55.8566, -4.2431],
  ["Eden Court", "Inverness", 57.4735, -4.2306],
  ["Dundee Rep", "Dundee", 56.4574, -2.9746],
  ["Live Theatre", "Newcastle", 54.9691, -1.6051],
  ["Northern Stage", "Newcastle", 54.9786, -1.6146],
  ["York Theatre Royal", "York", 53.9622, -1.0851],
  ["Leeds Playhouse", "Leeds", 53.7972, -1.5334],
  ["HOME", "Manchester", 53.4732, -2.2463],
  ["Liverpool Everyman", "Liverpool", 53.4028, -2.9701],
  ["Sheffield Theatres", "Sheffield", 53.3804, -1.4662],
  ["Nottingham Playhouse", "Nottingham", 52.9544, -1.1573],
  ["Birmingham Rep", "Birmingham", 52.4792, -1.9109],
  ["Sherman Theatre", "Cardiff", 51.4886, -3.1775],
  ["Bristol Old Vic", "Bristol", 51.4513, -2.5945],
  ["The North Wall", "Oxford", 51.7774, -1.2656],
  ["New Diorama Theatre", "London", 51.5251, -0.1435],
  ["Marlowe Theatre", "Canterbury", 51.2815, 1.0777],
  ["Theatre Royal Plymouth", "Plymouth", 50.3706, -4.1451],
  ["Lyric Theatre", "Belfast", 54.5795, -5.9319],
];
function fresh() {
  return {
    version: 1,
    venues: seeds.map((v) => ({
      id: uid(),
      name: v[0],
      address: v[1],
      lat: v[2],
      lng: v[3],
      capacity: null,
      type: "theatre",
      categories: [],
      example: true,
      location: "Example location — verify before travel",
    })),
    categories: [
      {
        id: "theatre",
        name: "All Theatres",
        color: "#e8a16d",
        on: true,
        rule: "theatre",
      },
      {
        id: "large",
        name: ">100 capacity",
        color: "#c79557",
        on: false,
        rule: "large",
      },
      {
        id: "small",
        name: "<100 capacity",
        color: "#9b86b8",
        on: false,
        rule: "small",
      },
    ],
    tours: [
      {
        id: "first",
        name: "My first company tour",
        stops: [{ id: uid(), date: "", venueId: "", text: "" }],
        applied: [],
      },
    ],
    current: "first",
    settings: { mapbox: "", router: "https://router.project-osrm.org" },
    times: false,
    tourOn: true,
  };
}
let state;
try {
  state = INITIAL_COMPANY_ID ? fresh() : JSON.parse(localStorage.getItem(KEY)) || fresh();
  if (INITIAL_COMPANY_ID) state.venues = [];
  if (
    !Array.isArray(state.venues) ||
    !Array.isArray(state.tours) ||
    !state.tours.length
  )
    throw Error();
} catch {
  state = fresh();
}
const tour = () =>
  state.tours.find((t) => t.id === state.current) || state.tours[0];
let routeEpoch = 0,
  map,
  venueMarkers,
  routeLines,
  timeLabels,
  tourMarkers,
  dirty = false,
  toastTimer;
const routeCache = new Map();
function save() {
  if (companyContext.id && (!companyContext.ready || companyContext.role === "viewer")) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    $("#saveState").textContent = "● Saved on this browser";
  } catch {
    $("#saveState").textContent = "Storage full — export a backup";
    toast("Browser storage is unavailable. Export a backup to keep your work.");
  }
}
function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 5500);
}
function modal(title, html) {
  $("#modal").classList.toggle("library-modal", title === "Your venue library");
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  if (!$("#modal").open) $("#modal").showModal();
}
function close() {
  $("#modal").close();
}
$("#closeModal").onclick = close;
function dateKey(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(s);
  if (!m) return null;
  const y = 2000 + Number(m[3]),
    mo = Number(m[2]),
    d = Number(m[1]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
    ? dt.getTime()
    : null;
}
function sortStops() {
  tour().stops.sort(
    (a, b) => (dateKey(a.date) ?? Infinity) - (dateKey(b.date) ?? Infinity),
  );
}
function setDirty() {
  dirty = true;
  save();
}
function renderTour() {
  const t = tour();
  $("#tourSelect").innerHTML = state.tours
    .map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`)
    .join("");
  $("#tourSelect").value = t.id;
  $("#stops").innerHTML = t.stops
    .map((s, i) => {
      const v = state.venues.find((v) => v.id === s.venueId);
      return `<div class="stop" data-id="${esc(s.id)}"><input class="date" aria-label="Date for stop ${i + 1}" placeholder="dd/mm/yy" inputmode="numeric" maxlength="8" value="${esc(s.date)}"><div class="venue-field"><input class="venue" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-label="Venue for stop ${i + 1}" placeholder="Start typing a venue…" value="${esc(v?.name ?? s.text ?? "")}"><div class="suggestions" role="listbox"></div></div><button class="remove-stop" title="Remove stop ${i + 1}">×</button></div>`;
    })
    .join("");
  $("#stops")
    .querySelectorAll(".stop")
    .forEach((row) => {
      const s = t.stops.find((x) => x.id === row.dataset.id),
        di = row.querySelector(".date"),
        vi = row.querySelector(".venue"),
        list = row.querySelector(".suggestions");
      di.oninput = () => {
        let digits = di.value.replace(/\D/g, "").slice(0, 6);
        di.value =
          digits.slice(0, 2) +
          (digits.length > 2 ? "/" + digits.slice(2, 4) : "") +
          (digits.length > 4 ? "/" + digits.slice(4) : "");
        s.date = di.value;
        setDirty();
      };
      di.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (dateKey(s.date) === null) {
          di.classList.add('invalid');
          toast('Enter a valid date in dd/mm/yy format.');
          return;
        }
        if (!s.venueId) { vi.focus(); return; }
        updateTourMap().catch(() => toast('The route could not update. Please try again.'));
      };
      di.onblur = () => {
        di.classList.toggle("invalid", !!s.date && dateKey(s.date) === null);
        if (dateKey(s.date) !== null) {
          const before = t.stops.map((x) => x.id).join();
          sortStops();
          save();
          if (t.stops.map((x) => x.id).join() !== before) {
            const active = document.activeElement;
            const start = active?.selectionStart,
              end = active?.selectionEnd;
            const container = $("#stops");
            const nodes = new Map(
              [...container.children].map((n) => [n.dataset.id, n]),
            );
            t.stops.forEach((stop, index) => {
              const n = nodes.get(stop.id);
              container.appendChild(n);
              n.querySelector(".date").setAttribute(
                "aria-label",
                "Date for stop " + (index + 1),
              );
              n.querySelector(".venue").setAttribute(
                "aria-label",
                "Venue for stop " + (index + 1),
              );
            });
            if (active && container.contains(active)) {
              active.focus();
              if (start !== null) active.setSelectionRange(start, end);
            }
            toast("Tour dates put in chronological order.");
          }
        }
      };
      function suggest() {
        const q = vi.value.toLocaleLowerCase().trim();
        const matches = q
          ? state.venues
              .filter((v) => v.name.toLocaleLowerCase().includes(q))
              .slice(0, 9)
          : [];
        list.innerHTML = matches.length
          ? matches
              .map(
                (v) =>
                  `<button type="button" role="option" data-v="${esc(v.id)}">${esc(v.name)}<small>${esc(v.address)}${hasLocation(v) ? "" : " · needs location"}</small></button>`,
              )
              .join("")
          : q
            ? '<div class="empty">No match. Import or add this venue in the library.</div>'
            : "";
        vi.setAttribute("aria-expanded", String(!!list.innerHTML));
        list.querySelectorAll("button").forEach((b) => {
          b.onmousedown = (e) => e.preventDefault();
          b.onclick = () => {
            const v = state.venues.find((x) => x.id === b.dataset.v);
            s.venueId = v.id;
            s.text = v.name;
            vi.value = v.name;
            list.innerHTML = "";
            vi.setAttribute("aria-expanded", "false");
            setDirty();
            if (dateKey(s.date) !== null) updateTourMap().catch(() => toast('The route could not update. Please try again.'));
          };
        });
      }
      vi.oninput = () => {
        s.text = vi.value;
        s.venueId = "";
        setDirty();
        suggest();
      };
      vi.onfocus = suggest;
      vi.onblur = () =>
        setTimeout(() => {
          list.innerHTML = "";
          vi.setAttribute("aria-expanded", "false");
        }, 160);
      vi.onkeydown = (e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          list.querySelector("button")?.focus();
        }
        if (e.key === "Escape") list.innerHTML = "";
        if (e.key === "Enter") {
          const b = list.querySelector("button");
          if (b) {
            e.preventDefault();
            b.click();
          }
        }
      };
      list.onkeydown = (e) => {
        const buttons = [...list.querySelectorAll("button")],
          i = buttons.indexOf(document.activeElement);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          buttons[(i + 1) % buttons.length]?.focus();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
        }
        if (e.key === "Escape") {
          list.innerHTML = "";
          vi.focus();
        }
      };
      row.querySelector(".remove-stop").onclick = () => {
        t.stops = t.stops.filter((x) => x.id !== s.id);
        if (!t.stops.length)
          t.stops = [{ id: uid(), date: "", venueId: "", text: "" }];
        setDirty();
        updateTourMap().catch(() => toast('The route could not update. Please try again.'));
      };
    });
}
function hasLocation(v) {
  return (
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    Math.abs(v.lat) <= 90 &&
    Math.abs(v.lng) <= 180
  );
}
function venueSpaces(v) {
  if (Array.isArray(v.spaces) && v.spaces.length) return v.spaces;
  return Number.isFinite(v.capacity)
    ? [{ name: "Main space", type: "main theatre", capacity: v.capacity }]
    : [];
}
function matchesCapacity(v, band) {
  return venueSpaces(v).some(space => Number.isFinite(space.capacity) && space.capacity > 0 &&
    (band === "small" ? space.capacity < 100 : band === "large" ? space.capacity >= 100 : false));
}
function migrateCapacityLayers(workspace) {
  const mediumOn = workspace.categories.some(c => c.rule === "medium" && c.on);
  const removedOn = workspace.categories.some(c => (c.id === "hitlist-active" || /^general hit list/i.test(c.name)) && c.on);
  workspace.categories = workspace.categories.filter(c => c.rule !== "medium" && c.id !== "medium" && c.id !== "hitlist-active" && !/^general hit list/i.test(c.name));
  const specs = [
    {id:"small",rule:"small",name:"Capacity <100",color:"#9b86b8"},
    {id:"large",rule:"large",name:"Capacity 100+",color:"#c79557"}
  ];
  for (const spec of specs) {
    const existing = workspace.categories.find(c => c.rule === spec.rule || c.id === spec.id);
    if (existing) Object.assign(existing, spec);
    else workspace.categories.push({...spec,on:false});
  }
  if (mediumOn) workspace.categories.find(c => c.rule === "large").on = true;
  if (removedOn && !workspace.categories.some(c => c.on && !["small","large"].includes(c.rule))) {
    const all = workspace.categories.find(c => c.rule === "theatre");
    if (all) all.on = true;
  }
  const rest = workspace.categories.filter(c => !["small","large"].includes(c.rule));
  rest.splice(rest.findIndex(c => c.rule === "theatre") + 1,0,...specs.map(s => workspace.categories.find(c => c.rule === s.rule)));
  workspace.categories = rest;
  return workspace;
}
function belongs(v, c) {
  if (c.rule === "theatre") return v.type === "theatre";
  if (["small", "medium", "large"].includes(c.rule))
    return matchesCapacity(v, c.rule);
  return (v.categories || []).includes(c.id);
}
function venueVisible(v) {
  const sizes = state.categories.filter(
    (c) => c.on && ["small", "medium", "large"].includes(c.rule),
  );
  const base = state.categories.filter(
    (c) => c.on && !["small", "medium", "large"].includes(c.rule),
  );
  if (tour().showSuggested && typeof tourSuggestionFor === "function") return !!tourSuggestionFor(v) && (!sizes.length || sizes.some(c => belongs(v,c)));
  return (
    (sizes.length ? sizes.some((c) => belongs(v, c)) : true) &&
    (base.length ? base.some((c) => belongs(v, c)) : sizes.length > 0)
  );
}

function categoryMarkerColour(category) {
  // Restore the orange default for libraries saved with the former green theme.
  return category?.rule === "theatre" && category.color === "#75956c"
    ? "#e8a16d" : category?.color || "#e8a16d";
}
function pin(color, n) {
  return L.divIcon({
    className: "pin-icon",
    html: `<span class="pin-shape ${n ? "tour-pin" : ""}" style="--pin:${color}"><b>${n || ""}</b></span>`,
    iconSize: n ? [29, 38] : [23, 31],
    iconAnchor: n ? [14, 35] : [11, 28],
    popupAnchor: [0, -30],
  });
}
function googleURL(v) {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(
      [v.name, v.town, v.region, "UK"].filter(Boolean).join(", "),
    )
  );
}
function venueDetails(v) {
  const primary = { name: v.contactName, jobTitle: v.jobTitle, email: v.email };
  const contacts = [primary, ...(v.contacts || [])]
    .map(renderPopupContact)
    .join("");
  return `<div class="popup-contact-details">${contacts}</div><hr class="popup-divider">${venueExtraDetails(v)}${v.notes ? `<div class="venue-notes"><strong>Notes</strong><br>${esc(v.notes)}</div>` : ""}`;
}

function popup(v) {
  const d = document.createElement("div");
  d.innerHTML = `<strong class="venue-popup-title">${esc(v.name)}</strong><div class="venue-popup-city">${esc(v.town || v.region || "unknown")}</div><hr class="popup-divider">${venueDetails(v)}<button class="popup-edit">Edit venue information</button><button class="popup-btn">＋ Add to current tour</button>`;
  d.querySelector(".popup-edit").onclick = () => {
    map.closePopup();
    editVenue(v.id);
  };
  d.querySelector(".popup-btn").onclick = () => {
    let s = tour().stops.find((s) => !s.venueId && !s.date);
    if (!s) {
      s = { id: uid(), date: "", venueId: "", text: "" };
      tour().stops.push(s);
    }
    s.venueId = v.id;
    s.text = v.name;
    setDirty();
    renderTour();
    map.closePopup();
    toast("Venue added. Enter its date, then choose Update Tour.");
  };
  if (typeof attachTourSuggestionControls === "function") attachTourSuggestionControls(d, v);
  return d;
}
function renderVenues() {
  if (!map) return;
  venueMarkers.clearLayers();
  let count = 0;
  state.venues.forEach((v) => {
    const cats = state.categories.filter((c) => c.on && belongs(v, c));
    if (venueVisible(v) && hasLocation(v)) {
      const c = cats[cats.length - 1];
      L.marker([v.lat, v.lng], {
        icon: pin(
          typeof venueMarkerColour === "function"
            ? venueMarkerColour(v, v.importSource ? "#e8a16d" : categoryMarkerColour(c))
            : v.status === "permanently_closed" ? "#92969b" : v.importSource ? "#e8a16d" : categoryMarkerColour(c),
        ),
      })
        .bindPopup(() => popup(v), {
          maxHeight: 260,
          autoPanPaddingTopLeft: [15, 125],
        })
        .addTo(venueMarkers);
      count++;
    }
  });
  $("#mapVenueCount").textContent = `${count} venues shown`;
  $("#libraryCount").textContent = state.venues.length;
}
function renderLayers() {
  migrateCapacityLayers(state);
  $("#layerList").innerHTML = state.categories
    .map(
      (c) =>
        `<label class="layer"><span class="dot" style="--dot:${esc(categoryMarkerColour(c))}"></span><span>${esc(c.name)} <small>${state.venues.filter((v) => belongs(v, c)).length}</small></span><input aria-label="Show ${esc(c.name)}" type="checkbox" data-cat="${esc(c.id)}" ${c.on ? "checked" : ""}></label>`,
    )
    .join("");
  if (typeof renderSuggestionLayer === "function") renderSuggestionLayer();
  $("#layerList")
    .querySelectorAll("input[data-cat]")
    .forEach(
      (i) =>
        (i.onchange = () => {
          state.categories.find((c) => c.id === i.dataset.cat).on = i.checked;
          save();
          renderVenues();
        }),
    );
}
function fit() {
  const pts = [];
  if (state.tourOn && !tour().showSuggested)
    tour().applied.forEach((s) => {
      const v = state.venues.find((v) => v.id === s.venueId);
      if (v && hasLocation(v)) pts.push([v.lat, v.lng]);
    });
  if (!pts.length)
    state.venues
      .filter((v) => hasLocation(v) && venueVisible(v))
      .forEach((v) => pts.push([v.lat, v.lng]));
  if (pts.length)
    map.fitBounds(pts, {
      paddingTopLeft: [45, 140],
      paddingBottomRight: [45, 100],
      maxZoom: 11,
    });
  else map.setView([54.4, -3.1], 6);
}
function formatTime(secs) {
  let m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
function midpoint(coords) {
  let length = 0;
  const distances = [];
  for (let i = 1; i < coords.length; i++) {
    let d = map.distance(
      [coords[i - 1][1], coords[i - 1][0]],
      [coords[i][1], coords[i][0]],
    );
    distances.push(d);
    length += d;
  }
  let walked = 0;
  for (let i = 0; i < distances.length; i++) {
    if (walked + distances[i] >= length / 2) {
      let f = distances[i] ? (length / 2 - walked) / distances[i] : 0;
      return [
        coords[i][1] + f * (coords[i + 1][1] - coords[i][1]),
        coords[i][0] + f * (coords[i + 1][0] - coords[i][0]),
      ];
    }
    walked += distances[i];
  }
  return [coords[0][1], coords[0][0]];
}
async function request(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(16000) });
  if (!r.ok) throw Error("Service unavailable (" + r.status + ")");
  return r.json();
}
async function drawTour(showFeedback = false) {
  if (!map) return;
  const epoch = ++routeEpoch;
  routeLines.clearLayers();
  timeLabels.clearLayers();
  tourMarkers.clearLayers();
  const stops = tour().applied || [];
  $("#stopCount").textContent = stops.length;
  $("#distance").textContent = "—";
  $("#duration").textContent = "—";
  if (!state.tourOn) return;
  const venues = stops
    .map((s) => state.venues.find((v) => v.id === s.venueId))
    .filter(Boolean);
  venues.forEach((v, i) => {
    if (hasLocation(v) && (!tour().showSuggested || typeof tourSuggestionFor !== "function" || tourSuggestionFor(v)))
      L.marker([v.lat, v.lng], {
        icon: pin(
          typeof venueMarkerColour === "function" ? venueMarkerColour(v, "#008cff") : v.status === "permanently_closed" ? "#92969b" : "#008cff",
          i + 1,
        ),
        zIndexOffset: 1000,
      })
        .bindPopup(() => {
          const d = popup(v);
          const date = document.createElement("div");
          date.className = "popup-info";
          date.textContent = stops[i]?.date || "";
          d.insertBefore(date, d.querySelector(".popup-edit"));
          return d;
        })
        .addTo(tourMarkers);
  });
  let totalD = 0,
    totalT = 0,
    fail = 0;
  if (venues.length < 2) return;
  $("#distance").textContent = "…";
  $("#duration").textContent = "…";
  for (let i = 1; i < venues.length; i++) {
    if (epoch !== routeEpoch) return;
    const a = venues[i - 1],
      b = venues[i];
    if (!hasLocation(a) || !hasLocation(b)) {
      fail++;
      continue;
    }
    const key = `${a.lng},${a.lat};${b.lng},${b.lat}`;
    try {
      let r = routeCache.get(key);
      if (!r) {
        const data = await request(
          `${state.settings.router.replace(/\/$/, "")}/route/v1/driving/${key}?overview=full&geometries=geojson`,
        );
        if (data.code !== "Ok" || !data.routes?.[0]) throw Error("No route");
        r = data.routes[0];
        routeCache.set(key, r);
      }
      if (epoch !== routeEpoch) return;
      L.geoJSON(r.geometry, {
        style: { color: "#872f40", weight: 4, opacity: 0.85 },
      }).addTo(routeLines);
      totalD += r.distance;
      totalT += r.duration;
      if (state.times)
        L.marker(midpoint(r.geometry.coordinates), {
          interactive: false,
          icon: L.divIcon({
            className: "time-label",
            html: esc(formatTime(r.duration)),
            iconSize: [85, 20],
            iconAnchor: [42, 10],
          }),
        }).addTo(timeLabels);
    } catch {
      if (epoch !== routeEpoch) return;
      fail++;
      L.polyline(
        [
          [a.lat, a.lng],
          [b.lat, b.lng],
        ],
        { color: "#872f40", weight: 3, dashArray: "6 8", opacity: 0.6 },
      )
        .bindTooltip("Road route unavailable — straight-line connection")
        .addTo(routeLines);
    }
  }
  if (epoch !== routeEpoch) return;
  $("#distance").textContent = fail
    ? "Unavailable"
    : Math.round(totalD / 1609.344).toLocaleString();
  $("#duration").textContent = fail ? "Unavailable" : formatTime(totalT);
  if (fail)
    toast(
      "Some road routes could not be calculated. Dashed lines show connections only; no driving times are estimated for them.",
    );
  else if (showFeedback)
    toast(
      "Tour updated with road routes. Driving times are estimates, without live traffic.",
    );
}
$("#addStop").onclick = () => {
  tour().stops.push({ id: uid(), date: "", venueId: "", text: "" });
  setDirty();
  renderTour();
  $("#stops .stop:last-child .date").focus();
};
async function updateTourMap() {
  // Incomplete draft rows stay editable without holding up valid tour stops.
  const used = tour().stops.filter(s => dateKey(s.date) !== null && s.venueId &&
    hasLocation(state.venues.find(v => v.id === s.venueId) || {}));
  sortStops();
  tour().applied = structuredClone(
    used.sort((a, b) => dateKey(a.date) - dateKey(b.date)),
  );
  save();
  dirty = false;
  renderTour();
  const p = drawTour(true);
  fit();
  await p;
  if (!used.length) toast("Tour map cleared.");
  else if (used.length === 1)
    toast("Tour updated. Add another stop to calculate a road journey.");
}
$("#tourSelect").onchange = () => {
  state.current = $("#tourSelect").value;
  dirty = false;
  save();
  renderTour();
  drawTour();
  fit();
};
function nameTour(isNew) {
  modal(
    isNew ? "Create a company tour" : "Rename tour",
    `<label class="form-label" for="tourName">Company / tour name</label><input id="tourName" maxlength="120" value="${isNew ? "" : esc(tour().name)}" placeholder="e.g. Paper Lantern · Spring tour"><div class="form-actions"><button class="primary" id="saveTourName">${isNew ? "Create tour" : "Save name"}</button></div>`,
  );
  $("#saveTourName").onclick = () => {
    const name = $("#tourName").value.trim();
    if (!name) return toast("Enter a tour name.");
    if (isNew) {
      const t = {
        id: uid(),
        name,
        stops: [{ id: uid(), date: "", venueId: "", text: "" }],
        applied: [],
      };
      state.tours.push(t);
      state.current = t.id;
    } else tour().name = name;
    save();
    renderTour();
    drawTour();
    close();
  };
}
$("#newTour").onclick = () => nameTour(true);
$("#renameTour").onclick = () => nameTour(false);
$("#deleteTour").onclick = () => {
  modal(
    "Delete this tour?",
    `<p>Delete <strong>${esc(tour().name)}</strong>? Venues will stay in your library.</p><div class="form-actions"><button class="outline" id="cancelDelete">Keep tour</button><button class="primary" id="confirmDelete">Delete tour</button></div>`,
  );
  $("#cancelDelete").onclick = close;
  $("#confirmDelete").onclick = () => {
    state.tours = state.tours.filter((t) => t.id !== tour().id);
    if (!state.tours.length)
      state.tours = [
        {
          id: uid(),
          name: "My first company tour",
          stops: [{ id: uid(), date: "", venueId: "", text: "" }],
          applied: [],
        },
      ];
    state.current = state.tours[0].id;
    save();
    renderTour();
    drawTour();
    close();
  };
};
$("#categoryBtn").onclick = () => {
  modal(
    "Create a venue category",
    `<p>Categories can include any kind of venue: record shops, community halls, festivals or small studios.</p><label class="form-label" for="catName">Category name</label><input id="catName" placeholder="e.g. Record shops" maxlength="80"><label class="form-label" for="catColor">Marker colour</label><input id="catColor" type="color" value="#d29461"><div class="form-actions"><button class="primary" id="saveCat">Create category</button></div>`,
  );
  $("#saveCat").onclick = () => {
    const name = $("#catName").value.trim();
    if (!name) return toast("Enter a category name.");
    if (
      state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())
    )
      return toast("That category already exists.");
    state.categories.push({
      id: uid(),
      name,
      color: $("#catColor").value,
      on: true,
    });
    save();
    renderLayers();
    close();
    toast(
      "Category created. Assign venues through imports or the venue library.",
    );
  };
};
$("#tourLayer").checked = state.tourOn;
$("#timesLayer").checked = state.times;
$("#tourLayer").onchange = () => {
  state.tourOn = $("#tourLayer").checked;
  save();
  drawTour();
};
$("#timesLayer").onchange = () => {
  state.times = $("#timesLayer").checked;
  save();
  drawTour();
};
$("#fitMap").onclick = fit;
$("#mapSearch").oninput = () => {
  const q = $("#mapSearch").value.toLowerCase().trim();
  $("#mapResults").innerHTML = q
    ? state.venues
        .filter((v) => v.name.toLowerCase().includes(q))
        .slice(0, 10)
        .map(
          (v) =>
            `<button data-id="${esc(v.id)}">${esc(v.name)}${hasLocation(v) ? "" : " · needs location"}</button>`,
        )
        .join("")
    : "";
  $("#mapResults")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const v = state.venues.find((v) => v.id === b.dataset.id);
          if (!hasLocation(v)) return editVenue(v.id);
          map.setView([v.lat, v.lng], 14);
          L.popup().setLatLng([v.lat, v.lng]).setContent(popup(v)).openOn(map);
          $("#mapResults").innerHTML = "";
          $("#mapSearch").value = "";
        }),
    );
};
function library() {
  const selected = new Set();
  const bands = [
    ["small", "<100"],
    ["large", "100+"],
  ];
  modal(
    "Your venue library",
    `<div class="library-tools"><input id="libSearch" placeholder="Search venues or city / region…" aria-label="Search library"><button class="primary" id="addVenue">＋ Add venue</button></div><div class="capacity-view-options" aria-label="Filter venues by space capacity"><span>Space capacity</span><button class="capacity-chip active" id="allCapacities" aria-pressed="true">All <small>${state.venues.length}</small></button>${bands.map(([id, label]) => `<button class="capacity-chip" data-size="${id}" aria-pressed="false">${label} seats <small>${state.venues.filter((v) => matchesCapacity(v, id)).length}</small></button>`).join("")}</div><p class="capacity-hint">Venues appear in every size group that matches one of their spaces. You can choose more than one group.</p><div id="libraryResultCount" class="micro" aria-live="polite"></div><div class="library-table"><table><thead><tr><th>VENUE</th><th>CITY / REGION</th><th>SPACES &amp; CAPACITIES</th></tr></thead><tbody id="libRows"></tbody></table></div><div class="form-actions"><button class="outline" id="clearExamples">Remove example venues</button><button class="outline" id="locatePostcodes">Locate missing UK postcodes</button></div>`,
  );
  function rows() {
    const q = $("#libSearch").value.toLowerCase().trim();
    const visible = state.venues.filter(
      (v) =>
        (v.name + " " + (v.town || "") + " " + (v.region || ""))
          .toLowerCase()
          .includes(q) &&
        (!selected.size || [...selected].some((b) => matchesCapacity(v, b))),
    );
    $("#libraryResultCount").textContent = `${visible.length} ${visible.length===1?"venue":"venues"}`;
    $("#libRows").innerHTML =
      visible
        .map(
          (v) =>
            `<tr><td><button class="library-venue-name" data-edit="${esc(v.id)}">${esc(v.name)}</button></td><td>${esc(v.town || v.region || "unknown")}</td><td>${
              venueSpaces(v).length
                ? venueSpaces(v)
                    .map(
                      (x) =>
                        `<div class="library-space"><span>${esc(x.name || x.type || "Space")}</span><span>${Number.isFinite(x.capacity) ? esc(x.capacity) + " seats" : "capacity unknown"}</span></div>`,
                    )
                    .join("")
                : '<span class="unknown-capacity">No spaces listed</span>'
            }</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="3" class="empty">No venues match these viewing options.</td></tr>';
    $("#libRows")
      .querySelectorAll("[data-edit]")
      .forEach((b) => (b.onclick = () => editVenue(b.dataset.edit)));
    $("#allCapacities").classList.toggle("active", !selected.size);
    $("#allCapacities").setAttribute("aria-pressed", String(!selected.size));
    $("#modalBody")
      .querySelectorAll("[data-size]")
      .forEach((b) => {
        const active = selected.has(b.dataset.size);
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
  }
  $("#allCapacities").onclick = () => {
    selected.clear();
    rows();
  };
  $("#modalBody")
    .querySelectorAll("[data-size]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          selected.has(b.dataset.size)
            ? selected.delete(b.dataset.size)
            : selected.add(b.dataset.size);
          rows();
        }),
    );
  rows();
  $("#libSearch").oninput = rows;
  $("#addVenue").onclick = () => editVenue();
  $("#clearExamples").onclick = () => {
    const ids = new Set(state.venues.filter((v) => v.example).map((v) => v.id));
    if (
      state.tours.some((t) =>
        [...t.stops, ...t.applied, ...(t.suggestions || [])].some((s) => ids.has(s.venueId)),
      )
    )
      return toast(
        "Remove example venues from your tours before deleting them.",
      );
    state.venues = state.venues.filter((v) => !v.example);
    save();
    renderLayers();
    renderVenues();
    library();
  };
  $("#locatePostcodes").onclick = async () => {
    const b = $("#locatePostcodes");
    b.disabled = true;
    b.textContent = "Locating…";
    try {
      const n = await locatePostcodes(state.venues);
      save();
      renderVenues();
      toast(
        `${n} venues located approximately by postcode. Review positions before travel.`,
      );
    } catch (e) {
      toast("Postcode lookup unavailable. Your venues are saved; retry later.");
    }
    library();
  };
}
function editVenue(id) {
  const v = state.venues.find((v) => v.id === id) || {
    id: uid(),
    name: "",
    address: "",
    capacity: null,
    type: "theatre",
    categories: [],
    lat: null,
    lng: null,
  };
  modal(
    id ? "Edit venue" : "Add a venue",
    `<label class="form-label" for="vName">Venue name</label><input id="vName" value="${esc(v.name)}"><label class="form-label" for="vAddress">Address, including UK postcode</label><input id="vAddress" value="${esc(v.address)}"><div class="form-grid">${[
      ["vTown", "Town / city", v.town],
      ["vRegion", "Region / county", v.region],
      ["vContact", "Contact name", v.contactName],
      ["vJobTitle", "Contact job title / responsibility", v.jobTitle],
      ["vEmail", "Contact email", v.email],
      ["vPhone", "Phone number", v.phone],
    ]
      .map(
        ([id, label, value]) =>
          `<div><label class="form-label" for="${id}">${label}</label><input id="${id}" ${id === "vEmail" ? 'type="email"' : id === "vPhone" ? 'type="tel"' : ""} value="${esc(value || "")}"></div>`,
      )
      .join(
        "",
      )}<div><label class="form-label" for="vCapacity">Capacity (leave blank if unknown)</label><input id="vCapacity" type="number" min="0" step="1" value="${v.capacity ?? ""}"></div><div><label class="form-label" for="vType">Venue type</label><select id="vType"><option value="theatre">Theatre</option><option value="other">Other venue</option></select></div><div><label class="form-label" for="vLat">Latitude</label><input id="vLat" type="number" step="any" value="${v.lat ?? ""}"></div><div><label class="form-label" for="vLng">Longitude</label><input id="vLng" type="number" step="any" value="${v.lng ?? ""}"></div></div><label class="form-label" for="vNotes">Venue notes</label><textarea id="vNotes" placeholder="Booking notes, accessibility, technical details…">${esc(v.notes || "")}</textarea><div class="location-tools"><a id="googleCheck" class="outline" target="_blank" rel="noopener noreferrer" href="${esc(googleURL(v))}">Check on Google Maps ↗</a></div><p class="micro">Searches by venue name, town and region rather than relying on the postcode. In Google Maps, right-click the correct entrance and copy its coordinates. Paste them below, or click / drag the pin on this map. A Google Maps view URL may show the camera centre rather than the venue, so use the copied coordinates.</p><label class="form-label" for="vCoordinatePaste">Coordinates copied from Google Maps (latitude, longitude)</label><div class="library-tools"><input id="vCoordinatePaste" placeholder="51.5074, -0.1278"><button class="outline" id="applyCoordinates">Apply</button></div><div id="positionMap" aria-label="Choose venue position"></div><label class="layer"><span>I have checked this venue’s position</span><input id="vVerified" type="checkbox" ${v.verified ? "checked" : ""}></label><p class="micro">Postcode positions are approximate. Save to keep the corrected pin.</p><label class="form-label">Categories</label>${
      state.categories
        .filter((c) => !c.rule)
        .map(
          (c) =>
            `<label class="layer"><span class="dot" style="--dot:${esc(categoryMarkerColour(c))}"></span><span>${esc(c.name)}</span><input type="checkbox" data-vcat="${esc(c.id)}" ${(v.categories || []).includes(c.id) ? "checked" : ""}></label>`,
        )
        .join("") ||
      "<p>Create a category in Map layers to organise other venues.</p>"
    }<div class="form-actions">${id ? '<button class="outline" id="removeVenue">Delete venue</button>' : ""}<button class="outline" id="locateVenue">Find address</button><button class="primary" id="saveVenue">Save venue</button></div><div id="vStatus" class="micro"></div>`,
  );
  $("#vType").value = v.type;
  setupPositionEditor(v);
  setupVenueInformation(v);
  $("#locateVenue").onclick = async () => {
    const btn = $("#locateVenue");
    btn.disabled = true;
    $("#vStatus").textContent = "Looking up address…";
    try {
      const address = $("#vAddress").value;
      let p = await postcodePoint(address);
      if (!p && state.settings.mapbox) {
        const d = await request(
          `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(address)}&country=gb&limit=1&access_token=${encodeURIComponent(state.settings.mapbox)}`,
        );
        const f = d.features?.[0];
        if (f)
          p = {
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            label: "Address lookup — verify position",
          };
      }
      if (!p)
        throw Error(
          "No location found. Include a full UK postcode, enter coordinates, or add a Mapbox token in Settings.",
        );
      $("#vLat").value = p.lat;
      $("#vLng").value = p.lng;
      $("#vStatus").textContent = p.label;
      $("#vStatus").dataset.location = p.label;
      $("#vVerified").checked = false;
      $("#vLat").dispatchEvent(new Event("change"));
    } catch (e) {
      $("#vStatus").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  };
  $("#saveVenue").onclick = () => {
    const name = $("#vName").value.trim(),
      lat = $("#vLat").value === "" ? null : Number($("#vLat").value),
      lng = $("#vLng").value === "" ? null : Number($("#vLng").value),
      cap = $("#vCapacity").value === "" ? null : Number($("#vCapacity").value);
    if (!name) return toast("Enter a venue name.");
    if (
      (lat === null) !== (lng === null) ||
      (lat !== null &&
        (!Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180))
    )
      return toast(
        "Enter a valid latitude and longitude together, or leave both blank.",
      );
    if (cap !== null && (!Number.isInteger(cap) || cap < 0))
      return toast("Capacity must be a positive whole number or blank.");
    const email = $("#vEmail").value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return toast("Enter a valid contact email or leave it blank.");
    const details = readVenueInformation();
    if (!details) return;
    Object.assign(v, {
      ...details,
      town: $("#vTown").value.trim(),
      region: $("#vRegion").value.trim(),
      contactName: $("#vContact").value.trim(),
      email,
      phone: $("#vPhone").value.trim(),
      jobTitle: $("#vJobTitle").value.trim(),
      notes: $("#vNotes").value.trim(),
      verified: $("#vVerified").checked,
      name,
      address: $("#vAddress").value.trim(),
      capacity: cap,
      type: $("#vType").value,
      lat,
      lng,
      categories: [
        ...$("#modalBody").querySelectorAll("[data-vcat]:checked"),
      ].map((i) => i.dataset.vcat),
      example: false,
      location:
        $("#vStatus").dataset.location ||
        (lat !== v.lat || lng !== v.lng
          ? "Manually entered coordinates"
          : v.location),
    });
    if (v.importSource === "General Hit List March 2026") {
      v.categories = v.categories.filter(
        (c) => !["hitlist-active", "hitlist-closed"].includes(c),
      );
      if (v.status === "permanently_closed") v.categories.push("hitlist-closed");
    }
    if (!id) state.venues.push(v);
    save();
    renderLayers();
    renderVenues();
    renderTour();
    drawTour();
    library();
  };
  if (id)
    $("#removeVenue").onclick = () => {
      if (
        state.tours.some((t) =>
          [...t.stops, ...t.applied, ...(t.suggestions || [])].some((s) => s.venueId === id),
        )
      )
        return toast(
          "This venue is used in a tour. Remove its tour stops and suggestions first.",
        );
      state.venues = state.venues.filter((x) => x.id !== id);
      save();
      renderLayers();
      renderVenues();
      library();
    };
}
$("#libraryBtn").onclick = library;
$("#planTab").onclick = () => {
  if ($("#modal").open) close();
};

function setupPositionEditor(v) {
  const updateLink = () => {
    $("#googleCheck").href = googleURL({
      name: $("#vName").value,
      town: $("#vTown").value,
      region: $("#vRegion").value,
    });
  };
  ["vName", "vTown", "vRegion"].forEach((id) =>
    $("#" + id).addEventListener("input", updateLink),
  );
  let editor = null,
    marker = null;
  if (typeof L !== "undefined") {
    editor = L.map("positionMap", { scrollWheelZoom: false }).setView(
      hasLocation(v) ? [v.lat, v.lng] : [54, -3],
      hasLocation(v) ? 14 : 5,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(editor);
  }
  function put(lat, lng, manual) {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      return false;
    $("#vLat").value = lat.toFixed(6);
    $("#vLng").value = lng.toFixed(6);
    if (manual) {
      $("#vVerified").checked = false;
      $("#vStatus").dataset.location =
        "Manually positioned — check venue entrance";
      $("#vStatus").textContent = "Pin moved. Check its position, then save.";
    }
    if (editor) {
      if (!marker) {
        marker = L.marker([lat, lng], {
          draggable: true,
          icon: pin("#008cff"),
        }).addTo(editor);
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          put(p.lat, p.lng, true);
        });
      } else marker.setLatLng([lat, lng]);
    }
    return true;
  }
  if (hasLocation(v)) put(v.lat, v.lng, false);
  if (editor) {
    editor.on("click", (e) => put(e.latlng.lat, e.latlng.lng, true));
    requestAnimationFrame(() => editor.invalidateSize());
  }
  ["vLat", "vLng"].forEach((id) =>
    $("#" + id).addEventListener("input", () => {
      $("#vVerified").checked = false;
      $("#vStatus").dataset.location = "Manually entered coordinates";
    }),
  );
  ["vLat", "vLng"].forEach((id) =>
    $("#" + id).addEventListener("change", () => {
      if (
        $("#vLat").value &&
        $("#vLng").value &&
        put(Number($("#vLat").value), Number($("#vLng").value), false) &&
        editor
      )
        editor.setView(marker.getLatLng(), 16);
    }),
  );
  $("#applyCoordinates").onclick = () => {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(
      $("#vCoordinatePaste").value,
    );
    if (!m || !put(Number(m[1]), Number(m[2]), true))
      return toast("Paste two coordinates, for example 51.5074, -0.1278.");
    if (editor) editor.setView(marker.getLatLng(), 17);
  };
  $("#modal").addEventListener("close", () => editor?.remove(), { once: true });
}

function postcode(address) {
  return (
    address
      .toUpperCase()
      .match(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/)?.[0] || null
  );
}
async function postcodePoint(address) {
  const p = postcode(address);
  if (!p) return null;
  try {
    const d = await request(
      "https://api.postcodes.io/postcodes/" + encodeURIComponent(p),
    );
    return d.result
      ? {
          lat: d.result.latitude,
          lng: d.result.longitude,
          label: "Approximate postcode location",
        }
      : null;
  } catch {
    return null;
  }
}
async function locatePostcodes(venues) {
  const pending = venues.filter((v) => !hasLocation(v) && postcode(v.address));
  let found = 0;
  for (let i = 0; i < pending.length; i += 100) {
    const batch = pending.slice(i, i + 100);
    const r = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postcodes: batch.map((v) => postcode(v.address)),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error();
    const d = await r.json();
    d.result.forEach((x, j) => {
      if (x.result) {
        Object.assign(batch[j], {
          lat: x.result.latitude,
          lng: x.result.longitude,
          location: "Approximate postcode location",
        });
        found++;
      }
    });
  }
  return found;
}
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  let rows = [],
    row = [],
    field = "",
    quoted = false;
  const first = text.split(/\r?\n/)[0],
    delimiter =
      (first.match(/;/g) || []).length > (first.match(/,/g) || []).length
        ? ";"
        : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field.length)
        throw Error("Unexpected quote in CSV.");
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("An opening quote has no closing quote.");
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
function importModal() {
  modal(
    "Bring your venues along",
    `<p>Import a CSV file, then match its columns. Existing venues are kept. Names and addresses are enough to save a venue; coordinates or a UK postcode put it on the map.</p><div class="dropzone"><strong>Choose your venue CSV</strong><input type="file" id="csvFile" accept=".csv,text/csv"></div><div class="help-box">Suggested columns<br><code>name,address,town,region,contact_name,email,phone,notes,capacity,type,categories,latitude,longitude</code><br>Separate multiple categories with <code>|</code>. Categories are created automatically. Use <code>theatre</code> for theatres and <code>other</code> for record shops or other spaces.</div><button class="outline" id="templateCSV">↓ Download CSV template</button><div id="importMapping"></div>`,
  );
  $("#templateCSV").onclick = () =>
    download(
      "venue-import-template.csv",
      'name,address,town,region,contact_name,email,phone,notes,capacity,type,categories,latitude,longitude\r\n"Your venue","Street, Town, AB1 2CD",Town,Region,,,,,,other,"Record shops",,\r\n',
      "text/csv",
    );
  $("#csvFile").onchange = async () => {
    const file = $("#csvFile").files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024)
      return toast("Please split files larger than 15 MB into smaller CSVs.");
    try {
      const rows = parseCSV(await file.text());
      if (rows.length < 2)
        throw Error("Include a header and at least one venue row.");
      if (rows.length > 10001)
        throw Error("Import up to 10,000 venues at a time.");
      mapping(rows);
    } catch (e) {
      toast("Could not read CSV: " + e.message);
    }
  };
}
function mapping(rows) {
  const header = rows[0];
  const fields = [
    [
      "name",
      "Venue name",
      ["name", "venue", "venue name", "theatre", "theatre name"],
    ],
    ["address", "Address", ["address", "full address", "venue address"]],
    [
      "town",
      "Town / city (optional)",
      ["town", "city", "town/city", "town or city"],
    ],
    ["region", "Region / county", ["region", "county", "area"]],
    [
      "jobTitle",
      "Contact job title",
      ["job title", "job_title", "contact role"],
    ],
    ["status", "Venue status", ["status"]],
    ["venueHire", "Venue hire", ["venue_hire", "venue hire"]],
    ["website", "Website", ["website"]],
    ["contactsJSON", "Additional contacts JSON", ["contacts_json"]],
    ["spacesJSON", "Spaces JSON", ["spaces_json"]],
    ["sourcesJSON", "Research links JSON", ["sources_json"]],
    ["researchNote", "Research note", ["research_note"]],
    [
      "contactName",
      "Contact name",
      ["contact name", "contact", "contact person", "contact_name"],
    ],
    [
      "email",
      "Contact email",
      ["email", "email address", "contact email", "email_address"],
    ],
    [
      "phone",
      "Phone number",
      ["phone", "telephone", "phone number", "tel", "phone_number"],
    ],
    ["notes", "Notes", ["notes", "comments", "booking notes"]],
    [
      "postcode",
      "Postcode (optional)",
      ["postcode", "post code", "postal code"],
    ],
    ["capacity", "Capacity", ["capacity", "seats", "seating capacity"]],
    ["type", "Type", ["type", "venue type"]],
    ["categories", "Categories", ["categories", "category"]],
    ["lat", "Latitude", ["latitude", "lat"]],
    ["lng", "Longitude", ["longitude", "lng", "lon", "long"]],
  ];
  $("#importMapping").innerHTML =
    `<h2 style="margin-top:25px">Match your columns</h2><div class="form-grid">${fields
      .map(([key, label, aliases]) => {
        const match = header.findIndex((h) =>
          aliases.includes(h.trim().toLowerCase()),
        );
        return `<div><label class="form-label" for="col-${key}">${label}</label><select id="col-${key}"><option value="-1">${key === "name" ? "Select a column…" : "Not included"}</option>${header.map((h, i) => `<option value="${i}" ${i === match ? "selected" : ""}>${esc(h)}</option>`).join("")}</select></div>`;
      })
      .join(
        "",
      )}</div><label class="form-label" for="defaultType">Default venue type when the CSV has no type</label><select id="defaultType"><option value="theatre">Theatre</option><option value="other">Other venue (record shops, halls…)</option></select><label class="form-label" for="importCat">Also assign every imported venue to a category</label><select id="importCat"><option value="">No additional category</option>${state.categories
      .filter((c) => !c.rule)
      .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
      .join(
        "",
      )}</select><div class="help-box">${rows.length - 1} rows found. You’ll review valid rows, duplicate names/addresses and location issues before importing.</div><div class="form-actions"><button class="primary" id="reviewCSV">Review import →</button></div>`;
  $("#reviewCSV").onclick = () => {
    const columns = Object.fromEntries(
      fields.map(([k]) => [k, Number($("#col-" + k).value)]),
    );
    if (columns.name < 0) return toast("Choose the venue name column.");
    reviewImport(
      rows.slice(1),
      columns,
      $("#defaultType").value,
      $("#importCat").value,
    );
  };
}
function reviewImport(rows, cols, defaultType, extra) {
  const seen = new Set(
    state.venues.map((v) => (v.name + "|" + v.address).toLowerCase().trim()),
  );
  const accepted = [],
    issues = [],
    newCats = new Map();
  let duplicates = 0;
  const get = (row, k) => (cols[k] >= 0 ? row[cols[k]] || "" : "").trim();
  rows.forEach((row, i) => {
    const name = get(row, "name"),
      address = [
        get(row, "address"),
        ...["town", "postcode"]
          .map((k) => get(row, k))
          .filter(
            (part) =>
              part &&
              !get(row, "address").toLowerCase().includes(part.toLowerCase()),
          ),
      ]
        .filter(Boolean)
        .join(", ");
    if (!name) {
      issues.push(`Row ${i + 2}: missing venue name`);
      return;
    }
    const dedupe = (name + "|" + address).toLowerCase().trim();
    if (seen.has(dedupe)) {
      duplicates++;
      return;
    }
    seen.add(dedupe);
    let lat = get(row, "lat") === "" ? null : Number(get(row, "lat")),
      lng = get(row, "lng") === "" ? null : Number(get(row, "lng")),
      capacity =
        get(row, "capacity") === "" ? null : Number(get(row, "capacity"));
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0)) {
      issues.push(`Row ${i + 2}: invalid capacity; stored as unknown`);
      capacity = null;
    }
    if (
      (lat === null) !== (lng === null) ||
      (lat !== null &&
        (!Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180))
    ) {
      issues.push(
        `Row ${i + 2}: invalid coordinates; saved for location review`,
      );
      lat = null;
      lng = null;
    }
    const categories = get(row, "categories")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => {
        let c =
          state.categories.find(
            (c) => c.name.toLowerCase() === name.toLowerCase(),
          ) || newCats.get(name.toLowerCase());
        if (!c) {
          c = {
            id: uid(),
            name,
            color: ["#c58e59", "#799cb4", "#ae80a5", "#a7a65b"][
              newCats.size % 4
            ],
            on: true,
          };
          newCats.set(name.toLowerCase(), c);
        }
        return c.id;
      });
    if (extra && !categories.includes(extra)) categories.push(extra);
    const type = get(row, "type").toLowerCase() || defaultType;
    accepted.push({
      id: uid(),
      name,
      address,
      town: get(row, "town"),
      region: get(row, "region"),
      contactName: get(row, "contactName"),
      jobTitle: get(row, "jobTitle"),
      status: get(row, "status") || "unknown",
      venueHire: get(row, "venueHire") || "unknown",
      website: get(row, "website"),
      contacts: importJSONCell(
        get(row, "contactsJSON"),
        "contacts",
        issues,
        i + 2,
      ),
      spaces: importJSONCell(get(row, "spacesJSON"), "spaces", issues, i + 2),
      sources: importJSONCell(
        get(row, "sourcesJSON"),
        "sources",
        issues,
        i + 2,
      ),
      researchNote: get(row, "researchNote"),
      email: get(row, "email"),
      phone: get(row, "phone"),
      notes: get(row, "notes"),
      verified: false,
      capacity,
      type: ["theatre", "theater", "theatres", "theaters"].includes(type)
        ? "theatre"
        : "other",
      categories,
      lat,
      lng,
      location: lat !== null ? "Imported coordinates" : "",
    });
  });
  modal(
    "Review your import",
    `<div class="tour-stats" style="padding:0 0 20px"><div><strong>${accepted.length}</strong><small>READY TO IMPORT</small></div><div><strong>${duplicates}</strong><small>DUPLICATES SKIPPED</small></div><div><strong>${accepted.filter((v) => !hasLocation(v)).length}</strong><small>NEED A LOCATION</small></div></div><div class="library-table"><table><thead><tr><th>VENUE</th><th>ADDRESS</th><th>LOCATION</th></tr></thead><tbody>${accepted
      .slice(0, 30)
      .map(
        (v) =>
          `<tr><td>${esc(v.name)}</td><td>${esc(v.address)}</td><td>${hasLocation(v) ? "Coordinates" : postcode(v.address) ? "Postcode lookup" : "Needs review"}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div>${accepted.length > 30 ? `<p>Showing the first 30 of ${accepted.length} venues.</p>` : ""}<div class="help-box">${newCats.size} new categories will be created. Missing locations stay in your library. ${issues.length ? "Import notes: " + issues.slice(0, 15).map(esc).join("<br>") : "No data issues found."}</div><label class="layer"><span>Locate UK postcodes after importing (approximate positions)</span><input id="geocodeImport" type="checkbox" checked></label><p class="micro">Postcode lookup sends venue postcodes to postcodes.io. Exact address lookup is available separately with your own Mapbox token in Settings.</p><div class="form-actions"><button class="outline" id="restartImport">Choose another file</button><button class="primary" id="commitImport" ${accepted.length ? "" : "disabled"}>Import ${accepted.length} venues</button></div>`,
  );
  $("#restartImport").onclick = importModal;
  $("#commitImport").onclick = async () => {
    const button = $("#commitImport"),
      locate = $("#geocodeImport").checked;
    button.disabled = true;
    button.textContent = "Importing…";
    state.venues.push(...accepted);
    state.categories.push(...newCats.values());
    save();
    if (locate) {
      try {
        await locatePostcodes(accepted);
        save();
      } catch {
        toast(
          "Venues imported. Postcode service unavailable; retry from your library.",
        );
      }
    }
    renderLayers();
    renderVenues();
    renderTour();
    close();
    fit();
    toast(
      `${accepted.length} venues imported. ${accepted.filter((v) => !hasLocation(v)).length} still need a location in your library.`,
    );
  };
}
$("#importBtn").onclick = importModal;
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csvCell(s) {
  s = String(s ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
$("#exportBtn").onclick = () => {
  modal(
    "Keep a copy of your workspace",
    `<p>A full backup includes all venues, categories and company tours. Venue CSVs can be opened in a spreadsheet or imported again.</p><div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap"><button class="primary" id="backupBtn">↓ Full backup</button><button class="outline" id="venueCSV">↓ Venue CSV</button><button class="outline" id="tourCSV">↓ Current tour CSV</button></div><label class="form-label" for="restoreFile">Restore a full backup (.json)</label><input id="restoreFile" type="file" accept=".json,application/json"><p class="micro">Restoring replaces this browser’s workspace after a review. Export a backup first.</p><div id="restoreReview"></div>`,
  );
  $("#backupBtn").onclick = () => {
    const backup = structuredClone(state);
    backup.settings.mapbox = "";
    download(
      "tour-atlas-backup.json",
      JSON.stringify(backup, null, 2),
      "application/json",
    );
  };
  $("#venueCSV").onclick = () =>
    download(
      "tour-atlas-venues.csv",
      [
        [
          "name",
          "address",
          "town",
          "region",
          "contact_name",
          "job_title",
          "email",
          "phone",
          "notes",
          "capacity",
          "type",
          "categories",
          "latitude",
          "longitude",
          "status",
          "venue_hire",
          "website",
          "contacts_json",
          "spaces_json",
          "sources_json",
          "research_note",
        ],
        ...state.venues.map((v) => [
          v.name,
          v.address,
          v.town,
          v.region,
          v.contactName,
          v.jobTitle,
          v.email,
          v.phone,
          v.notes,
          v.capacity,
          v.type,
          state.categories
            .filter((c) => v.categories.includes(c.id))
            .map((c) => c.name)
            .join("|"),
          v.lat,
          v.lng,
          v.status,
          v.venueHire,
          v.website,
          JSON.stringify(v.contacts || []),
          JSON.stringify(v.spaces || []),
          JSON.stringify(v.sources || []),
          v.researchNote,
        ]),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n"),
      "text/csv",
    );
  $("#tourCSV").onclick = () =>
    download(
      "tour-atlas-tour.csv",
      [
        ["date", "venue", "address"],
        ...tour()
          .stops.filter((s) => s.venueId)
          .map((s) => {
            const v = state.venues.find((v) => v.id === s.venueId);
            return [s.date, v?.name, v?.address];
          }),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n"),
      "text/csv",
    );
  $("#restoreFile").onchange = async () => {
    try {
      const file = $("#restoreFile").files[0];
      if (!file || file.size > 20 * 1024 * 1024)
        throw Error("Choose a backup smaller than 20 MB.");
      const d = JSON.parse(await file.text());
      validateBackup(d);
      $("#restoreReview").innerHTML =
        `<div class="status-box">Replace this workspace with ${d.venues.length} venues, ${d.categories.length} categories and ${d.tours.length} tours?</div><div class="form-actions"><button class="primary" id="confirmRestore">Replace workspace</button></div>`;
      $("#confirmRestore").onclick = () => {
        d.settings = {
          mapbox: state.settings.mapbox,
          router: "https://router.project-osrm.org",
        };
        state = d;
        save();
        renderTour();
        renderLayers();
        renderVenues();
        drawTour();
        $("#tourLayer").checked = state.tourOn;
        $("#timesLayer").checked = state.times;
        close();
        fit();
        toast("Workspace restored.");
      };
    } catch (e) {
      toast("Cannot restore: " + e.message);
    }
  };
};
function validateBackup(d) {
  if (
    d.version !== 1 ||
    !Array.isArray(d.venues) ||
    !Array.isArray(d.categories) ||
    !Array.isArray(d.tours) ||
    !d.tours.length ||
    d.venues.length > 50000 ||
    d.categories.length > 1000 ||
    d.tours.length > 1000
  )
    throw Error("Invalid Tour Mapper backup.");
  const str = (x) => typeof x === "string" && x.length < 20000;
  for (const c of d.categories)
    if (
      !str(c.id) ||
      !str(c.name) ||
      !/^#[0-9a-f]{6}$/i.test(c.color) ||
      (c.rule && !["theatre", "large", "medium", "small"].includes(c.rule))
    )
      throw Error("Invalid category.");
  const ids = new Set();
  for (const v of d.venues) {
    if (
      !str(v.id) ||
      ids.has(v.id) ||
      !str(v.name) ||
      !str(v.address) ||
      !["theatre", "other"].includes(v.type) ||
      !Array.isArray(v.categories) ||
      !v.categories.every(str) ||
      (v.capacity !== null &&
        (!Number.isInteger(v.capacity) || v.capacity < 0)) ||
      ((v.lat !== null || v.lng !== null) && !hasLocation(v))
    )
      throw Error("Invalid venue.");
    for (const field of [
      "town",
      "region",
      "contactName",
      "email",
      "phone",
      "jobTitle",
      "notes",
    ])
      if (v[field] !== undefined && !str(v[field]))
        throw Error("Invalid venue detail.");
    if (typeof validateVenueExtension === "function") validateVenueExtension(v);
    ids.add(v.id);
  }
  for (const t of d.tours) {
    if (
      !str(t.id) ||
      !str(t.name) ||
      !Array.isArray(t.stops) ||
      !Array.isArray(t.applied)
    )
      throw Error("Invalid tour.");
    if (typeof validateTourSuggestions === "function") validateTourSuggestions(t, ids);
    for (const s of [...t.stops, ...t.applied])
      if (
        !str(s.id) ||
        !str(s.date) ||
        !str(s.venueId) ||
        (s.venueId && !ids.has(s.venueId))
      )
        throw Error("Invalid tour stop.");
  }
  if (!d.tours.some((t) => t.id === d.current))
    throw Error("Invalid current tour.");
}
$("#settingsBtn").onclick = () => {
  modal(
    "Workspace settings",
    `<h2>Storage</h2><p>Your venues and tours are saved in this browser on this device. Use Export → Full backup to move them or protect a copy. For cross-device saving, open cloud sync above and sign in. Cloud saves are explicit; browser saving continues automatically.</p><h2 style="margin-top:22px">Address lookup</h2><p>UK postcode lookup works without a key and gives approximate positions. For full addresses, optionally add a Mapbox public access token with geocoding access. Requests are sent to Mapbox when you choose Find address; usage charges may apply.</p><label class="form-label" for="mapboxToken">Mapbox public token (pk.…)</label><input id="mapboxToken" type="password" autocomplete="off" value="${esc(state.settings.mapbox)}" placeholder="Optional"><p class="micro">Stored only in this browser, excluded from exported backups. Use a URL-restricted public token for this site.</p><div class="help-box">Map: © OpenStreetMap contributors. Road journeys: OSRM public demo service, with no live traffic and no availability guarantee. Postcodes: postcodes.io. Route planning sends venue coordinates to OSRM.</div><div class="form-actions"><button class="primary" id="saveSettings">Save settings</button></div>`,
  );
  $("#saveSettings").onclick = () => {
    const token = $("#mapboxToken").value.trim();
    if (token && !token.startsWith("pk."))
      return toast("Use a public Mapbox token beginning pk.");
    state.settings.mapbox = token;
    save();
    close();
    toast("Settings saved.");
  };
};
$("#helpBtn").onclick = () => {
  modal(
    "A few notes for the road",
    `<h2>1. Build your venue library</h2><p>Import your CSV and match the columns. Names and addresses are retained even if a location cannot be found. UK postcodes provide approximate coordinates; edit a venue to enter its exact entrance coordinates. Record shops can use type “other” and their own category.</p><h2>2. Make a company tour</h2><p>Create a company tour, enter dates as dd/mm/yy (years 2000–2099), and type any consecutive part of a venue name. “wall” finds “The North Wall”. Select a suggestion, then add more rows with the plus button. Dates sort automatically when you leave the date box.</p><h2>3. Update the map</h2><p>Choose Update Tour to apply the schedule. Blue balloons are numbered by date. Dark red lines follow road routes when the routing service is available. Dashed lines mean a road route could not be found. Enable Driving times for bold white estimates along each journey.</p><h2>4. Control your layers</h2><p>Venue categories combine within their group. When any capacity filter is on, the map shows only venues with a matching space within the selected venue categories. Switch off All Theatres to see capacity layers alone. Each space is counted separately: under 100, or 100 and above. A venue can match several size groups. Unknown capacities only appear in the unfiltered view. The last matching enabled category supplies the marker colour. Suggested venues use the selected tour’s booking-status colours. Enable Suggested for this tour to show only its suggestions.</p><h2>5. Keep a backup</h2><p>Work saves in this browser. Clearing browser data removes it, so export a full backup regularly. New tours are separate from each other. Example venues are only a starting collection; this is not a complete UK theatre directory.</p>`,
  );
};
function init() {
  renderTour();
  renderLayers();
  if (typeof L === "undefined") {
    toast(
      "The map library could not load. Check your connection and reload; your saved data is safe.",
    );
    return;
  }
  map = L.map("map", { zoomControl: false }).setView([54.5, -3.4], 6);
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  venueMarkers = L.layerGroup().addTo(map);
  routeLines = L.layerGroup().addTo(map);
  timeLabels = L.layerGroup().addTo(map);
  tourMarkers = L.layerGroup().addTo(map);
  renderVenues();
  drawTour();
  save();
}
init();
