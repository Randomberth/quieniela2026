/**
 * Calculate points earned for a prediction based on actual match result
 * 
 * Business Rules:
 * - 3 points for exact score match (e.g., predicted 2-1, actual 2-1)
 * - 1 point for correct tendency/winner or correct draw, but incorrect score 
 *   (e.g., predicted 1-0, actual 3-1 OR predicted 1-1, actual 2-2)
 * - 0 points for incorrect winner/tendency
 * 
 * @param homePrediction Predicted home team score
 * @param awayPrediction Predicted away team score
 * @param homeActual Actual home team score
 * @param awayActual Actual away team score
 * @returns Points earned (0, 1, or 3)
 */
export function calculatePoints(
  homePrediction: number,
  awayPrediction: number,
  homeActual: number,
  awayActual: number
): number {
  // Exact match
  if (homePrediction === homeActual && awayPrediction === awayActual) {
    return 3
  }

  // Calculate match tendencies
  const predictionTendency = Math.sign(homePrediction - awayPrediction)
  const actualTendency = Math.sign(homeActual - awayActual)

  // Correct tendency (same winner or both draw)
  if (predictionTendency === actualTendency) {
    return 1
  }

  // Incorrect tendency
  return 0
}

/**
 * Check if a match is locked (predictions disabled)
 * 
 * Business Rules:
 * - Users CANNOT insert, update, or delete a prediction if 
 *   currentTime >= match_date
 * 
 * @param matchDate Match date/time string (ISO format)
 * @param currentTime Optional current time for testing (defaults to now)
 * @returns true if match is locked, false otherwise
 */
export function isMatchLocked(matchDate: string, currentTime?: Date): boolean {
  const matchDateTime = new Date(matchDate)
  const now = currentTime || new Date()
  
  return now >= matchDateTime
}

/**
 * Validate prediction scores
 * 
 * @param homeScore Predicted home score
 * @param awayScore Predicted away score
 * @returns true if scores are valid non-negative integers
 */
export function isValidPrediction(homeScore: number, awayScore: number): boolean {
  return Number.isInteger(homeScore) && 
         Number.isInteger(awayScore) && 
         homeScore >= 0 && 
         awayScore >= 0
}