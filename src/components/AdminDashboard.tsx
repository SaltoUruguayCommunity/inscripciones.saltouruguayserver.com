import { useState, useEffect } from "preact/hooks";
import type { CustomField } from "../db/schema";

export interface Event {
  id: number;
  title: string;
  description: string | null;
  coverImage: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  status: string;
  maxParticipants: number | null;
  requireDiscord: boolean;
  customFields: CustomField[] | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  inscriptionCount: number;
}

interface Props {
  events: Event[];
  totalInscriptions: number;
  totalUsers: number;
  user: { username: string; is_admin?: boolean };
}

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto largo" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "select", label: "Selección" },
  { value: "radio", label: "Radio buttons" },
];

export default function AdminDashboard({ events: initialEvents, totalInscriptions: initialTotal, totalUsers, user }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [totalInscriptions] = useState(initialTotal);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [inscriptions, setInscriptions] = useState<Record<number, any[]>>({});
  const [loadingInscriptions, setLoadingInscriptions] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [requireDiscord, setRequireDiscord] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const handleCoverUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const uniqueBase64 = canvas.toDataURL("image/jpeg", 0.92 + Math.random() * 0.08);

        setCoverPreview(uniqueBase64);
        setUploadingImage(true);
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: uniqueBase64 }),
          });
          const data = await res.json();
          if (data.success) {
            setCoverImage(data.url);
            setMessage({ type: "success", text: "Portada subida" });
          } else {
            setMessage({ type: "error", text: data.error || "Error al subir imagen" });
            setCoverPreview("");
          }
        } catch {
          setMessage({ type: "error", text: "Error al subir imagen" });
          setCoverPreview("");
        } finally {
          setUploadingImage(false);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCoverImage("");
    setCoverPreview("");
    setEventDate("");
    setEventLocation("");
    setStatus("upcoming");
    setMaxParticipants("");
    setRequireDiscord(false);
    setCustomFields([]);
    setEditingEvent(null);
    setShowForm(false);
  };

  const startEdit = (event: Event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setCoverImage(event.coverImage || "");
    setCoverPreview(event.coverImage || "");
    setEventDate(event.eventDate || "");
    setEventLocation(event.eventLocation || "");
    setStatus(event.status);
    setMaxParticipants(event.maxParticipants?.toString() || "");
    setRequireDiscord(event.requireDiscord || false);
    setCustomFields(event.customFields || []);
    setShowForm(true);
  };

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      { name: "", label: "", type: "text", required: false, placeholder: "", helpText: "" },
    ]);
  };

  const updateCustomField = (index: number, key: keyof CustomField, value: any) => {
    const updated = [...customFields];
    if (key === "name") {
      value = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    }
    updated[index] = { ...updated[index], [key]: value };
    if (key === "label" && !updated[index].name) {
      updated[index].name = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    }
    setCustomFields(updated);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const validFields = customFields.filter((f) => f.name && f.label);
      const payload = {
        title,
        description: description || null,
        coverImage: coverImage || null,
        eventDate: eventDate || null,
        eventLocation: eventLocation || null,
        status,
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        requireDiscord,
        customFields: validFields.length > 0 ? validFields : null,
      };

      if (editingEvent) {
        const res = await fetch("/api/events/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingEvent.id, ...payload }),
        });
        const data = await res.json();
        if (data.success) {
          setEvents(events.map((e) => (e.id === editingEvent.id ? { ...e, ...payload, inscriptionCount: e.inscriptionCount } : e)));
          setMessage({ type: "success", text: "Evento actualizado correctamente" });
          resetForm();
        } else {
          setMessage({ type: "error", text: data.error || "Error al actualizar" });
        }
      } else {
        const res = await fetch("/api/events/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setEvents([...events, { ...data.event, inscriptionCount: 0 }]);
          setMessage({ type: "success", text: "Evento creado correctamente" });
          resetForm();
        } else {
          setMessage({ type: "error", text: data.error || "Error al crear" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      const res = await fetch("/api/events/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setEvents(events.filter((e) => e.id !== id));
        setMessage({ type: "success", text: "Evento eliminado" });
      }
    } catch {
      setMessage({ type: "error", text: "Error al eliminar" });
    }
  };

  const toggleInscriptions = async (eventId: number) => {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
      return;
    }
    setExpandedEventId(eventId);
    if (inscriptions[eventId]) return;

    setLoadingInscriptions(eventId);
    try {
      const res = await fetch(`/api/inscriptions/list?eventId=${eventId}`);
      const data = await res.json();
      if (data.success) {
        setInscriptions({ ...inscriptions, [eventId]: data.inscriptions });
      }
    } catch {
      setMessage({ type: "error", text: "Error al cargar inscriptos" });
    } finally {
      setLoadingInscriptions(null);
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const inputClass = "w-full px-4 py-2.5 bg-surface-elevated border border-border-subtle rounded-xl text-text-primary text-sm focus:outline-none focus:border-brand-violet transition-colors";
  const labelClass = "block text-text-muted text-xs font-semibold mb-1.5";

  return (
    <div>
      {/* Stats */}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div class="glass-card p-5">
          <p class="text-text-muted text-xs font-semibold uppercase tracking-wide mb-1">Eventos</p>
          <p class="font-[family-name:var(--font-anton)] text-3xl text-text-primary">{events.length}</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-text-muted text-xs font-semibold uppercase tracking-wide mb-1">Inscripciones</p>
          <p class="font-[family-name:var(--font-anton)] text-3xl text-brand-violet-light">{totalInscriptions}</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-text-muted text-xs font-semibold uppercase tracking-wide mb-1">Usuarios</p>
          <p class="font-[family-name:var(--font-anton)] text-3xl text-brand-cyan">{totalUsers}</p>
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div class={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium backdrop-xl border animate-fade-in ${
          message.type === "success"
            ? "bg-brand-emerald/10 border-brand-emerald/25 text-brand-emerald"
            : "bg-brand-rose/10 border-brand-rose/25 text-brand-rose"
        }`}>
          {message.text}
        </div>
      )}

      {/* Actions Bar */}
      <div class="flex items-center justify-between mb-6">
        <h2 class="font-[family-name:var(--font-anton)] text-xl uppercase tracking-wide text-text-primary">Eventos</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} class="btn-primary !text-sm !py-2 !px-4">
          {showForm ? "Cancelar" : "+ Nuevo Evento"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div class="glass-card p-6 mb-8 animate-fade-in-up">
          <h3 class="font-[family-name:var(--font-anton)] text-lg uppercase tracking-wide text-text-primary mb-4">
            {editingEvent ? "Editar Evento" : "Nuevo Evento"}
          </h3>
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label class={labelClass}>Título *</label>
                <input type="text" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} required class={inputClass} placeholder="Nombre del evento" />
              </div>
              <div class="sm:col-span-2">
                <label class={labelClass}>Descripción</label>
                <textarea value={description} onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)} rows={3} class={`${inputClass} resize-none`} placeholder="Descripción del evento..." />
              </div>
              <div>
                <label class={labelClass}>Fecha</label>
                <input type="date" value={eventDate} onInput={(e) => setEventDate((e.target as HTMLInputElement).value)} class={inputClass} />
              </div>
              <div>
                <label class={labelClass}>Ubicación</label>
                <input type="text" value={eventLocation} onInput={(e) => setEventLocation((e.target as HTMLInputElement).value)} class={inputClass} placeholder="Ej: Salto, Uruguay" />
              </div>
              <div class="sm:col-span-2">
                <label class={labelClass}>Portada del evento</label>
                <div class="flex items-start gap-4">
                  <label class="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleCoverUpload} class="hidden" />
                    <div class={`${inputClass} flex items-center justify-center gap-2 border-dashed cursor-pointer hover:border-brand-violet transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingImage ? (
                        <span class="text-text-muted text-sm">Subiendo...</span>
                      ) : coverImage ? (
                        <span class="text-brand-emerald text-sm">Portada cargada ✓</span>
                      ) : (
                        <span class="text-text-muted text-sm">Click para subir portada</span>
                      )}
                    </div>
                  </label>
                  {coverPreview && (
                    <div class="relative w-24 h-24 rounded-lg overflow-hidden border border-border-subtle flex-shrink-0">
                      <img src={coverPreview} alt="Preview" class="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setCoverImage(""); setCoverPreview(""); }} class="absolute top-0.5 right-0.5 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center text-white text-xs hover:bg-black/80 cursor-pointer border-none">×</button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label class={labelClass}>Estado</label>
                <select value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)} class={inputClass}>
                  <option value="upcoming">Próximo</option>
                  <option value="open">Inscripciones Abiertas</option>
                  <option value="ongoing">En Curso</option>
                  <option value="closed">Cerrado</option>
                  <option value="finished">Finalizado</option>
                </select>
              </div>
              <div>
                <label class={labelClass}>Máx. Participantes</label>
                <input type="number" value={maxParticipants} onInput={(e) => setMaxParticipants((e.target as HTMLInputElement).value)} min="1" class={inputClass} placeholder="Sin límite" />
              </div>
              <div class="sm:col-span-2">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={requireDiscord} onChange={(e) => setRequireDiscord((e.target as HTMLInputElement).checked)} class="accent-brand-violet w-4 h-4" />
                  <div>
                    <span class="text-text-primary text-sm font-medium">Requiere Discord vinculado</span>
                    <p class="text-text-muted text-xs mt-0.5">Los participantes deben tener Discord vinculado en saltouruguayserver.com para inscribirse</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Custom Fields Section */}
            <div class="border-t border-border-subtle pt-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <h4 class="text-sm font-semibold text-text-primary">Campos personalizados</h4>
                  <p class="text-text-muted text-xs mt-0.5">Campos adicionales que los participantes deben completar al inscribirse</p>
                </div>
                <button type="button" onClick={addCustomField} class="text-xs text-brand-violet-light hover:text-white transition-colors bg-transparent border border-border-accent rounded-lg px-3 py-1.5 cursor-pointer">
                  + Agregar campo
                </button>
              </div>

              {customFields.length === 0 && (
                <p class="text-text-muted text-xs italic">Sin campos personalizados. Los campos del usuario (nombre, email, Discord) se completan automáticamente.</p>
              )}

              <div class="space-y-3">
                {customFields.map((field, i) => (
                  <div key={i} class="p-3 bg-surface-elevated rounded-xl border border-border-subtle space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-text-muted text-[10px] font-mono uppercase tracking-wider">Campo {i + 1}</span>
                      <button type="button" onClick={() => removeCustomField(i)} class="text-brand-rose/60 hover:text-brand-rose text-xs bg-transparent border-none cursor-pointer">Eliminar</button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label class="text-text-muted text-[10px] font-semibold mb-0.5 block">Etiqueta *</label>
                        <input type="text" value={field.label} onInput={(e) => updateCustomField(i, "label", (e.target as HTMLInputElement).value)} class="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-brand-violet" placeholder="Ej: Usuario de Minecraft" />
                      </div>
                      <div>
                        <label class="text-text-muted text-[10px] font-semibold mb-0.5 block">Nombre (key)</label>
                        <input type="text" value={field.name} onInput={(e) => updateCustomField(i, "name", (e.target as HTMLInputElement).value)} class="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-text-primary text-xs font-mono focus:outline-none focus:border-brand-violet" placeholder="minecraft_username" />
                      </div>
                      <div>
                        <label class="text-text-muted text-[10px] font-semibold mb-0.5 block">Tipo</label>
                        <select value={field.type} onChange={(e) => updateCustomField(i, "type", (e.target as HTMLSelectElement).value)} class="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-brand-violet">
                          {FIELD_TYPES.map((t) => <option value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label class="text-text-muted text-[10px] font-semibold mb-0.5 block">Placeholder</label>
                        <input type="text" value={field.placeholder || ""} onInput={(e) => updateCustomField(i, "placeholder", (e.target as HTMLInputElement).value)} class="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-brand-violet" placeholder="Texto de ejemplo" />
                      </div>
                      <div>
                        <label class="text-text-muted text-[10px] font-semibold mb-0.5 block">Texto de ayuda</label>
                        <input type="text" value={field.helpText || ""} onInput={(e) => updateCustomField(i, "helpText", (e.target as HTMLInputElement).value)} class="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-brand-violet" placeholder="Información adicional" />
                      </div>
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={field.required} onChange={(e) => updateCustomField(i, "required", (e.target as HTMLInputElement).checked)} class="accent-brand-violet" />
                      <span class="text-text-muted text-[10px] font-semibold">Obligatorio</span>
                    </label>
                    {field.type === "select" || field.type === "radio" ? (
                      <div>
                        <label class="text-text-muted text-[10px] font-semibold mb-0.5 block">Opciones (separadas por coma)</label>
                        <input type="text" value={field.options?.join(", ") || ""} onInput={(e) => updateCustomField(i, "options", (e.target as HTMLInputElement).value.split(",").map((s: string) => s.trim()).filter(Boolean))} class="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-brand-violet" placeholder="Opción 1, Opción 2, Opción 3" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div class="flex items-center gap-3 pt-2">
              <button type="submit" disabled={loading} class="btn-primary !text-sm">
                {loading ? "Guardando..." : editingEvent ? "Guardar Cambios" : "Crear Evento"}
              </button>
              <button type="button" onClick={resetForm} class="btn-secondary !text-sm">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div class="glass-card p-12 text-center">
          <p class="text-text-muted text-sm">No hay eventos creados</p>
        </div>
      ) : (
        <div class="space-y-3">
          {events.map((event) => {
            const statusColors: Record<string, string> = {
              upcoming: "text-brand-cyan",
              open: "text-brand-emerald",
              ongoing: "text-brand-amber",
              closed: "text-text-muted",
              finished: "text-text-muted",
            };
            const dateStr = event.eventDate
              ? new Date(event.eventDate).toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })
              : "Sin fecha";

            return (
              <div>
              <div class="glass-card p-4 flex items-center justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-1">
                    <h3 class="font-[family-name:var(--font-anton)] text-sm uppercase tracking-wide text-text-primary truncate">{event.title}</h3>
                    <span class={`text-[10px] font-semibold uppercase tracking-wider ${statusColors[event.status] || "text-text-muted"}`}>
                      {event.status}
                    </span>
                    {event.customFields && event.customFields.length > 0 && (
                      <span class="text-[10px] text-brand-violet-light bg-brand-violet/10 px-2 py-0.5 rounded-full border border-border-accent">
                        {event.customFields.length} campos custom
                      </span>
                    )}
                  </div>
                  <div class="flex items-center gap-4 text-text-muted text-xs">
                    <span>{dateStr}</span>
                    <button onClick={() => toggleInscriptions(event.id)} class="hover:text-brand-violet-light transition-colors cursor-pointer bg-transparent border-none text-text-muted text-xs font-medium">
                      {event.inscriptionCount} inscriptos
                    </button>
                    {event.eventLocation && <span>{event.eventLocation}</span>}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <a href={`/eventos/${event.id}`} class="text-text-muted hover:text-brand-violet-light text-xs transition-colors px-2 py-1" target="_blank">Ver</a>
                  <button onClick={() => startEdit(event)} class="text-text-muted hover:text-brand-cyan text-xs transition-colors px-2 py-1 cursor-pointer bg-transparent border-none">Editar</button>
                  <button onClick={() => handleDelete(event.id)} class="text-text-muted hover:text-brand-rose text-xs transition-colors px-2 py-1 cursor-pointer bg-transparent border-none">Eliminar</button>
                </div>
              </div>

              {expandedEventId === event.id && (
                <div class="border-t border-border-subtle p-4 animate-fade-in">
                  {loadingInscriptions === event.id ? (
                    <p class="text-text-muted text-xs text-center py-4">Cargando inscriptos...</p>
                  ) : !inscriptions[event.id]?.length ? (
                    <p class="text-text-muted text-xs text-center py-4">No hay inscriptos todavía</p>
                  ) : (
                    <div>
                      <p class="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-3">
                        {inscriptions[event.id].length} inscripto{inscriptions[event.id].length !== 1 ? 's' : ''}
                      </p>
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                          <thead>
                            <tr class="border-b border-border-subtle">
                              <th class="text-left py-2 px-3 text-text-muted font-semibold">Nombre</th>
                              <th class="text-left py-2 px-3 text-text-muted font-semibold">Discord</th>
                              <th class="text-left py-2 px-3 text-text-muted font-semibold">Email</th>
                              {event.customFields?.map((f) => (
                                <th class="text-left py-2 px-3 text-text-muted font-semibold">{f.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {inscriptions[event.id].map((ins) => (
                              <tr class="border-b border-border-subtle/50 hover:bg-surface-elevated/50 transition-colors">
                                <td class="py-2.5 px-3">
                                  <div class="flex items-center gap-2">
                                    {ins.avatar ? (
                                      <img src={ins.avatar} alt="" class="w-6 h-6 rounded-full object-cover" />
                                    ) : (
                                      <div class="w-6 h-6 rounded-full bg-brand-violet/20 flex items-center justify-center text-brand-violet-light text-[10px] font-bold">
                                        {ins.displayName?.charAt(0)?.toUpperCase()}
                                      </div>
                                    )}
                                    <span class="text-text-primary font-medium">{ins.displayName}</span>
                                  </div>
                                </td>
                                <td class="py-2.5 px-3 text-text-secondary">{ins.discordUsername || '-'}</td>
                                <td class="py-2.5 px-3 text-text-secondary">{ins.email}</td>
                                {event.customFields?.map((f) => (
                                  <td class="py-2.5 px-3 text-text-secondary">{ins.customData?.[f.name] ?? '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
