"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, GitBranch, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { MainCoreNode } from "@/lib/types";
import { Toast } from "@/components/toast";

type Option = { id: string; namaTitik: string; tipeTitik: string };
export default function TracePage() {
    const [options, setOptions] = useState<Option[]>([]);
    const [category, setCategory] = useState("");
    const [search, setSearch] = useState("");
    const [nodeId, setNodeId] = useState("");
    const [result, setResult] = useState<{
        selectedNode: MainCoreNode;
        paths: MainCoreNode[][];
        traceNodeCount: number;
    } | null>(null);
    const [toast, setToast] = useState<{
        message: string;
        type: "error";
    } | null>(null);
    useEffect(() => {
        api<{ data: Option[] }>("/main-core/options")
            .then((r) => setOptions(r.data))
            .catch((e) => setToast({ message: e.message, type: "error" }));
    }, []);
    const filtered = useMemo(
        () =>
            options.filter(
                (n) =>
                    n.tipeTitik === category &&
                    n.namaTitik.toLowerCase().includes(search.toLowerCase()),
            ),
        [options, category, search],
    );
    async function submit(e: FormEvent) {
        e.preventDefault();
        if (!nodeId) {
            setToast({
                message: "Pilih nama dari daftar yang tersedia.",
                type: "error",
            });
            return;
        }
        try {
            setResult(
                await api(
                    `/main-core/trace?category=${category}&nodeId=${nodeId}`,
                ),
            );
        } catch (e) {
            setToast({
                message: e instanceof Error ? e.message : "Trace gagal.",
                type: "error",
            });
        }
    }
    return (
        <div className="space-y-5">
            <form onSubmit={submit} className="card p-5">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold">
                        Telusuri Jalur Fiber
                    </h2>
                    <p className="text-sm text-slate-500">
                        Pilih titik untuk melihat jalur dari server sampai
                        seluruh cabang di bawahnya.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-[200px_1fr_auto]">
                    <div>
                        <label className="label">Kategori</label>
                        <select
                            className="input"
                            required
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value);
                                setSearch("");
                                setNodeId("");
                            }}
                        >
                            <option value="">Pilih kategori</option>
                            {["server", "rasio", "odc", "odp"].map((v) => (
                                <option key={v} value={v}>
                                    {v.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Nama Titik</label>
                        <div className="relative">
                            <Search
                                className="absolute left-3 top-3 text-slate-400"
                                size={18}
                            />
                            <input
                                className="input pl-10"
                                disabled={!category}
                                list="trace-options"
                                placeholder={
                                    category
                                        ? "Cari atau pilih nama..."
                                        : "Pilih kategori terlebih dahulu"
                                }
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    const found = options.find(
                                        (n) =>
                                            n.tipeTitik === category &&
                                            n.namaTitik === e.target.value,
                                    );
                                    setNodeId(found?.id ?? "");
                                }}
                            />
                            <datalist id="trace-options">
                                {filtered.map((n) => (
                                    <option key={n.id} value={n.namaTitik} />
                                ))}
                            </datalist>
                        </div>
                    </div>
                    <button className="btn-primary self-end">
                        <GitBranch size={18} />
                        Trace Jalur
                    </button>
                </div>
            </form>
            {result && (
                <div className="card p-5">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Hasil Trace: {result.selectedNode.namaTitik}
                            </h2>
                            <p className="text-sm text-slate-500">
                                {result.paths.length} jalur,{" "}
                                {result.traceNodeCount} titik unik
                            </p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {result.paths.map((path, index) => (
                            <div
                                key={index}
                                className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-3"
                            >
                                {path.map((node, i) => (
                                    <span key={node.id} className="contents">
                                        <span
                                            className={`rounded-lg border px-3 py-2 text-sm ${node.id === result.selectedNode.id ? "border-blue-600 bg-blue-50 font-semibold text-blue-700" : "bg-white"}`}
                                        >
                                            <small className="mr-2 text-slate-400">
                                                {node.tipeTitik.toUpperCase()}
                                            </small>
                                            {node.namaTitik}
                                            {node.parentPortOut && (
                                                <small className="ml-2 text-slate-400">
                                                    Port {node.parentPortOut}
                                                </small>
                                            )}
                                        </span>
                                        {i < path.length - 1 && (
                                            <ArrowRight
                                                size={17}
                                                className="text-slate-400"
                                            />
                                        )}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        </div>
    );
}
