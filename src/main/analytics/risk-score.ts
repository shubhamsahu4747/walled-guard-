export interface RiskScoreInput {
  totalInspected: number;
  sensitiveDetections: number;
  overriddenCount: number;
  repeatContentCount: number;
  fileDetectionsCount: number;
}

export interface RiskScoreResult {
  score: number; // 0-100
  level: 'Low' | 'Medium' | 'High';
  components: {
    leakRateScore: number;
    overrideRateScore: number;
    repeatContentScore: number;
    fileShareScore: number;
  };
  formula: string;
}

export function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Calculates transparent risk score (0-100) per architecture specification.
 */
export function calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
  const {
    totalInspected,
    sensitiveDetections,
    overriddenCount,
    repeatContentCount,
    fileDetectionsCount
  } = input;

  if (totalInspected === 0 || sensitiveDetections === 0) {
    return {
      score: 0,
      level: 'Low',
      components: {
        leakRateScore: 0,
        overrideRateScore: 0,
        repeatContentScore: 0,
        fileShareScore: 0
      },
      formula: '100 * (0.40 * leakRate + 0.35 * overrideRate + 0.15 * repeat + 0.10 * fileShare)'
    };
  }

  // 1. Leak rate = detected / total (saturated at 20%, so leakRate * 5 is clamped to 1)
  const rawLeakRate = sensitiveDetections / totalInspected;
  const leakRateNormalized = clamp(rawLeakRate * 5, 0, 1);
  const leakRateScore = 0.40 * leakRateNormalized;

  // 2. Override rate = overridden / detected
  const overrideRate = clamp(overriddenCount / sensitiveDetections, 0, 1);
  const overrideRateScore = 0.35 * overrideRate;

  // 3. Repeat leaks = min(repeatCount / 5, 1)
  const repeatNormalized = clamp(repeatContentCount / 5, 0, 1);
  const repeatContentScore = 0.15 * repeatNormalized;

  // 4. File share of detections = fileDetections / detected
  const fileShare = clamp(fileDetectionsCount / sensitiveDetections, 0, 1);
  const fileShareScore = 0.10 * fileShare;

  const rawTotal = leakRateScore + overrideRateScore + repeatContentScore + fileShareScore;
  const score = Math.round(100 * clamp(rawTotal, 0, 1));

  let level: 'Low' | 'Medium' | 'High' = 'Low';
  if (score >= 60) {
    level = 'High';
  } else if (score >= 30) {
    level = 'Medium';
  }

  return {
    score,
    level,
    components: {
      leakRateScore: Math.round(leakRateScore * 100),
      overrideRateScore: Math.round(overrideRateScore * 100),
      repeatContentScore: Math.round(repeatContentScore * 100),
      fileShareScore: Math.round(fileShareScore * 100)
    },
    formula: '100 * (0.40 * leakRate*5 + 0.35 * overrideRate + 0.15 * min(repeat/5, 1) + 0.10 * fileShare)'
  };
}
