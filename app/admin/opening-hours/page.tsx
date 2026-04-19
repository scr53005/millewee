'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvailabilityToggle } from '@/components/admin/AvailabilityToggle';
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  type Service,
} from '@/hooks/use-services';
import {
  useStandardWeek,
  useSaveStandardWeek,
  useRegenerateSchedule,
  type StandardWeekRow,
} from '@/hooks/use-standard-week';
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu', fri: 'Ven', sat: 'Sam', sun: 'Dim',
};

type ServiceForm = { name_fr: string; name_en: string; name_lb: string };
const emptyServiceForm: ServiceForm = { name_fr: '', name_en: '', name_lb: '' };

interface DayCell {
  open: string;
  close: string;
  enabled: boolean;
}

const emptyCell: DayCell = { open: '', close: '', enabled: false };

function parseInterval(interval: string | null): DayCell {
  if (!interval) return emptyCell;
  const [open, close] = interval.split('-');
  return { open, close, enabled: true };
}

function cellToInterval(cell: DayCell): string | null {
  if (!cell.enabled || !cell.open || !cell.close) return null;
  if (cell.open >= cell.close) return null;
  return `${cell.open}-${cell.close}`;
}

// ─── Services tab ───────────────────────────────────────────────

function ServicesTab() {
  const { data: services = [], isLoading } = useServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyServiceForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyServiceForm);
    setDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditingId(s.id);
    setForm({ name_fr: s.name_fr, name_en: s.name_en, name_lb: s.name_lb });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateService.mutateAsync({ id: editingId, ...form });
        toast.success('Service mis à jour');
      } else {
        await createService.mutateAsync({ ...form, sort_order: services.length, is_active: true });
        toast.success('Service créé');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (s: Service) => {
    if (!confirm(`Désactiver le service "${s.name_fr}" ?`)) return;
    try {
      await deleteService.mutateAsync(s.id);
      toast.success('Service désactivé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleToggleActive = async (s: Service) => {
    try {
      await updateService.mutateAsync({ id: s.id, is_active: !s.is_active });
    } catch {
      toast.error('Erreur de mise à jour');
    }
  };

  const move = async (s: Service, direction: -1 | 1) => {
    const sorted = [...services].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    try {
      await Promise.all([
        updateService.mutateAsync({ id: s.id, sort_order: other.sort_order }),
        updateService.mutateAsync({ id: other.id, sort_order: s.sort_order }),
      ]);
    } catch {
      toast.error('Erreur de réordonnancement');
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} size="sm" className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]">
          <Plus className="h-4 w-4 mr-1" /> Nouveau service
        </Button>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-center py-8">Chargement...</p>
      ) : services.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Aucun service défini</p>
      ) : (
        <div className="divide-y border rounded-md bg-white">
          {services.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex flex-col">
                <button
                  className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                  onClick={() => move(s, -1)}
                  disabled={i === 0}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                  onClick={() => move(s, 1)}
                  disabled={i === services.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{s.name_fr}</div>
                <div className="text-xs text-gray-500">
                  EN: {s.name_en} · LB: {s.name_lb}
                </div>
              </div>
              <AvailabilityToggle isAvailable={s.is_active} onToggle={() => handleToggleActive(s)} />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-700"
                onClick={() => handleDelete(s)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingId ? 'Modifier le service' : 'Nouveau service'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-gray-700">Nom (FR) <span className="text-red-500">*</span></Label>
              <Input
                value={form.name_fr}
                onChange={(e) => setForm((f) => ({ ...f, name_fr: e.target.value }))}
                required
                className="bg-white text-gray-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700">Nom (EN) <span className="text-red-500">*</span></Label>
              <Input
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                required
                className="bg-white text-gray-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700">Nom (LB) <span className="text-red-500">*</span></Label>
              <Input
                value={form.name_lb}
                onChange={(e) => setForm((f) => ({ ...f, name_lb: e.target.value }))}
                required
                className="bg-white text-gray-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]"
                disabled={createService.isPending || updateService.isPending}
              >
                {editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Horaires tab ───────────────────────────────────────────────

function HorairesTab() {
  const { data, isLoading } = useStandardWeek();
  const rows = data ?? [];
  const saveWeek = useSaveStandardWeek();
  const regenerate = useRegenerateSchedule();

  const [drafts, setDrafts] = useState<Record<number, Record<DayKey, DayCell>>>({});
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [backups, setBackups] = useState<Record<number, Record<DayKey, DayCell>>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<number, Record<DayKey, DayCell>> = {};
    for (const r of data) {
      next[r.service_id] = {
        mon: parseInterval(r.mon),
        tue: parseInterval(r.tue),
        wed: parseInterval(r.wed),
        thu: parseInterval(r.thu),
        fri: parseInterval(r.fri),
        sat: parseInterval(r.sat),
        sun: parseInterval(r.sun),
      };
    }
    setDrafts(next);
    setDirty(new Set());
    setCollapsed(new Set());
    setBackups({});
  }, [data]);

  const markDirty = (serviceId: number) => {
    setDirty((s) => new Set(s).add(serviceId));
  };

  const updateCell = (serviceId: number, day: DayKey, patch: Partial<DayCell>) => {
    setDrafts((d) => ({
      ...d,
      [serviceId]: { ...d[serviceId], [day]: { ...d[serviceId][day], ...patch } },
    }));
    markDirty(serviceId);
  };

  const applyMonToWeekdays = (serviceId: number) => {
    const mon = drafts[serviceId]?.mon;
    if (!mon) return;
    setDrafts((d) => ({
      ...d,
      [serviceId]: {
        ...d[serviceId],
        tue: { ...mon },
        wed: { ...mon },
        thu: { ...mon },
        fri: { ...mon },
      },
    }));
    markDirty(serviceId);
  };

  const closeAll = (serviceId: number) => {
    setBackups((b) => ({ ...b, [serviceId]: drafts[serviceId] }));
    setDrafts((d) => ({
      ...d,
      [serviceId]: DAY_KEYS.reduce(
        (acc, k) => ({ ...acc, [k]: { ...emptyCell } }),
        {} as Record<DayKey, DayCell>,
      ),
    }));
    setCollapsed((s) => new Set(s).add(serviceId));
    markDirty(serviceId);
  };

  const uncollapse = (serviceId: number) => {
    const backup = backups[serviceId];
    if (backup) {
      setDrafts((d) => ({ ...d, [serviceId]: backup }));
      setBackups((b) => {
        const { [serviceId]: _discard, ...rest } = b;
        return rest;
      });
    }
    setCollapsed((s) => {
      const next = new Set(s);
      next.delete(serviceId);
      return next;
    });
    setDirty((s) => {
      const next = new Set(s);
      next.delete(serviceId);
      return next;
    });
  };

  const handleSave = async () => {
    const dirtyIds = [...dirty];
    if (dirtyIds.length === 0) {
      toast.info('Aucun changement');
      return;
    }
    try {
      for (const id of dirtyIds) {
        const cells = drafts[id];
        await saveWeek.mutateAsync({
          service_id: id,
          mon: cellToInterval(cells.mon),
          tue: cellToInterval(cells.tue),
          wed: cellToInterval(cells.wed),
          thu: cellToInterval(cells.thu),
          fri: cellToInterval(cells.fri),
          sat: cellToInterval(cells.sat),
          sun: cellToInterval(cells.sun),
        });
      }
      setDirty(new Set());
      toast.success(`Enregistré (${dirtyIds.length} service${dirtyIds.length > 1 ? 's' : ''})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleRegenerate = async () => {
    try {
      const res = await regenerate.mutateAsync(4);
      toast.success(`Calendrier régénéré (${res.generated} jours)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const hasDirty = dirty.size > 0;

  if (isLoading) return <p className="text-gray-500 text-center py-8">Chargement...</p>;
  if (rows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-2">Aucun service actif.</p>
        <p className="text-sm text-gray-400">Ajoutez un service dans l&apos;onglet &laquo;&nbsp;Services&nbsp;&raquo;.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto border rounded-md bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700 w-40">Service</th>
              {DAY_KEYS.map((k) => (
                <th key={k} className="px-2 py-2 text-center font-medium text-gray-700">
                  {DAY_LABELS[k]}
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const draft = drafts[r.service_id];
              if (!draft) return null;
              const isCollapsed = collapsed.has(r.service_id);
              if (isCollapsed) {
                return (
                  <tr key={r.service_id} className="bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-500 italic">{r.service_name_fr}</td>
                    <td colSpan={7} className="px-3 py-2 text-xs text-gray-500 italic">
                      Fermé toute la semaine (non enregistré)
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => uncollapse(r.service_id)}
                        title="Annuler et restaurer"
                      >
                        ↩
                      </Button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={r.service_id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.service_name_fr}</td>
                  {DAY_KEYS.map((k) => {
                    const cell = draft[k];
                    return (
                      <td key={k} className="px-1 py-2 align-top">
                        <div className="flex flex-col items-center gap-1">
                          <label className="flex items-center gap-1 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={cell.enabled}
                              onChange={(e) =>
                                updateCell(r.service_id, k, {
                                  enabled: e.target.checked,
                                  open: cell.open || '11:30',
                                  close: cell.close || '14:30',
                                })
                              }
                            />
                            Ouv.
                          </label>
                          {cell.enabled && (
                            <>
                              <input
                                type="time"
                                value={cell.open}
                                onChange={(e) => updateCell(r.service_id, k, { open: e.target.value })}
                                className="w-24 text-xs border border-gray-300 rounded px-1 py-0.5 text-gray-900 bg-white"
                              />
                              <input
                                type="time"
                                value={cell.close}
                                onChange={(e) => updateCell(r.service_id, k, { close: e.target.value })}
                                className="w-24 text-xs border border-gray-300 rounded px-1 py-0.5 text-gray-900 bg-white"
                              />
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => applyMonToWeekdays(r.service_id)}
                      >
                        Lun→Ven
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => closeAll(r.service_id)}
                      >
                        Tout fermer
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end items-center gap-2 mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleRegenerate}
          disabled={regenerate.isPending}
        >
          <RotateCw className="h-4 w-4 mr-1" /> Régénérer 4 semaines
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasDirty || saveWeek.isPending}
          className="bg-[#d4a24e] text-[#1a1310] hover:bg-[#c4922e]"
        >
          Enregistrer {hasDirty && `(${dirty.size})`}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function OpeningHoursPage() {
  const [tab, setTab] = useState<'horaires' | 'services'>('horaires');

  return (
    <div>
      <AdminHeader />
      <div className="max-w-5xl mx-auto p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'horaires' | 'services')}>
          <TabsList className="mb-4">
            <TabsTrigger value="horaires">Horaires</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
          </TabsList>
          <TabsContent value="horaires">
            <HorairesTab />
          </TabsContent>
          <TabsContent value="services">
            <ServicesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
