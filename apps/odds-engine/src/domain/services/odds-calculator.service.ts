import { Injectable } from '@nestjs/common';
import { MatchEvent, OddsSnapshot } from '@betting-engine/shared-kernel';
import { MatchState } from '../models/match-state.model';

interface ProbabilityVector {
  home: number;
  draw: number;
  away: number;
}

@Injectable()
export class OddsCalculatorService {
  private readonly baseProbabilities: ProbabilityVector = {
    home: 0.45,
    draw: 0.25,
    away: 0.3,
  };

  private readonly vig = 0.05;

  calculate(matchState: MatchState, triggerEvent: MatchEvent): OddsSnapshot {
    const probabilities =
      matchState.status === 'FINISHED'
        ? this.finishedProbabilities(matchState)
        : this.liveProbabilities(matchState, triggerEvent);

    return {
      home: this.probabilityToOdd(probabilities.home),
      draw: this.probabilityToOdd(probabilities.draw),
      away: this.probabilityToOdd(probabilities.away),
      timestamp: new Date().toISOString(),
    };
  }

  private liveProbabilities(matchState: MatchState, triggerEvent: MatchEvent): ProbabilityVector {
    const scoreDiff = matchState.homeScore - matchState.awayScore;
    const minuteFactor = this.clamp(matchState.currentMinute / 90, 0, 1);

    const scoreWeight = 0.08 + 0.32 * minuteFactor;
    const drawPenaltyWeight = 0.04 + 0.14 * minuteFactor;

    let homeAdjustment = scoreDiff * scoreWeight;
    let awayAdjustment = -homeAdjustment;
    let drawAdjustment = -Math.abs(scoreDiff) * drawPenaltyWeight;

    if (triggerEvent.type === 'RED_CARD') {
      const penalty = 0.12;
      const bonus = 0.08;
      const drawBoost = 0.04;

      if (triggerEvent.payload.team === 'HOME') {
        homeAdjustment -= penalty;
        awayAdjustment += bonus;
        drawAdjustment += drawBoost;
      } else {
        homeAdjustment += bonus;
        awayAdjustment -= penalty;
        drawAdjustment += drawBoost;
      }
    }

    const adjusted: ProbabilityVector = {
      home: this.baseProbabilities.home + homeAdjustment,
      draw: this.baseProbabilities.draw + drawAdjustment,
      away: this.baseProbabilities.away + awayAdjustment,
    };

    return this.normalizeProbabilities(adjusted);
  }

  private finishedProbabilities(matchState: MatchState): ProbabilityVector {
    if (matchState.homeScore > matchState.awayScore) {
      return this.normalizeProbabilities({ home: 0.97, draw: 0.02, away: 0.01 });
    }

    if (matchState.awayScore > matchState.homeScore) {
      return this.normalizeProbabilities({ home: 0.01, draw: 0.02, away: 0.97 });
    }

    return this.normalizeProbabilities({ home: 0.02, draw: 0.96, away: 0.02 });
  }

  private normalizeProbabilities(input: ProbabilityVector): ProbabilityVector {
    const minimumProbability = 0.02;

    const clamped: ProbabilityVector = {
      home: this.clamp(input.home, minimumProbability, 0.98),
      draw: this.clamp(input.draw, minimumProbability, 0.98),
      away: this.clamp(input.away, minimumProbability, 0.98),
    };

    const total = clamped.home + clamped.draw + clamped.away;

    return {
      home: clamped.home / total,
      draw: clamped.draw / total,
      away: clamped.away / total,
    };
  }

  private probabilityToOdd(probability: number): number {
    const withVig = probability * (1 + this.vig);
    const odd = 1 / withVig;
    return this.roundToTwoDecimals(this.clamp(odd, 1.01, 100));
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(Math.max(value, min), max);
  }
}
