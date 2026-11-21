import { InsightItem } from '../../shared/types';

export interface InsightInputData {
  totalInspected: number;
  sensitiveDetections: number;
  chatgptDetections: number;
  perplexityDetections: number;
  overrideRatePercent: number;
  repeatOffenderCount: number;
  ocrDetectionsCount: number;
  peakHour?: number;
}

export function generateInsights(data: InsightInputData): InsightItem[] {
  const insights: InsightItem[] = [];

  const {
    sensitiveDetections,
    chatgptDetections,
    perplexityDetections,
    overrideRatePercent,
    repeatOffenderCount,
    ocrDetectionsCount,
    peakHour
  } = data;

  if (sensitiveDetections === 0) {
    return [
      {
        id: 'no-detections',
        type: 'success',
        title: 'Zero sensitive data leaks detected',
        description: 'All prompts and uploads scanned cleanly during this time period.'
      }
    ];
  }

  // 1. Site distribution insight
  if (chatgptDetections > perplexityDetections && chatgptDetections > 0) {
    const pct = Math.round((chatgptDetections / sensitiveDetections) * 100);
    insights.push({
      id: 'site-chatgpt',
      type: 'danger',
      title: 'Most detections come from ChatGPT',
      description: `${chatgptDetections} of ${sensitiveDetections} detections (${pct}%) happened on ChatGPT, mostly prompts pasted from documents.`
    });
  } else if (perplexityDetections > chatgptDetections && perplexityDetections > 0) {
    const pct = Math.round((perplexityDetections / sensitiveDetections) * 100);
    insights.push({
      id: 'site-perplexity',
      type: 'danger',
      title: 'Most detections come from Perplexity',
      description: `${perplexityDetections} of ${sensitiveDetections} detections (${pct}%) happened on Perplexity.`
    });
  }

  // 2. Override rate insight
  if (overrideRatePercent >= 30) {
    insights.push({
      id: 'override-rate-high',
      type: 'warning',
      title: 'Override rate is elevated',
      description: `${overrideRatePercent}% of detections were sent anyway via Continue.`
    });
  }

  // 3. Repeat content insight
  if (repeatOffenderCount > 0) {
    insights.push({
      id: 'repeat-content',
      type: 'info',
      title: 'Repeat content detected',
      description: `${repeatOffenderCount} items were flagged more than once. The same content hash was resubmitted.`
    });
  }

  // 4. OCR detection insight
  if (ocrDetectionsCount > 0) {
    insights.push({
      id: 'ocr-detection',
      type: 'success',
      title: 'OCR is catching hidden cases',
      description: `${ocrDetectionsCount} detections came from images or scanned documents without a text layer.`
    });
  }

  // 5. Peak hour insight
  if (peakHour !== undefined) {
    const formattedHour = peakHour.toString().padStart(2, '0') + ':00';
    insights.push({
      id: 'peak-hour',
      type: 'info',
      title: `Peak risk hour: ${formattedHour}`,
      description: `Historical detections peak around ${formattedHour} during active work hours.`
    });
  }

  return insights;
}
