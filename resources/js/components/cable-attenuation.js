const cableLossDbPerKm = 0.35; // 1310 nm
const connectorLossDbPerPair = 0.5;
const odcToOdpConnectorPairs = 2;
const safetyMarginDb = 1;

function selectedParent(form) {
    const combobox = form.querySelector("[data-parent-combobox]");
    const parentId = combobox?.querySelector("[data-parent-id]")?.value;
    return Array.from(
        combobox?.querySelectorAll("[data-parent-option]") || [],
    ).find((option) => option.dataset.parentIdValue === parentId);
}

function parentRedaman(parent) {
    if (!parent) return null;

    const value = Number(parent.dataset.parentRedaman || 0);
    return Number.isFinite(value) ? value : 0;
}

function parseRasioPorts(parent) {
    try {
        return JSON.parse(parent?.dataset.parentRasioPorts || "{}");
    } catch {
        return {};
    }
}

function splitterLoss(parent, port) {
    if (!parent || parent.dataset.parentType === "server") return 0;

    if (parent.dataset.parentType === "rasio" && port > 0) {
        const percentage = Number(
            String(parseRasioPorts(parent)[port] ?? "")
                .replace(",", ".")
                .replace("%", ""),
        );

        if (
            Number.isFinite(percentage) &&
            percentage > 0 &&
            percentage <= 100
        ) {
            return -10 * Math.log10(percentage / 100);
        }
    }

    const outputCount =
        Number((parent.dataset.parentSplitter || "").replace("1:", "")) || 0;
    return outputCount > 0 ? 10 * Math.log10(outputCount) : 0;
}

function connectorLoss(form, parent) {
    const isOdcToOdp =
        form.dataset.nodeType === "odp" && parent?.dataset.parentType === "odc";

    return isOdcToOdp ? odcToOdpConnectorPairs * connectorLossDbPerPair : 0;
}

function calculateCableAttenuation(form, force = true) {
    const distanceInput = form.querySelector("[data-cable-distance]");
    const attenuationInput = form.querySelector("[data-attenuation-input]");
    const portSelect = form.querySelector("[data-port-select]");
    if (!distanceInput || !attenuationInput) return;

    const distance = Number(distanceInput.value);
    const parent = selectedParent(form);
    const sourceAttenuation = parentRedaman(parent);

    if (
        distanceInput.value === "" ||
        !Number.isFinite(distance) ||
        distance < 0 ||
        sourceAttenuation === null
    ) {
        if (force) attenuationInput.value = "";
        return;
    }

    if (!force && attenuationInput.value !== "") return;

    const cableLoss = (distance / 1000) * cableLossDbPerKm;
    const sourceSplitterLoss = splitterLoss(
        parent,
        Number(portSelect?.value || 0),
    );
    const sourceConnectorLoss = connectorLoss(form, parent);
    attenuationInput.value = (
        sourceAttenuation -
        sourceSplitterLoss -
        cableLoss -
        sourceConnectorLoss -
        safetyMarginDb
    ).toFixed(2);
}

function initializeCableAttenuation(form) {
    if (form.dataset.cableAttenuationReady === "true") return;
    form.dataset.cableAttenuationReady = "true";

    const distanceInput = form.querySelector("[data-cable-distance]");
    const attenuationInput = form.querySelector("[data-attenuation-input]");
    if (!distanceInput || !attenuationInput) return;

    distanceInput.addEventListener("input", () =>
        calculateCableAttenuation(form),
    );
    form.querySelector("[data-port-select]")?.addEventListener("change", () =>
        calculateCableAttenuation(form),
    );
    form.addEventListener("maincore:parent-changed", () =>
        calculateCableAttenuation(form),
    );
    calculateCableAttenuation(form, false);
}

export function bootCableAttenuation(container = document) {
    container
        .querySelectorAll("[data-maincore-form]")
        .forEach(initializeCableAttenuation);
}
