from flask import Flask, render_template, jsonify, request
import requests

app = Flask(__name__)

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/search")
def search_city():
    city = request.args.get("city", "").strip()

    if len(city) < 2:
        return jsonify({"error": "Please enter a city name."}), 400

    try:
        response = requests.get(
            GEOCODING_URL,
            params={
                "name": city,
                "count": 10,
                "language": "en",
                "format": "json"
            },
            timeout=15
        )
        response.raise_for_status()
        data = response.json()

        results = []

        for place in data.get("results", []):
            results.append({
                "name": place.get("name", ""),
                "country": place.get("country", ""),
                "admin1": place.get("admin1", ""),
                "latitude": place.get("latitude"),
                "longitude": place.get("longitude")
            })

        return jsonify({"results": results})

    except (requests.RequestException, ValueError):
        return jsonify({
            "error": "Location search failed. Please try again."
        }), 502


@app.route("/api/air-quality")
def air_quality():
    city = request.args.get("city", "").strip()
    latitude = request.args.get("latitude", type=float)
    longitude = request.args.get("longitude", type=float)

    if (
        not city
        or latitude is None
        or longitude is None
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return jsonify({
            "error": "Please search for and select a valid location."
        }), 400

    try:
        response = requests.get(
            AIR_QUALITY_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": "us_aqi,pm2_5,pm10",
                "hourly": "us_aqi,pm2_5,pm10",
                "timezone": "auto",
                "forecast_days": 1
            },
            timeout=15
        )
        response.raise_for_status()
        data = response.json()

        current = data.get("current", {})
        hourly = data.get("hourly", {})

        if not current.get("time"):
            return jsonify({
                "error": "Air quality data is unavailable for this location."
            }), 502

        return jsonify({
            "city": city,
            "source": "Open-Meteo Air Quality API",
            "time": current.get("time"),
            "us_aqi": current.get("us_aqi"),
            "pm2_5": current.get("pm2_5"),
            "pm10": current.get("pm10"),
            "chart": {
                "time": hourly.get("time", []),
                "us_aqi": hourly.get("us_aqi", []),
                "pm2_5": hourly.get("pm2_5", []),
                "pm10": hourly.get("pm10", [])
            }
        })

    except (requests.RequestException, ValueError):
        return jsonify({
            "error": "Unable to fetch air quality data. Please try again."
        }), 502


import os

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )