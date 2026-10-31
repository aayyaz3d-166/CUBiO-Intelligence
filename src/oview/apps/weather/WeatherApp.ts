/**
 * Weather — Controller & Atmospheric Telemetry Substrate
 * ============================================================================
 * WeatherApp.ts: Manages weather conditions, metric/imperial temperature conversion,
 * 5-day forecasts, and multi-city telemetry.
 */

export interface DayForecast {
  day: string;
  condition: string;
  tempMax: number;
  tempMin: number;
  icon: string;
}

export interface CityWeatherData {
  city: string;
  country: string;
  tempC: number;
  feelsLikeC: number;
  condition: string;
  icon: string;
  humidity: number;
  windKmh: number;
  uvIndex: number;
  forecast: DayForecast[];
}

export class WeatherApp {
  private activeCityName: string = 'Karachi';
  private isCelsius: boolean = true;

  private database: Record<string, CityWeatherData> = {
    Karachi: {
      city: 'Karachi',
      country: 'Pakistan',
      tempC: 28,
      feelsLikeC: 30,
      condition: 'Sunny & Clear',
      icon: '☀️',
      humidity: 58,
      windKmh: 14,
      uvIndex: 7,
      forecast: [
        { day: 'Mon', condition: 'Sunny', tempMax: 29, tempMin: 22, icon: '☀️' },
        { day: 'Tue', condition: 'Clear', tempMax: 30, tempMin: 23, icon: '🌤️' },
        { day: 'Wed', condition: 'Sunny', tempMax: 29, tempMin: 21, icon: '☀️' },
        { day: 'Thu', condition: 'Breezy', tempMax: 28, tempMin: 20, icon: '💨' },
        { day: 'Fri', condition: 'Sunny', tempMax: 31, tempMin: 22, icon: '☀️' },
      ],
    },
    Tokyo: {
      city: 'Tokyo',
      country: 'Japan',
      tempC: 19,
      feelsLikeC: 18,
      condition: 'Cyber Haze',
      icon: '🌫️',
      humidity: 65,
      windKmh: 10,
      uvIndex: 4,
      forecast: [
        { day: 'Mon', condition: 'Cloudy', tempMax: 20, tempMin: 14, icon: '☁️' },
        { day: 'Tue', condition: 'Rain', tempMax: 17, tempMin: 13, icon: '🌧️' },
        { day: 'Wed', condition: 'Clear', tempMax: 21, tempMin: 15, icon: '🌤️' },
        { day: 'Thu', condition: 'Haze', tempMax: 19, tempMin: 14, icon: '🌫️' },
        { day: 'Fri', condition: 'Sunny', tempMax: 22, tempMin: 16, icon: '☀️' },
      ],
    },
    London: {
      city: 'London',
      country: 'UK',
      tempC: 14,
      feelsLikeC: 12,
      condition: 'Light Rain',
      icon: '🌧️',
      humidity: 82,
      windKmh: 18,
      uvIndex: 2,
      forecast: [
        { day: 'Mon', condition: 'Rain', tempMax: 15, tempMin: 9, icon: '🌧️' },
        { day: 'Tue', condition: 'Drizzle', tempMax: 14, tempMin: 8, icon: '🌦️' },
        { day: 'Wed', condition: 'Overcast', tempMax: 16, tempMin: 10, icon: '☁️' },
        { day: 'Thu', condition: 'Sunny', tempMax: 18, tempMin: 11, icon: '🌤️' },
        { day: 'Fri', condition: 'Showers', tempMax: 13, tempMin: 7, icon: '🌧️' },
      ],
    },
    'New York': {
      city: 'New York',
      country: 'USA',
      tempC: 21,
      feelsLikeC: 20,
      condition: 'Partly Cloudy',
      icon: '⛅',
      humidity: 50,
      windKmh: 12,
      uvIndex: 5,
      forecast: [
        { day: 'Mon', condition: 'Partly Cloudy', tempMax: 22, tempMin: 15, icon: '⛅' },
        { day: 'Tue', condition: 'Sunny', tempMax: 24, tempMin: 16, icon: '☀️' },
        { day: 'Wed', condition: 'Thunder', tempMax: 20, tempMin: 14, icon: '⛈️' },
        { day: 'Thu', condition: 'Clear', tempMax: 23, tempMin: 15, icon: '🌤️' },
        { day: 'Fri', condition: 'Sunny', tempMax: 25, tempMin: 17, icon: '☀️' },
      ],
    },
  };

  public getCities(): string[] {
    return Object.keys(this.database);
  }

  public getSelectedCity(): string {
    return this.activeCityName;
  }

  public selectCity(city: string): CityWeatherData {
    if (this.database[city]) {
      this.activeCityName = city;
    }
    return this.getWeatherData();
  }

  public getWeatherData(): CityWeatherData {
    return this.database[this.activeCityName] || this.database['Karachi'];
  }

  public toggleUnit(): boolean {
    this.isCelsius = !this.isCelsius;
    return this.isCelsius;
  }

  public isCelsiusUnit(): boolean {
    return this.isCelsius;
  }

  public formatTemp(tempC: number): string {
    if (this.isCelsius) {
      return `${Math.round(tempC)}°C`;
    }
    const tempF = (tempC * 9) / 5 + 32;
    return `${Math.round(tempF)}°F`;
  }
}
