import {
  Chart,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import { TimeSeriesPoint } from '../../shared/types';

Chart.register(
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

export function renderActivityChart(
  canvas: HTMLCanvasElement,
  data: TimeSeriesPoint[]
): Chart {
  const labels = data.map((d) => d.bucket.slice(5)); // e.g. "11-01"
  const cleanData = data.map((d) => d.clean);
  const sensitiveData = data.map((d) => d.sensitive);

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Clean',
          data: cleanData,
          backgroundColor: '#38bdf8',
          borderRadius: 3
        },
        {
          label: 'Protected',
          data: sensitiveData,
          backgroundColor: '#ef4444',
          borderRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false }
        },
        y: {
          stacked: true,
          grid: { color: '#f1f5f9' },
          beginAtZero: true
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

export function renderDecisionDonut(
  canvas: HTMLCanvasElement,
  cancelled: number,
  overridden: number
): Chart {
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Blocked', 'Approved'],
      datasets: [
        {
          data: [cancelled || 1, overridden || 0],
          backgroundColor: ['#10b981', '#f59e0b'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false }
      }
    }
  });
}
