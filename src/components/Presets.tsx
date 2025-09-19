"use client";
export function PresetBar<T>({
  name,
  value,
  onLoad,
}: {
  name: string;
  value: T;
  onLoad: (v: T) => void;
}) {
  const key = `presets:${name}`;
  function save() {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    const item = { ts: Date.now(), value };
    localStorage.setItem(key, JSON.stringify([item, ...arr].slice(0, 10)));
    alert("Preset saved");
  }
  function list(): { ts: number; value: T }[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  const presets = list();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={save}
        className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/5"
      >
        Save preset
      </button>
      {presets.map((p) => (
        <button
          key={p.ts}
          type="button"
          onClick={() => onLoad(p.value)}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/5"
          title={new Date(p.ts).toLocaleString()}
        >
          {new Date(p.ts).toLocaleDateString()}{" "}
          {new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </button>
      ))}
    </div>
  );
}
