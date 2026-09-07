"use client";
import { X } from "lucide-react";

export function Modal({
    open,
    title,
    children,
    onClose,
}: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={onClose}
        >
            <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <h2 className="font-semibold">{title}</h2>
                    <button
                        className="rounded-lg p-1.5 hover:bg-slate-100"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}
