"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PageMeta, PppoePackage } from "@/lib/types";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { Toast } from "@/components/toast";
const empty = {
    name: "",
    downloadMbps: "",
    uploadMbps: "",
    price: "",
    addressPool: "",
};
export default function PackagesPage() {
    const [items, setItems] = useState<PppoePackage[]>([]);
    const [meta, setMeta] = useState<PageMeta>({
        currentPage: 1,
        lastPage: 1,
        perPage: 5,
        total: 0,
    });
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<PppoePackage | null>(null);
    const [form, setForm] = useState(empty);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);
    const load = useCallback(
        () =>
            api<{ data: PppoePackage[]; meta: PageMeta }>(
                `/pppoe/packages?search=${encodeURIComponent(search)}&page=${page}`,
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
    function show(item?: PppoePackage) {
        setEditing(item ?? null);
        setForm(
            item
                ? {
                      name: item.name,
                      downloadMbps: String(item.downloadMbps),
                      uploadMbps: String(item.uploadMbps),
                      price: String(item.price),
                      addressPool: item.addressPool ?? "",
                  }
                : empty,
        );
        setOpen(true);
    }
    async function save(e: FormEvent) {
        e.preventDefault();
        try {
            const body = {
                name: form.name,
                downloadMbps: Number(form.downloadMbps),
                uploadMbps: Number(form.uploadMbps),
                price: Number(form.price),
                addressPool: form.addressPool || undefined,
            };
            const r = await api<{ message: string }>(
                editing ? `/pppoe/packages/${editing.id}` : "/pppoe/packages",
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
    async function action(item: PppoePackage, kind: "toggle" | "delete") {
        if (kind === "delete" && !confirm(`Hapus paket ${item.name}?`)) return;
        try {
            const r = await api<{ message: string }>(
                `/pppoe/packages/${item.id}${kind === "toggle" ? "/status" : ""}`,
                { method: kind === "toggle" ? "PATCH" : "DELETE" },
            );
            setToast({ message: r.message, type: "success" });
            load();
        } catch (e) {
            setToast({
                message: e instanceof Error ? e.message : "Aksi gagal.",
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
                        placeholder="Cari nama paket..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <button className="btn-primary" onClick={() => show()}>
                    <Plus size={18} />
                    Tambah Paket
                </button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Nama Paket & Harga</th>
                            <th>Kecepatan</th>
                            <th>Address Pool</th>
                            <th>Akun</th>
                            <th>Status</th>
                            <th className="text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <p className="font-semibold text-slate-900">
                                        {item.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Rp {item.price.toLocaleString("id-ID")}
                                    </p>
                                </td>
                                <td>
                                    {item.downloadMbps}M ↓ / {item.uploadMbps}M
                                    ↑
                                </td>
                                <td>{item.addressPool ?? "—"}</td>
                                <td>{item.accountsCount ?? 0}</td>
                                <td>
                                    <button
                                        onClick={() => action(item, "toggle")}
                                        className={`relative h-6 w-11 rounded-full ${item.isActive ? "bg-green-500" : "bg-slate-300"}`}
                                        title="Ubah status"
                                    >
                                        <span
                                            className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${item.isActive ? "left-6" : "left-1"}`}
                                        />
                                    </button>
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
                                            onClick={() =>
                                                action(item, "delete")
                                            }
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
                                    Paket PPPoE belum tersedia.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination meta={meta} onPage={setPage} />
            <Modal
                open={open}
                title={`${editing ? "Edit" : "Tambah"} Paket PPPoE`}
                onClose={() => setOpen(false)}
            >
                <form className="space-y-4" onSubmit={save}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Nama Paket *</label>
                            <input
                                className="input"
                                required
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="label">Harga *</label>
                            <input
                                className="input"
                                type="number"
                                min="0"
                                required
                                value={form.price}
                                onChange={(e) =>
                                    setForm({ ...form, price: e.target.value })
                                }
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Download (Mbps) *</label>
                            <input
                                className="input"
                                type="number"
                                min="1"
                                required
                                value={form.downloadMbps}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        downloadMbps: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <div>
                            <label className="label">Upload (Mbps) *</label>
                            <input
                                className="input"
                                type="number"
                                min="1"
                                required
                                value={form.uploadMbps}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        uploadMbps: e.target.value,
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div>
                        <label className="label">Address Pool MikroTik</label>
                        <input
                            className="input"
                            placeholder="Harus sama persis dengan nama pool di CHR1"
                            value={form.addressPool}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    addressPool: e.target.value,
                                })
                            }
                        />
                    </div>
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
