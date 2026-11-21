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
        title: 'Zero policy violations detected',
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
      title: 'Most policy matches from ChatGPT',
      description: `${chatgptDetections} of ${sensitiveDetections} policy matches (${pct}%) occurred on ChatGPT.`
    });
  } else if (perplexityDetections > chatgptDetections && perplexityDetections > 0) {
    const pct = Math.round((perplexityDetections / sensitiveDetections) * 100);
    insights.push({
      id: 'site-perplexity',
      type: 'danger',
      title: 'Most policy matches from Perplexity',
      description: `${perplexityDetections} of ${sensitiveDetections} policy matches (${pct}%) occurred on Perplexity.`
    });
  }

  // 2. Override rate insight
  if (overrideRatePercent >= 30) {
    insights.push({
      id: 'override-rate-high',
      type: 'warning',
      title: 'Approval rate is elevated',
      description: `${overrideRatePercent}% of flagged items were approved via Continue.`
    });
  }

  // 3. Repeat content insight
  if (repeatOffenderCount > 0) {
    insights.push({
      id: 'repeat-content',
      type: 'info',
      title: 'Repeat content detected',
      description: `${repeatOffenderCount} items were flagged more than once with identical content hashes.`
    });
  }

  // 4. OCR detection insight
  if (ocrDetectionsCount > 0) {
    insights.push({
      id: 'ocr-detection',
      type: 'success',
      title: 'OCR inspection active',
      description: `${ocrDetectionsCount} matches identified in images or documents without embedded text layers.`
    });
  }

  // 5. Peak hour insight
  if (peakHour !== undefined) {
    const formattedHour = peakHour.toString().padStart(2, '0') + ':00';
    insights.push({
      id: 'peak-hour',
      type: 'info',
      title: `Peak activity hour: ${formattedHour}`,
      description: `Historical policy matches peak around ${formattedHour} during standard working hours.`
    });
  }

  return insights;
}
