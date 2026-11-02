const citySearch = document.getElementById("citySearch");
const findCityBtn = document.getElementById("findCityBtn");
const citySelect = document.getElementById("city");
const searchBtn = document.getElementById("searchBtn");
const statusText = document.getElementById("status");

let aqiChart = null;
let refreshTimer = null;

function showValue(value, digits = 1) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "--";
    }

    return value.toFixed(digits);
}

function getAqiStatus(aqi) {
    if (typeof aqi !== "number" || !Number.isFinite(aqi)) {
        return "AQI unavailable";
    }

    if (aqi <= 50) return "🟢 Good";
    if (aqi <= 100) return "🟡 Moderate";
    if (aqi <= 150) return "🟠 Unhealthy for Sensitive Groups";
    if (aqi <= 200) return "🔴 Unhealthy";
    if (aqi <= 300) return "🟣 Very Unhealthy";

    return "⚫ Hazardous";
}

function getAqiClass(aqi) {
    if (typeof aqi !== "number" || !Number.isFinite(aqi)) {
        return "";
    }

    if (aqi <= 50) return "aqi-good";
    if (aqi <= 100) return "aqi-moderate";
    if (aqi <= 150) return "aqi-sensitive";
    if (aqi <= 200) return "aqi-unhealthy";
    if (aqi <= 300) return "aqi-very-unhealthy";

    return "aqi-hazardous";
}

function getAdvisory(aqi) {
    if (typeof aqi !== "number" || !Number.isFinite(aqi)) {
        return "AQI data is unavailable. Please try again later.";
    }

    if (aqi <= 50) {
        return "🟢 GOOD: Air quality is satisfactory. Normal outdoor activities are generally fine.";
    }

    if (aqi <= 100) {
        return "🟡 MODERATE: Air quality is acceptable for most people. Sensitive individuals should monitor symptoms.";
    }

    if (aqi <= 150) {
        return "🟠 CAUTION: Children, older adults and people with heart or lung conditions should consider reducing prolonged outdoor exertion.";
    }

    if (aqi <= 200) {
        return "🔴 UNHEALTHY: Consider reducing prolonged outdoor activity. Sensitive groups should take extra care.";
    }

    if (aqi <= 300) {
        return "🟣 VERY UNHEALTHY: Avoid prolonged outdoor exertion and follow local public-health guidance.";
    }

    return "⚫ HAZARDOUS: Pollution levels are very high. Minimize outdoor exposure and follow official health advice.";
}

async function findLocations() {
    const query = citySearch.value.trim();

    if (query.length < 2) {
        statusText.textContent = "Please enter at least 2 characters.";
        return;
    }

    findCityBtn.disabled = true;
    statusText.textContent = "🌍 Searching worldwide locations...";

    try {
        const response = await fetch(
            `/api/search?city=${encodeURIComponent(query)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Location search failed.");
        }

        citySelect.replaceChildren();

        if (!data.results || data.results.length === 0) {
            citySelect.add(new Option("No locations found", ""));
            statusText.textContent = "No locations found. Try another city.";
            return;
        }

        data.results.forEach(place => {
            const parts = [
                place.name,
                place.admin1,
                place.country
            ].filter(Boolean);

            const label = [...new Set(parts)].join(", ");

            const option = new Option(label, JSON.stringify({
                name: label,
                latitude: place.latitude,
                longitude: place.longitude
            }));

            citySelect.add(option);
        });

        statusText.textContent =
            `${data.results.length} locations found. Select one below.`;

    } catch (error) {
        statusText.textContent = error.message;
    } finally {
        findCityBtn.disabled = false;
    }
}

function drawChart(chartData) {
    const canvas = document.getElementById("aqiChart");

    if (aqiChart) {
        aqiChart.destroy();
    }

    const times = chartData.time || [];
    const values = chartData.us_aqi || [];
    const labels = times.map(time => time.slice(11, 16));

    aqiChart = new Chart(canvas, {
        type: "line",

        data: {
            labels: labels,
            datasets: [{
                label: "US AQI",
                data: values,
                borderWidth: 3,
                tension: 0.3,
                spanGaps: true,
                fill: false
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: true
                }
            },

            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "US AQI"
                    }
                },

                x: {
                    title: {
                        display: true,
                        text: "Time"
                    }
                }
            }
        }
    });
}

async function loadAirQuality() {
    if (!citySelect.value) {
        statusText.textContent = "Search for and select a location first.";
        return;
    }

    let place;

    try {
        place = JSON.parse(citySelect.value);
    } catch {
        statusText.textContent = "Please select a valid location.";
        return;
    }

    searchBtn.disabled = true;
    statusText.textContent = "⏳ Loading air-quality data...";

    try {
        const params = new URLSearchParams({
            city: place.name,
            latitude: place.latitude,
            longitude: place.longitude
        });

        const response = await fetch(
            `/api/air-quality?${params.toString()}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to load data.");
        }

        const aqiCard = document.querySelector(".aqi-card");

        document.getElementById("aqi").textContent =
            showValue(data.us_aqi, 0);

        document.getElementById("aqiStatus").textContent =
            getAqiStatus(data.us_aqi);

        aqiCard.classList.remove(
            "aqi-good",
            "aqi-moderate",
            "aqi-sensitive",
            "aqi-unhealthy",
            "aqi-very-unhealthy",
            "aqi-hazardous"
        );

        const aqiClass = getAqiClass(data.us_aqi);

        if (aqiClass) {
            aqiCard.classList.add(aqiClass);
        }

        document.getElementById("pm25").textContent =
            showValue(data.pm2_5);

        document.getElementById("pm10").textContent =
            showValue(data.pm10);

        document.getElementById("advisory").textContent =
            getAdvisory(data.us_aqi);

        document.getElementById("updated").textContent =
            `Data time: ${data.time} | Location: ${data.city}`;

        drawChart(data.chart);

        statusText.textContent =
            "✅ Data loaded. Values are model-based estimates.";

    } catch (error) {
        statusText.textContent = error.message;

        document.getElementById("aqiStatus").textContent =
            "Unable to load data";
    } finally {
        searchBtn.disabled = false;
    }
}

findCityBtn.addEventListener("click", findLocations);

citySearch.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        findLocations();
    }
});

searchBtn.addEventListener("click", loadAirQuality);

citySelect.addEventListener("change", () => {
    if (citySelect.value) {
        loadAirQuality();
    }
});

// Refresh the selected city's data every 15 minutes.
function startAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }

    refreshTimer = setInterval(() => {
        if (citySelect.value) {
            loadAirQuality();
        }
    }, 15 * 60 * 1000);
}

startAutoRefresh();