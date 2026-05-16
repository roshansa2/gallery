import { useState, useEffect, useRef, useCallback } from "react";

const S = window.storage;
const genId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

async function sGet(k, sh = false) {
  try { const r = await S.get(k, sh); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function sSet(k, v, sh = false) {
  try { await S.set(k, JSON.stringify(v), sh); return true; }
  catch { return false; }
}
async function sDel(k, sh = false) {
  try { await S.delete(k, sh); } catch {}
}
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function useFont() {
  useEffect(() => {
    if (document.getElementById("folio-fonts")) return;
    const link = document.createElement("link");
    link.id = "folio-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500&display=swap";
    document.head.appendChild(link);
  }, []);
}

const ACCENT = "#b07d62";
const ACCENT_LIGHT = "rgba(176,125,98,0.12)";
const HEART = "#e05c5c";

export default function App() {
  useFont();
  const [scene, setScene] = useState("admin");
  const [clientGalleryId, setClientGalleryId] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  function goClient(id) { setClientGalleryId(id); setScene("client"); }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        .photo-card:hover .photo-overlay { opacity: 1 !important; }
        .photo-card:hover img { transform: scale(1.03); }
        img { transition: transform 0.35s ease; }
        .sidebar-item { transition: all 0.15s; }
        .sidebar-item:hover { background: ${ACCENT_LIGHT} !important; }
        .btn-ghost:hover { background: var(--color-background-secondary) !important; }
        .upload-zone:hover { border-color: ${ACCENT} !important; background: ${ACCENT_LIGHT} !important; }
        .fav-btn { transition: transform 0.2s, background 0.2s; }
        .fav-btn:hover { transform: scale(1.12) !important; }
        .fav-btn.active { transform: scale(1.08); }
        @keyframes heartPop { 0%{transform:scale(1)} 40%{transform:scale(1.35)} 100%{transform:scale(1.08)} }
        .heart-pop { animation: heartPop 0.3s ease forwards; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
        @keyframes toastIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:none} }
        .toast { animation: toastIn 0.25s ease forwards; }
        input:focus { outline: none; border-color: ${ACCENT} !important; box-shadow: 0 0 0 2px ${ACCENT_LIGHT}; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: var(--color-border-tertiary); border-radius: 4px; }
      `}</style>

      {toast && (
        <div className="toast" style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.type === "success" ? ACCENT : "var(--color-background-primary)", border: `0.5px solid ${toast.type === "success" ? ACCENT : "var(--color-border-secondary)"}`, borderRadius: 10, padding: "10px 18px", fontSize: 13, color: toast.type === "success" ? "#fff" : "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
          <i className={`ti ti-${toast.type === "success" ? "check" : "info-circle"}`} style={{ fontSize: 15 }} />
          {toast.msg}
        </div>
      )}

      {scene === "admin" && <AdminView onPreview={goClient} onClientMode={() => setScene("clientEntry")} showToast={showToast} />}
      {scene === "clientEntry" && <ClientEntry onEnter={goClient} onBack={() => setScene("admin")} showToast={showToast} />}
      {scene === "client" && <ClientGallery galleryId={clientGalleryId} onBack={() => setScene("admin")} showToast={showToast} />}
    </>
  );
}

function AdminView({ onPreview, onClientMode, showToast }) {
  const [galleries, setGalleries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();
  const createInputRef = useRef();

  const selected = galleries.find(g => g.id === selectedId);

  useEffect(() => {
    async function load() {
      const ids = (await sGet("my_galleries")) || [];
      const all = await Promise.all(ids.map(id => sGet(`gallery_${id}`, true)));
      const valid = all.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
      setGalleries(valid);
      if (valid.length > 0) setSelectedId(valid[0].id);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setPhotosLoading(true);

    async function loadPhotos() {
      const g = await sGet(`gallery_${selectedId}`, true);
      if (!g || !alive) return;
      const pids = g.photoIds || [];
      const loaded = await Promise.all(pids.map(pid => sGet(`photo_${selectedId}_${pid}`, true)));
      if (alive) { setPhotos(loaded.filter(Boolean)); setPhotosLoading(false); }
    }

    async function loadFavs() {
      const favs = (await sGet(`fav_${selectedId}`, true)) || [];
      if (alive) setFavorites(favs);
    }

    loadPhotos();
    loadFavs();
    const interval = setInterval(loadFavs, 3000);
    return () => { alive = false; clearInterval(interval); };
  }, [selectedId]);

  async function createGallery() {
    if (!newName.trim()) return;
    const id = genId();
    const gallery = { id, name: newName.trim(), createdAt: Date.now(), photoIds: [] };
    await sSet(`gallery_${id}`, gallery, true);
    const ids = (await sGet("my_galleries")) || [];
    await sSet("my_galleries", [id, ...ids]);
    setGalleries(prev => [gallery, ...prev]);
    setSelectedId(id);
    setPhotos([]);
    setFavorites([]);
    setNewName("");
    setCreating(false);
    showToast("Gallery created!", "success");
  }

  async function handleUpload(files) {
    if (!selected || !files || files.length === 0) return;
    setUploading(true);
    const g = await sGet(`gallery_${selected.id}`, true);
    const newIds = [];
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      const pid = genId();
      await sSet(`photo_${selected.id}_${pid}`, { id: pid, name: file.name, dataUrl }, true);
      newIds.push(pid);
    }
    const updated = { ...g, photoIds: [...(g.photoIds || []), ...newIds] };
    await sSet(`gallery_${selected.id}`, updated, true);
    setGalleries(prev => prev.map(gg => gg.id === selected.id ? updated : gg));
    const loaded = await Promise.all(updated.photoIds.map(pid => sGet(`photo_${selected.id}_${pid}`, true)));
    setPhotos(loaded.filter(Boolean));
    setUploading(false);
    showToast(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`, "success");
  }

  async function deletePhoto(pid) {
    const g = await sGet(`gallery_${selected.id}`, true);
    const updated = { ...g, photoIds: g.photoIds.filter(id => id !== pid) };
    await sSet(`gallery_${selected.id}`, updated, true);
    await sDel(`photo_${selected.id}_${pid}`, true);
    setGalleries(prev => prev.map(gg => gg.id === selected.id ? updated : gg));
    setPhotos(prev => prev.filter(p => p.id !== pid));
  }

  async function deleteGallery(id) {
    const g = await sGet(`gallery_${id}`, true);
    if (g) await Promise.all((g.photoIds || []).map(pid => sDel(`photo_${id}_${pid}`, true)));
    await sDel(`gallery_${id}`, true);
    await sDel(`fav_${id}`, true);
    const ids = (await sGet("my_galleries")) || [];
    await sSet("my_galleries", ids.filter(i => i !== id));
    const updated = galleries.filter(gg => gg.id !== id);
    setGalleries(updated);
    if (selectedId === id) { setSelectedId(updated[0]?.id || null); setPhotos([]); setFavorites([]); }
  }

  function copyCode() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.id).catch(() => {});
    setCopied(true);
    showToast("Gallery code copied!", "success");
    setTimeout(() => setCopied(false), 2500);
  }

  const favCount = favorites.length;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{ width: 268, minWidth: 268, background: "var(--color-background-primary)", borderRight: "0.5px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, letterSpacing: "0.04em", color: "var(--color-text-primary)", lineHeight: 1 }}>
            Folio<span style={{ color: ACCENT }}>.</span>
          </div>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-text-secondary)", marginTop: 4, fontWeight: 400 }}>Admin Studio</div>
        </div>

        {/* New gallery */}
        <div style={{ padding: "14px 16px 8px" }}>
          {creating ? (
            <div className="fade-in">
              <input
                ref={createInputRef}
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createGallery(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Gallery name..."
                style={{ width: "100%", fontSize: 13, padding: "8px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontFamily: "inherit", marginBottom: 7 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={createGallery} style={{ flex: 1, background: ACCENT, border: "none", borderRadius: 7, padding: "7px 0", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Create</button>
                <button onClick={() => { setCreating(false); setNewName(""); }} style={{ background: "none", border: "0.5px solid var(--color-border-secondary)", borderRadius: 7, padding: "7px 12px", fontSize: 12, cursor: "pointer", color: "var(--color-text-secondary)", fontFamily: "inherit" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} style={{ width: "100%", background: ACCENT, border: "none", borderRadius: 9, padding: "9px 0", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <i className="ti ti-plus" style={{ fontSize: 16 }} aria-hidden="true" />
              New Gallery
            </button>
          )}
        </div>

        {/* Gallery list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 8px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-secondary)", padding: "6px 8px 8px", fontWeight: 500 }}>Your Galleries</div>
          {loading ? (
            <div style={{ color: "var(--color-text-secondary)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading…</div>
          ) : galleries.length === 0 ? (
            <div style={{ color: "var(--color-text-secondary)", fontSize: 13, textAlign: "center", padding: "32px 12px", lineHeight: 1.6 }}>
              <i className="ti ti-photo-plus" style={{ fontSize: 32, display: "block", marginBottom: 10, opacity: 0.35 }} aria-hidden="true" />
              Create your first gallery to get started
            </div>
          ) : galleries.map(g => (
            <div key={g.id} className="sidebar-item" onClick={() => setSelectedId(g.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 9, padding: "9px 10px", cursor: "pointer", marginBottom: 2, background: selectedId === g.id ? ACCENT_LIGHT : "none", borderLeft: `2.5px solid ${selectedId === g.id ? ACCENT : "transparent"}`, transition: "all 0.15s" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: selectedId === g.id ? 500 : 400, color: selectedId === g.id ? ACCENT : "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{(g.photoIds || []).length} photos</div>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteGallery(g.id); }} className="btn-ghost" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", borderRadius: 6, padding: "3px 5px", opacity: 0, transition: "opacity 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
                aria-label="Delete gallery">
                <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {/* Client mode switch */}
        <div style={{ padding: "12px 16px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          <button onClick={onClientMode} style={{ width: "100%", background: "none", border: "0.5px solid var(--color-border-secondary)", borderRadius: 9, padding: "9px", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border-secondary)"; e.currentTarget.style.color = "var(--color-text-secondary)"; }}>
            <i className="ti ti-eye" style={{ fontSize: 15 }} aria-hidden="true" />
            Enter Client View
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", background: "var(--color-background-tertiary)" }}>
        {!selected ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-secondary)", gap: 12 }}>
            <i className="ti ti-layout-collage" style={{ fontSize: 52, opacity: 0.2 }} aria-hidden="true" />
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: "var(--color-text-primary)", letterSpacing: "0.02em" }}>Select a gallery</div>
            <div style={{ fontSize: 13 }}>or create a new one from the sidebar</div>
          </div>
        ) : (
          <div style={{ padding: "28px 32px", maxWidth: 1100 }} className="fade-in">
            {/* Gallery header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16 }}>
              <div>
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "0.02em", lineHeight: 1.1 }}>{selected.name}</h1>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
                  <span><i className="ti ti-photo" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} aria-hidden="true" />{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
                  {favCount > 0 && <span style={{ color: HEART, fontWeight: 500 }}><i className="ti ti-heart" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} aria-hidden="true" />{favCount} marked favourite</span>}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                {/* Gallery code display */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, border: "0.5px solid var(--color-border-secondary)", borderRadius: 9, overflow: "hidden" }}>
                  <div style={{ padding: "7px 12px", fontSize: 11, letterSpacing: "0.22em", fontFamily: "monospace", color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", borderRight: "0.5px solid var(--color-border-tertiary)", userSelect: "all" }}>{selected.id}</div>
                  <button onClick={copyCode} style={{ background: copied ? ACCENT : "var(--color-background-primary)", border: "none", padding: "7px 12px", cursor: "pointer", color: copied ? "#fff" : "var(--color-text-secondary)", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s" }}>
                    <i className={`ti ti-${copied ? "check" : "copy"}`} style={{ fontSize: 14 }} aria-hidden="true" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                <button onClick={() => onPreview(selected.id)} style={{ background: ACCENT, border: "none", borderRadius: 9, padding: "7px 16px", cursor: "pointer", fontSize: 13, color: "#fff", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                  <i className="ti ti-eye" style={{ fontSize: 15 }} aria-hidden="true" />
                  Preview
                </button>
              </div>
            </div>

            {/* Share callout */}
            <div style={{ background: ACCENT_LIGHT, border: `0.5px solid rgba(176,125,98,0.25)`, borderRadius: 10, padding: "12px 16px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <i className="ti ti-send" style={{ fontSize: 18, color: ACCENT, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ color: "var(--color-text-secondary)" }}>Share the gallery code <strong style={{ color: ACCENT, letterSpacing: "0.1em", fontFamily: "monospace" }}>{selected.id}</strong> with your client — they can enter it in Client View to mark their favourites.</span>
            </div>

            {/* Upload zone */}
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              style={{ border: `1.5px dashed ${dragOver ? ACCENT : "var(--color-border-secondary)"}`, borderRadius: 12, padding: "22px", textAlign: "center", cursor: "pointer", marginBottom: 28, transition: "all 0.2s", background: dragOver ? ACCENT_LIGHT : "var(--color-background-primary)" }}>
              {uploading ? (
                <div style={{ color: ACCENT, fontSize: 13 }}>
                  <i className="ti ti-loader" style={{ fontSize: 28, display: "block", marginBottom: 6, animation: "spin 1s linear infinite" }} aria-hidden="true" />
                  Uploading photos…
                </div>
              ) : (
                <>
                  <i className="ti ti-cloud-upload" style={{ fontSize: 30, color: ACCENT, display: "block", marginBottom: 8 }} aria-hidden="true" />
                  <div style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>Upload Photos</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3 }}>Click or drag & drop • JPG, PNG, WEBP</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => handleUpload(e.target.files)} />

            {/* Photo grid */}
            {photosLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)", fontSize: 13 }}>Loading photos…</div>
            ) : photos.length > 0 ? (
              <>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-secondary)", marginBottom: 14, fontWeight: 500 }}>
                  {photos.length} Photos {favCount > 0 && `· ${favCount} Favourited`}
                </div>
                <div style={{ columns: 3, gap: 14 }}>
                  {photos.map(photo => {
                    const isFav = favorites.includes(photo.id);
                    return (
                      <div key={photo.id} className="photo-card" style={{ breakInside: "avoid", marginBottom: 14, position: "relative", borderRadius: 10, overflow: "hidden", border: `1.5px solid ${isFav ? "rgba(224,92,92,0.5)" : "var(--color-border-tertiary)"}`, background: "var(--color-background-primary)", transition: "border-color 0.3s" }}>
                        <img src={photo.dataUrl} alt={photo.name} style={{ width: "100%", display: "block" }} />
                        <div className="photo-overlay" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 50%)", opacity: 0, transition: "opacity 0.25s" }} />
                        {isFav && (
                          <div style={{ position: "absolute", top: 9, left: 9, background: "rgba(224,92,92,0.92)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                            <i className="ti ti-heart" style={{ fontSize: 12, color: "#fff" }} aria-hidden="true" />
                            <span style={{ fontSize: 11, color: "#fff", fontWeight: 500 }}>Favourite</span>
                          </div>
                        )}
                        <div style={{ position: "absolute", bottom: 9, right: 9, display: "flex", gap: 6 }}>
                          <button onClick={() => deletePhoto(photo.id)} style={{ background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", transition: "background 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(200,50,50,0.8)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.55)"}
                            aria-label="Delete photo">
                            <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
                <i className="ti ti-photo-plus" style={{ fontSize: 40, display: "block", marginBottom: 12, opacity: 0.25 }} aria-hidden="true" />
                No photos yet — upload some above
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ClientEntry({ onEnter, onBack, showToast }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleEnter() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError("Please enter a gallery code."); return; }
    setChecking(true);
    setError("");
    const gallery = await sGet(`gallery_${trimmed}`, true);
    if (gallery) {
      onEnter(gallery.id);
    } else {
      setError("Gallery not found. Double-check the code and try again.");
    }
    setChecking(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--color-background-tertiary)", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
      <div className="fade-in" style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 18, padding: "44px 40px", width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ width: 54, height: 54, borderRadius: "50%", background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <i className="ti ti-photo" style={{ fontSize: 26, color: ACCENT }} aria-hidden="true" />
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8, letterSpacing: "0.02em" }}>View Gallery</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 28, lineHeight: 1.6 }}>Enter the gallery code your photographer shared with you</p>
        <input
          autoFocus
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleEnter()}
          placeholder="e.g. ABC123"
          style={{ width: "100%", fontSize: 20, letterSpacing: "0.25em", textAlign: "center", padding: "13px", border: `0.5px solid ${error ? "#e24b4a" : "var(--color-border-secondary)"}`, borderRadius: 10, background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontFamily: "monospace", marginBottom: 8 }}
        />
        {error && <div style={{ fontSize: 12, color: "#e24b4a", marginBottom: 10, textAlign: "left" }}><i className="ti ti-alert-circle" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} aria-hidden="true" />{error}</div>}
        <button onClick={handleEnter} disabled={checking}
          style={{ width: "100%", background: ACCENT, border: "none", borderRadius: 10, padding: "12px", color: "#fff", fontSize: 14, fontWeight: 500, cursor: checking ? "not-allowed" : "pointer", fontFamily: "inherit", marginTop: 4, opacity: checking ? 0.75 : 1, transition: "opacity 0.2s, transform 0.15s" }}
          onMouseEnter={e => !checking && (e.currentTarget.style.transform = "scale(1.01)")}
          onMouseLeave={e => e.currentTarget.style.transform = "none"}>
          {checking ? "Checking…" : "Open Gallery →"}
        </button>
        <button onClick={onBack} style={{ marginTop: 16, background: "none", border: "none", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, margin: "16px auto 0" }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 14 }} aria-hidden="true" />
          Back to Admin
        </button>
      </div>
    </div>
  );
}

function ClientGallery({ galleryId, onBack, showToast }) {
  const [gallery, setGallery] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [poppingId, setPoppingId] = useState(null);

  useEffect(() => {
    async function load() {
      const g = await sGet(`gallery_${galleryId}`, true);
      if (!g) { setLoading(false); return; }
      setGallery(g);
      const loaded = await Promise.all((g.photoIds || []).map(pid => sGet(`photo_${galleryId}_${pid}`, true)));
      setPhotos(loaded.filter(Boolean));
      const favs = (await sGet(`fav_${galleryId}`, true)) || [];
      setFavorites(favs);
      setLoading(false);
    }
    load();
  }, [galleryId]);

  async function toggleFavorite(e, photoId) {
    e.stopPropagation();
    let newFavs;
    if (favorites.includes(photoId)) {
      newFavs = favorites.filter(id => id !== photoId);
      showToast("Removed from favourites");
    } else {
      newFavs = [...favorites, photoId];
      setPoppingId(photoId);
      setTimeout(() => setPoppingId(null), 400);
      showToast("Added to favourites!", "success");
    }
    setFavorites(newFavs);
    await sSet(`fav_${galleryId}`, newFavs, true);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans', sans-serif", color: "var(--color-text-secondary)", gap: 10, fontSize: 13 }}>
        <i className="ti ti-loader" style={{ fontSize: 20 }} aria-hidden="true" /> Loading gallery…
      </div>
    );
  }

  if (!gallery) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans', sans-serif", color: "var(--color-text-secondary)", gap: 12 }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 40, opacity: 0.3 }} aria-hidden="true" />
        <div>Gallery not found.</div>
        <button onClick={onBack} style={{ background: "none", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-primary)" }}>← Go back</button>
      </div>
    );
  }

  const lbPhoto = lightbox !== null ? photos[lightbox] : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", fontFamily: "'DM Sans', sans-serif" }}>
      <h2 className="sr-only">Client gallery view for {gallery.name} — click photos to view full size, click the heart to mark favourites</h2>

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}
            onMouseEnter={e => e.currentTarget.style.color = ACCENT}
            onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-secondary)"}>
            <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true" /> Admin
          </button>
          <div style={{ width: 1, height: 18, background: "var(--color-border-tertiary)" }} />
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "0.02em" }}>{gallery.name}</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{photos.length} photos</div>
          {favorites.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(224,92,92,0.1)", border: "0.5px solid rgba(224,92,92,0.3)", borderRadius: 20, padding: "5px 12px" }}>
              <i className="ti ti-heart" style={{ fontSize: 14, color: HEART }} aria-hidden="true" />
              <span style={{ fontSize: 12, color: HEART, fontWeight: 500 }}>{favorites.length} of {photos.length} selected</span>
            </div>
          )}
        </div>
      </div>

      {/* Hint bar */}
      <div style={{ background: ACCENT_LIGHT, borderBottom: `0.5px solid rgba(176,125,98,0.2)`, padding: "10px 28px", fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
        <i className="ti ti-heart" style={{ fontSize: 14, color: ACCENT }} aria-hidden="true" />
        Click the heart on any photo to mark it as your favourite — your picks are saved automatically.
      </div>

      {/* Photos */}
      <div style={{ padding: "28px 28px 40px" }}>
        {photos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--color-text-secondary)" }}>
            <i className="ti ti-photo-off" style={{ fontSize: 48, display: "block", marginBottom: 12, opacity: 0.2 }} aria-hidden="true" />
            No photos in this gallery yet
          </div>
        ) : (
          <div style={{ columns: 3, gap: 14 }}>
            {photos.map((photo, idx) => {
              const isFav = favorites.includes(photo.id);
              const isPopping = poppingId === photo.id;
              return (
                <div key={photo.id} className="photo-card fade-in" style={{ breakInside: "avoid", marginBottom: 14, position: "relative", borderRadius: 11, overflow: "hidden", cursor: "pointer", border: `1.5px solid ${isFav ? "rgba(224,92,92,0.5)" : "var(--color-border-tertiary)"}`, transition: "border-color 0.3s", background: "var(--color-background-primary)" }}
                  onClick={() => setLightbox(idx)}>
                  <img src={photo.dataUrl} alt={photo.name} style={{ width: "100%", display: "block" }} />
                  <div className="photo-overlay" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 55%)", opacity: 0, transition: "opacity 0.25s", pointerEvents: "none" }} />
                  {isFav && (
                    <div style={{ position: "absolute", top: 9, left: 9, background: "rgba(224,92,92,0.92)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, pointerEvents: "none" }}>
                      <i className="ti ti-heart" style={{ fontSize: 12, color: "#fff" }} aria-hidden="true" />
                      <span style={{ fontSize: 11, color: "#fff", fontWeight: 500 }}>Favourite</span>
                    </div>
                  )}
                  <button className={`fav-btn${isPopping ? " heart-pop" : ""}${isFav ? " active" : ""}`}
                    onClick={e => toggleFavorite(e, photo.id)}
                    style={{ position: "absolute", bottom: 12, right: 12, background: isFav ? "rgba(224,92,92,0.95)" : "rgba(0,0,0,0.5)", border: `1.5px solid ${isFav ? "transparent" : "rgba(255,255,255,0.2)"}`, borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)", transform: isFav ? "scale(1.08)" : "scale(1)" }}
                    aria-label={isFav ? "Remove from favourites" : "Mark as favourite"}>
                    <i className="ti ti-heart" style={{ fontSize: 19, color: "#fff" }} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lbPhoto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" />
          </button>
          <button onClick={e => { e.stopPropagation(); setLightbox(i => Math.max(0, i - 1)); }} style={{ position: "absolute", left: 18, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-chevron-left" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
          <img src={lbPhoto.dataUrl} alt={lbPhoto.name} onClick={e => e.stopPropagation()} style={{ maxWidth: "85vw", maxHeight: "88vh", borderRadius: 10, objectFit: "contain" }} />
          <button onClick={e => { e.stopPropagation(); setLightbox(i => Math.min(photos.length - 1, i + 1)); }} style={{ position: "absolute", right: 18, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-chevron-right" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
          <div style={{ position: "absolute", bottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{lightbox + 1} / {photos.length}</span>
            <button onClick={e => toggleFavorite(e, lbPhoto.id)} style={{ background: favorites.includes(lbPhoto.id) ? "rgba(224,92,92,0.9)" : "rgba(255,255,255,0.15)", border: "none", borderRadius: 20, padding: "7px 16px", cursor: "pointer", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif" }}>
              <i className="ti ti-heart" style={{ fontSize: 15 }} aria-hidden="true" />
              {favorites.includes(lbPhoto.id) ? "Favourited" : "Mark Favourite"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
