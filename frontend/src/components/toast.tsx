"use client";
import { X } from "lucide-react";

export function Toast({
    message,
    type = "success",
    onClose,
}: {
    message: string;
    type?: "success" | "error";
    onClose: () => void;
}) {
    return (
        <div
            className={`fixed bottom-4 right-4 z-[100] flex max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg ${type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}
        >
            <span className="text-sm">{message}</span>
            <button onClick={onClose} aria-label="Tutup">
                <X size={16} />
            </button>
        </div>
    );
}
