// Saved cloud venues open automatically for signed-in users. Local edits are saved on this browser first.
// Uploads are explicit; optimistic revision checks prevent stale-device overwrites.
let cloudClient = null;
let cloudRevision = null;
let cloudUser = null;
const cloudKey = "tour-atlas-cloud-config";
function cloudConfig() {
  let config = window.TOUR_ATLAS_CLOUD || {};
  try {
    const saved = JSON.parse(localStorage.getItem(cloudKey));
    if (saved?.url && saved?.publishableKey) config = saved;
  } catch {}
  return config;
}
function cloudConnection(config) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url || ""))
    throw Error("Use your hosted Supabase project URL, ending .supabase.co.");
  if (
    !config.publishableKey ||
    (!config.publishableKey.startsWith("sb_publishable_") &&
      !config.publishableKey.startsWith("eyJ"))
  )
    throw Error(
      "Use a publishable or legacy anon key. Never use a secret or service-role key.",
    );
  if (config.publishableKey.startsWith("eyJ")) {
    try {
      const claim = JSON.parse(
        atob(
          config.publishableKey
            .split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
        ),
      );
      if (claim.role !== "anon") throw Error();
    } catch {
      throw Error("This must be a legacy anon key, not a service-role key.");
    }
  }
  if (!window.supabase)
    throw Error(
      "Supabase library has not loaded. Check your internet connection.",
    );
  cloudClient = window.supabase.createClient(
    config.url,
    config.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
  cloudRevision = null;
  cloudClient.auth.onAuthStateChange((event, session) => {
    const userChanged = cloudUser !== (session?.user?.id || null);
    if (userChanged) cloudRevision = null;
    cloudUser = session?.user?.id || null;
    if (!session && typeof clearCompanySession === "function") clearCompanySession();
    if (
      session &&
      (event === "INITIAL_SESSION" || (event === "SIGNED_IN" && userChanged))
    ) {
      // Run after the auth callback releases its session lock.
      setTimeout(() => autoLoadCloud(session).catch(handleAutoLoadError), 0);
    }
  });
  return cloudClient;
}
async function showCloud() {
  const config = cloudConfig();
  if (!cloudClient && config.url && config.publishableKey) {
    try {
      cloudConnection(config);
    } catch {}
  }
  let session = cloudClient
    ? (await cloudClient.auth.getSession()).data.session
    : null;
  modal(
    companyContext.id ? "Cloud storage · " + (companyContext.name || "Company workspace") : "Supabase · your private workspace",
    `
    <p>Save your venues, contacts, notes and tours across devices. Your saved venues load automatically when this page opens. Changes are kept on this browser immediately; choose <strong>Save to cloud</strong> to make edits available on your other devices. Company workspaces have separate venue libraries, tours and access lists. Your personal workspace remains private.</p>
    ${
      !cloudClient
        ? `<label class="form-label" for="cloudURL">Supabase project URL</label><input id="cloudURL" placeholder="https://your-project.supabase.co" value="${esc(config.url || "")}"><label class="form-label" for="cloudPublicKey">Publishable key</label><input id="cloudPublicKey" placeholder="sb_publishable_…" value="${esc(config.publishableKey || "")}"><p class="micro">Use the project’s Connect dialog for these public connection details. Run the supplied database migration before saving.</p><div class="form-actions"><button class="primary" id="connectCloud">Connect project</button></div>`
        : session
          ? `
      <div class="status-box">Signed in as ${esc(session.user.email)}. ${cloudRevision === null ? "Load an existing workspace before updating its cloud copy." : "Loaded revision " + cloudRevision + "."}</div>
      <div class="form-actions"><button class="outline" id="loadCloud">Load from cloud</button><button class="primary" id="uploadCloud">Save to cloud</button></div><p class="micro">Export a backup before loading. Loading replaces this browser’s workspace after review. Saving updates the selected workspace’s cloud copy; a stale revision is rejected.</p>
      <div class="form-actions"><button class="outline" id="signOutCloud">Sign out</button></div>`
          : `
      <label class="form-label" for="cloudEmail">Your email</label><input id="cloudEmail" type="email" autocomplete="email"><label class="form-label" for="cloudPassword">Password</label><input id="cloudPassword" type="password" autocomplete="current-password"><div class="form-actions"><button class="outline" id="signupCloud">Create account</button><button class="primary" id="signinCloud">Sign in</button></div><p class="micro">A new account may need email confirmation. The Supabase account used to manage the project is separate from this app account. Your password goes directly to your Supabase project and is never put in a backup.</p>`
    }
    <div id="cloudMessage" class="micro" role="status"></div>`,
  );
  const report = (e) => {
    const el = $("#cloudMessage");
    if (el) el.textContent = e.message || String(e);
  };
  const busy = (id, fn) => {
    const button = $(id);
    if (button)
      button.onclick = async () => {
        button.disabled = true;
        try {
          await fn();
        } catch (e) {
          report(e);
        } finally {
          button.disabled = false;
        }
      };
  };
  busy("#connectCloud", async () => {
    const c = {
      url: $("#cloudURL").value.trim().replace(/\/$/, ""),
      publishableKey: $("#cloudPublicKey").value.trim(),
    };
    cloudConnection(c);
    localStorage.setItem(cloudKey, JSON.stringify(c));
    await showCloud();
  });
  busy("#signinCloud", async () => {
    const { data, error } = await cloudClient.auth.signInWithPassword({
      email: $("#cloudEmail").value.trim(),
      password: $("#cloudPassword").value,
    });
    if (error) throw error;
    await autoLoadCloud(data.session);
    close();
  });
  busy("#signupCloud", async () => {
    const { data, error } = await cloudClient.auth.signUp({
      email: $("#cloudEmail").value.trim(),
      password: $("#cloudPassword").value,
      options: { emailRedirectTo: location.origin + location.pathname + location.search },
    });
    if (error) throw error;
    if (data.session) {
      await autoLoadCloud(data.session);
      close();
    } else
      report(
        "Check your email to confirm the account, then return here and sign in.",
      );
  });
  busy("#signOutCloud", async () => {
    await cloudClient.auth.signOut();
    cloudRevision = null;
    await showCloud();
  });
  busy("#uploadCloud", async () => {
    const payload = structuredClone(state);
    payload.settings = {
      mapbox: "",
      router: "https://router.project-osrm.org",
    };
    validateBackup(payload);
    const { data, error } = await saveSelectedCloudPayload(payload, cloudRevision);
    if (error) {
      if (error.code === "23505")
        throw Error(
          "A cloud workspace already exists. Export a local backup, then load the cloud copy before saving changes.",
        );
      throw error;
    }
    cloudRevision = data;
    await rememberCloudVersion(session.user.id, payload, data);
    await showCloud();
    toast("Cloud copy saved.");
  });
  busy("#loadCloud", async () => {
    const { data, error } = await fetchSelectedCloudPayload(cloudClient, session.user.id);
    if (error) throw error;
    if (!data)
      throw Error(
        "No cloud copy yet. Choose Save to cloud on the device holding your venues.",
      );
    validateBackup(data.payload);
    modal(
      "Load your cloud workspace?",
      `<p>This replaces the workspace saved in this browser with <strong>${data.payload.venues.length} venues</strong> and <strong>${data.payload.tours.length} tours</strong>, saved ${esc(new Date(data.updated_at).toLocaleString("en-GB"))}.</p><p>Export a full backup first if you have local changes you want to keep.</p><div class="form-actions"><button class="outline" id="cancelCloudLoad">Cancel</button><button class="primary" id="confirmCloudLoad">Replace with cloud copy</button></div>`,
    );
    $("#cancelCloudLoad").onclick = showCloud;
    $("#confirmCloudLoad").onclick = async () => {
      const settings = state.settings;
      state = data.payload;
      state.settings = settings;
      cloudRevision = data.revision;
      await rememberCloudVersion(session.user.id, data.payload, data.revision);
      save();
      renderTour();
      renderLayers();
      renderVenues();
      drawTour();
      $("#tourLayer").checked = state.tourOn;
      $("#timesLayer").checked = state.times;
      close();
      fit();
      toast("Cloud workspace loaded.");
    };
  });
}
// Keep cloud setup reachable in Settings without changing the main planning flow.
const originalSettings = $("#settingsBtn").onclick;
$("#settingsBtn").onclick = () => {
  originalSettings();
  const section = document.createElement("div");
  section.innerHTML =
    '<div class="help-box"><strong>Supabase cloud storage</strong><br>Saved venues open automatically while you are signed in. Manage your account or save edits across devices.<br><button class="primary" id="openCloud" style="margin-top:10px">Open cloud sync</button></div>';
  $("#modalBody").prepend(section);
  $("#openCloud").onclick = showCloud;
};

let autoCloudPromise = null;
let autoCloudUser = null;
function comparableWorkspace(workspace) {
  const data = migrateCapacityLayers(structuredClone(workspace));
  delete data.settings;
  delete data.current;
  delete data.times;
  delete data.tourOn;
  for (const t of data.tours || []) delete t.showSuggested;
  for (const category of data.categories || []) delete category.on;
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
  return JSON.stringify(canonical(data));
}
async function workspaceSignature(workspace) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(comparableWorkspace(workspace)),
  );
  return Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function cloudMetadataKey(userId) {
  return "tour-atlas-cloud-baseline:" + cloudConfig().url + ":" + userId + (companyContext.id ? ":company:" + companyContext.id : "");
}
function readCloudVersion(userId) {
  try {
    return JSON.parse(localStorage.getItem(cloudMetadataKey(userId)));
  } catch {
    return null;
  }
}
async function rememberCloudVersion(userId, payload, revision) {
  const hash = await workspaceSignature(payload);
  try {
    localStorage.setItem(
      cloudMetadataKey(userId),
      JSON.stringify({ hash, revision }),
    );
    localStorage.setItem(companyCacheOwnerKey(), userId);
  } catch {}
}
function isStarterWorkspace(workspace) {
  return (
    workspace.venues.every((v) => v.example) &&
    workspace.categories.every((c) =>
      ["theatre", "large", "medium", "small"].includes(c.id),
    ) &&
    workspace.tours.length === 1 &&
    workspace.tours[0].name === "My first company tour" &&
    workspace.tours.every((t) =>
      !(t.suggestions || []).length && [...t.stops, ...t.applied].every((s) => !s.date && !s.venueId && !s.text),
    )
  );
}
function cloudStartupDecision({
  same,
  starter,
  localMatchesBaseline,
  baseline,
  remoteRevision,
  ownerChanged,
}) {
  if (ownerChanged || same || starter || localMatchesBaseline) return "load";
  if (baseline && baseline.revision === remoteRevision) return "keep";
  return "merge";
}
function mergeCloudAdditions(local, remote) {
  const merged = structuredClone(local);
  for (const key of ["venues", "categories", "tours"]) {
    const existing = new Set(merged[key].map((x) => x.id));
    merged[key].push(
      ...structuredClone(remote[key].filter((x) => !existing.has(x.id))),
    );
  }
  return merged;
}
function renderLoadedWorkspace() {
  save();
  renderTour();
  renderLayers();
  renderVenues();
  drawTour();
  $("#tourLayer").checked = state.tourOn;
  $("#timesLayer").checked = state.times;
  if (map) fit();
  if (!state.venues.some((v) => v.example))
    $("#mapNote").style.display = "none";
}
function handleAutoLoadError() {
  $("#saveState").textContent = "● Using venues saved on this browser";
}
async function autoLoadCloud(session) {
  if (!session || !cloudClient) return;
  if (autoCloudPromise && autoCloudUser === session.user.id)
    return autoCloudPromise;
  const client = cloudClient,
    userId = session.user.id;
  autoCloudUser = userId;
  autoCloudPromise = (async () => {
    const companyId = companyContext.id;
    const { data, error } = await fetchSelectedCloudPayload(client, userId);
    if (error) throw error;
    if (cloudUser !== userId || cloudClient !== client || companyContext.id !== companyId) return;
    if (!data) {
      if (companyContext.id) throw Error("This company workspace is unavailable.");
      $("#saveState").textContent = "● Saved on this browser";
      return;
    }
    validateBackup(data.payload);
    const stamp = JSON.stringify(state),
      local = structuredClone(state);
    const [localHash, remoteHash] = await Promise.all([
      workspaceSignature(local),
      workspaceSignature(data.payload),
    ]);
    if (cloudUser !== userId || cloudClient !== client || companyContext.id !== companyId) return;
    const baseline = readCloudVersion(userId);
    let owner;
    try {
      owner = localStorage.getItem(companyCacheOwnerKey());
    } catch {}
    const unchangedDuringLoad = stamp === JSON.stringify(state);
    let decision = cloudStartupDecision({
      same: !!companyContext.needsCloud || companyContext.role === "viewer" || localHash === remoteHash,
      starter: isStarterWorkspace(local),
      localMatchesBaseline: !!baseline && localHash === baseline.hash,
      baseline,
      remoteRevision: data.revision,
      ownerChanged: !!owner && owner !== userId,
    });
    if (
      !unchangedDuringLoad &&
      decision === "load" &&
      (!owner || owner === userId)
    )
      decision = "merge";
    if (decision === "load") {
      companyContext.needsCloud=false;
      const settings = state.settings,
        view = state;
      state = structuredClone(data.payload);
      state.settings = settings;
      if (!isStarterWorkspace(view) && (!owner || owner === userId)) {
        if (state.tours.some((t) => t.id === view.current))
          state.current = view.current;
        for (const t of state.tours) {
          const prior = view.tours.find(x => x.id === t.id);
          if (prior) t.showSuggested = !!prior.showSuggested;
        }
        state.times = view.times;
        state.tourOn = view.tourOn;
        for (const c of state.categories) {
          const prev = view.categories.find((x) => x.id === c.id);
          if (prev) c.on = prev.on;
        }
      }
      cloudRevision = data.revision;
      await rememberCloudVersion(userId, data.payload, data.revision);
      renderLoadedWorkspace();
      $("#saveState").textContent = "● Saved venues loaded";
    } else if (decision === "keep") {
      cloudRevision = data.revision;
      $("#saveState").textContent = "● Local changes saved on this browser";
    } else {
      state = mergeCloudAdditions(state, data.payload);
      cloudRevision = null;
      renderLoadedWorkspace();
      $("#saveState").textContent = "● Local changes kept";
    }
  })();
  try {
    await autoCloudPromise;
  } finally {
    autoCloudPromise = null;
    autoCloudUser = null;
  }
}
async function initialiseSavedVenues() {
  try {
    const config = cloudConfig();
    if (!config.url || !config.publishableKey) return;
    if (!cloudClient) cloudConnection(config);
    const { data, error } = await cloudClient.auth.getSession();
    if (error) throw error;
    if (data.session) {
      cloudUser = data.session.user.id;
      await autoLoadCloud(data.session);
    } else if (isStarterWorkspace(state)) {
      const label = $("#saveState");
      label.textContent = "Sign in once to load your venues";
      label.onclick = showCloud;
      label.style.cursor = "pointer";
      label.tabIndex = 0;
      label.setAttribute("role", "button");
      label.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") showCloud();
      };
    }
  } catch {
    handleAutoLoadError();
  }
}
// Defer until all page scripts, including rich venue validation, are installed.
window.addEventListener("load", () => initialiseSavedVenues());
window.addEventListener("online", () => initialiseSavedVenues());

function companyCacheOwnerKey() {
  return companyContext.id ? "tour-mapper-company-owner:" + companyContext.id : "tour-atlas-cache-owner";
}
function fetchSelectedCloudPayload(client, userId) {
  return companyContext.id
    ? client.from("tour_mapper_company_data").select("payload,revision,updated_at").eq("workspace_id", companyContext.id).maybeSingle()
    : client.from("tour_atlas_workspaces").select("payload,revision,updated_at").eq("user_id",userId).maybeSingle();
}
function saveSelectedCloudPayload(payload,revision) {
  if (companyContext.id) {
    if (!["owner","editor"].includes(companyContext.role)) throw Error("You have view-only access to this workspace.");
    return cloudClient.rpc("save_tour_mapper_company",{company_id:companyContext.id,new_payload:payload,expected_revision:revision});
  }
  return cloudClient.rpc("save_tour_atlas_workspace",{new_payload:payload,expected_revision:revision});
}
