"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PageMeta, PppoeAccount, PppoePackage } from "@/lib/types";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { Toast } from "@/components/toast";
const empty = {
    pppoePackageId: "",
    customerName: "",
    username: "",
    password: "",
    phone: "",
    address: "",
    expiresAt: "",
    isActive: true,
    notes: "",
};
export default function AccountsPage() {
    const [items, setItems] = useState<PppoeAccount[]>([]);
    const [packages, setPackages] = useState<PppoePackage[]>([]);
    const [meta, setMeta] = useState<PageMeta>({
        currentPage: 1,
        lastPage: 1,
        perPage: 5,
        total: 0,
    });
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<PppoeAccount | null>(null);
    const [form, setForm] = useState(empty);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);
    const load = useCallback(
        () =>
            api<{ data: PppoeAccount[]; meta: PageMeta }>(
                `/pppoe/accounts?search=${encodeURIComponent(search)}&page=${page}`,
            )
                .then((r) => {
                    setItems(r.data);
                    setMeta(r.meta);
                })
                .catch((e) => setToast({ message: e.message, type: "error" })),
        [search, page],
    );
    useEffect(() => {
        load();
    }, [load]);
    useEffect(() => {
        api<{ data: PppoePackage[] }>("/pppoe/packages/options")
            .then((r) => setPackages(r.data))
            .catch(() => {});
    }, []);
    function show(item?: PppoeAccount) {
        setEditing(item ?? null);
        setForm(
            item
                ? {
                      pppoePackageId: item.pppoePackageId,
                      customerName: item.customerName,
                      username: item.username,
                      password: "",
                      phone: item.phone ?? "",
                      address: item.address ?? "",
                      expiresAt: item.expiresAt?.slice(0, 10) ?? "",
                      isActive: item.isActive,
                      notes: item.notes ?? "",
                  }
                : empty,
        );
        setOpen(true);
    }
    async function save(e: FormEvent) {
        e.preventDefault();
        try {
            const body = {
                ...form,
                password: form.password || undefined,
                expiresAt: form.expiresAt || undefined,
            };
            const r = await api<{ message: string }>(
                editing ? `/pppoe/accounts/${editing.id}` : "/pppoe/accounts",
                {
                    method: editing ? "PATCH" : "POST",
                    body: JSON.stringify(body),
                },
            );
            setOpen(false);
            setToast({ message: r.message, type: "success" });
            load();
        } catch (e) {
            setToast({
                message: e instanceof Error ? e.message : "Gagal menyimpan.",
                type: "error",
            });
        }
    }
    async function remove(item: PppoeAccount) {
        if (!confirm(`Hapus akun ${item.username}?`)) return;
        try {
            const r = await api<{ message: string }>(
                `/pppoe/accounts/${item.id}`,
                { method: "DELETE" },
            );
            setToast({ message: r.message, type: "success" });
            load();
        } catch (e) {
            setToast({
                message: e instanceof Error ? e.message : "Gagal menghapus.",
                type: "error",
            });
        }
    }
    return (
        <div className="space-y-4">
            <div className="card flex gap-3 p-4">
                <div className="relative flex-1">
                    <Search
                        className="absolute left-3 top-3 text-slate-400"
                        size={18}
                    />
                    <input
                        className="input pl-10"
                        placeholder="Cari pelanggan atau username..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <button className="btn-primary" onClick={() => show()}>
                    <Plus size={18} />
                    Tambah Akun
                </button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Pelanggan</th>
                            <th>Username</th>
                            <th>Paket</th>
                            <th>Nomor Telepon</th>
                            <th>Status</th>
                            <th className="text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <p className="font-medium text-slate-900">
                                        {item.customerName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {item.address ?? "—"}
                                    </p>
                                </td>
                                <td className="font-mono">{item.username}</td>
                                <td>{item.package.name}</td>
                                <td>{item.phone ?? "—"}</td>
                                <td>
                                    <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}
                                    >
                                        {item.isActive ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            className="btn-secondary px-3"
                                            onClick={() => show(item)}
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            className="btn-danger"
                                            onClick={() => remove(item)}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!items.length && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="py-8 text-center text-slate-400"
                                >
                                    Akun PPPoE belum tersedia.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination meta={meta} onPage={setPage} />
            <Modal
                open={open}
                title={`${editing ? "Edit" : "Tambah"} Akun PPPoE`}
                onClose={() => setOpen(false)}
            >
                <form onSubmit={save} className="space-y-4">
                    <div>
                        <label className="label">Paket *</label>
                        <select
                            className="input"
                            required
                            value={form.pppoePackageId}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    pppoePackageId: e.target.value,
                                })
                            }
                        >
                            <option value="">Pilih paket</option>
                            {packages.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} — {p.downloadMbps}/{p.uploadMbps}{" "}
                                    Mbps
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Nama Pelanggan *</label>
                        <input
                            className="input"
                            required
                            value={form.customerName}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    customerName: e.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Username *</label>
                            <input
                                className="input"
                                required
                                value={form.username}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        username: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <div>
                            <label className="label">
                                Password{" "}
                                {editing && (
                                    <small className="text-slate-400">
                                        (kosongkan jika tetap)
                                    </small>
                                )}
                            </label>
                            <input
                                type="password"
                                className="input"
                                required={!editing}
                                minLength={6}
                                value={form.password}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        password: e.target.value,
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div>
                        <label className="label">Nomor Telepon</label>
                        <input
                            className="input"
                            value={form.phone}
                            onChange={(e) =>
                                setForm({ ...form, phone: e.target.value })
                            }
                        />
                    </div>
                    <div>
                        <label className="label">Alamat</label>
                        <textarea
                            className="input"
                            rows={2}
                            value={form.address}
                            onChange={(e) =>
                                setForm({ ...form, address: e.target.value })
                            }
                        />
                    </div>
                    {editing && (
                        <label className="flex items-center gap-3 rounded-lg border p-3">
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        isActive: e.target.checked,
                                    })
                                }
                            />
                            <span>
                                <b className="block text-sm">Akun aktif</b>
                                <small className="text-slate-500">
                                    Akun aktif disinkronkan ke FreeRADIUS.
                                </small>
                            </span>
                        </label>
                    )}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setOpen(false)}
                        >
                            Batal
                        </button>
                        <button className="btn-primary">Simpan</button>
                    </div>
                </form>
            </Modal>
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        </div>
    );
}
