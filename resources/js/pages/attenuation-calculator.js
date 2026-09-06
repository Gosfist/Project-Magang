const asymmetricRatios = {
    '70:30': [70, 30],
    '80:20': [80, 20],
    '90:10': [90, 10],
};
const safetyMarginDb = 1;

function numericValue(input) {
    const value = Number(input?.value);
    return input?.value !== '' && Number.isFinite(value) ? value : null;
}

function splitterLoss(splitter, percentage) {
    if (asymmetricRatios[splitter]) {
        return -10 * Math.log10(percentage / 100);
    }

    const outputCount = Number(splitter.replace('1:', ''));
    return 10 * Math.log10(outputCount);
}

function setResult(element, value, digits = 2) {
    element.textContent = Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '-';
}

export function bootAttenuationCalculator() {
    const calculator = document.querySelector('[data-attenuation-calculator]');
    if (!calculator || calculator.dataset.calculatorReady === 'true') return;
    calculator.dataset.calculatorReady = 'true';

    const sourceInput = calculator.querySelector('[data-source-redaman]');
    const distanceInput = calculator.querySelector('[data-distance]');
    const splitterSelect = calculator.querySelector('[data-splitter]');
    const ratioField = calculator.querySelector('[data-ratio-field]');
    const ratioSelect = calculator.querySelector('[data-ratio-path]');
    const connectorCountInput = calculator.querySelector('[data-connector-count]');
    const connectorLossInput = calculator.querySelector('[data-connector-loss]');
    const cableLossInput = calculator.querySelector('[data-cable-loss]');

    const syncRatioPaths = () => {
        const percentages = asymmetricRatios[splitterSelect.value];
        ratioField.classList.toggle('hidden', !percentages);
        ratioSelect.disabled = !percentages;
        ratioSelect.innerHTML = '';

        percentages?.forEach((percentage) => {
            ratioSelect.appendChild(new Option(`Jalur ${percentage}%`, percentage));
        });
    };

    const calculate = () => {
        const source = numericValue(sourceInput);
        const distance = numericValue(distanceInput);
        const connectorCount = numericValue(connectorCountInput);
        const connectorLossPerUnit = numericValue(connectorLossInput);
        const cableLossPerKm = numericValue(cableLossInput);
        const percentage = Number(ratioSelect.value || 0);

        const lossSplitter = splitterLoss(splitterSelect.value, percentage);
        const lossCable = distance !== null && cableLossPerKm !== null
            ? (distance / 1000) * cableLossPerKm
            : NaN;
        const lossConnector = connectorCount !== null && connectorLossPerUnit !== null
            ? connectorCount * connectorLossPerUnit
            : NaN;
        const result = source !== null
            ? source - lossSplitter - lossCable - lossConnector - safetyMarginDb
            : NaN;

        setResult(calculator.querySelector('[data-result-splitter]'), lossSplitter);
        setResult(calculator.querySelector('[data-result-cable]'), lossCable, 3);
        setResult(calculator.querySelector('[data-result-connector]'), lossConnector);
        setResult(calculator.querySelector('[data-result-redaman]'), result);
    };

    calculator.addEventListener('input', calculate);
    calculator.addEventListener('change', (event) => {
        if (event.target === splitterSelect) syncRatioPaths();
        calculate();
    });

    syncRatioPaths();
    calculate();
}
