/**
 * Mathematical engine for calculating Sales Forecasts
 * using Weighted Moving Average and Linear Trend.
 */

export function calculateForecast(
  prodStats: Record<string, [number, number, number, number]>
) {
  const predictions = Object.keys(prodStats).map(name => {
    const [p1, p2, p3, p4] = prodStats[name]
    
    // Weighted Moving Average (giving more weight to recent periods)
    // WMA = (1*p1 + 2*p2 + 3*p3 + 4*p4) / 10
    const wma = (p1 * 1 + p2 * 2 + p3 * 3 + p4 * 4) / 10
    
    // Simple Linear Trend over the 4 points
    // Slope = (p4 - p1) / 3
    const slope = (p4 - p1) / 3

    // Forecast for next 15 days: wma + slope
    let forecast15 = Math.round(wma + slope)
    if (forecast15 < 0) forecast15 = 0

    // We want a 7-day forecast
    const forecast7 = Math.ceil(forecast15 / 2)

    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (slope > (p4 * 0.1)) trend = 'up' // slope > 10% of last period
    else if (slope < -(p4 * 0.1)) trend = 'down'

    let reason = 'Sales are stable based on historical average.'
    if (trend === 'up') reason = 'Recent sales momentum indicates upward trend.'
    if (trend === 'down') reason = 'Demand has slightly cooled off recently.'
    if (p4 === 0 && p3 > 0) {
      trend = 'down'
      reason = 'No sales in the last two weeks, sharp decline.'
    }

    return {
      productName: name,
      predictedQuantity: forecast7,
      trend,
      reason,
      recentSales: p4 // 15 day volume
    }
  })

  // Sort by highest predicted quantity, take top 5
  return predictions.sort((a, b) => b.predictedQuantity - a.predictedQuantity).slice(0, 5)
}
