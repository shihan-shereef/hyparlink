import { MusicBrief, MusicTrack, MusicRankingResult } from './types.js';

export class MusicRanker {
  /**
   * Evaluates candidate tracks against a MusicBrief and ranks them by weighted relevance score.
   * Deterministically enforces licensing compliance, commercial safety, and vocal constraints.
   */
  rankCandidates(brief: MusicBrief, candidates: MusicTrack[]): MusicRankingResult {
    const evaluatedCount = candidates.length;
    const scoredList: MusicTrack[] = [];

    for (const track of candidates) {
      // 1. Mandatory eligibility check: Licensing & commercial safety
      if (!track.commercialSafe) {
        continue; // Ineligible - non-commercial licenses rejected
      }
      if (track.licenseInfo && !track.licenseInfo.commercialSafe) {
        continue;
      }

      // 2. Mandatory vocal constraint if video requires instrumental for narration
      if (brief.vocalPreference === 'instrumental_only' && track.hasVocals) {
        continue; // Ineligible - distracting vocals
      }

      // 3. Narration suitability check
      if (brief.narrationRequirements.duckingRequired && track.suitableForNarration === false) {
        continue; // Ineligible - dense vocals/conflicts with narration
      }

      const scoreBreakdown = {
        moodScore: this.calculateMoodScore(brief, track),
        genreScore: this.calculateGenreScore(brief, track),
        subjectSynergyScore: this.calculateSubjectScore(brief, track),
        energyPacingScore: this.calculateEnergyScore(brief, track),
        durationSuitabilityScore: this.calculateDurationScore(brief, track),
        vocalSuitabilityScore: this.calculateVocalsScore(brief, track),
        audioQualityScore: track.provider === 'workspace' ? 98 : 92,
        licensingScore: 100, // Commercial-safe verified
        totalScore: 0,
      };

      // Weighted sum (weights sum to 1.0)
      const totalScore = Math.round(
        scoreBreakdown.moodScore * 0.25 +
          scoreBreakdown.genreScore * 0.18 +
          scoreBreakdown.subjectSynergyScore * 0.20 +
          scoreBreakdown.energyPacingScore * 0.12 +
          scoreBreakdown.durationSuitabilityScore * 0.10 +
          scoreBreakdown.vocalSuitabilityScore * 0.05 +
          scoreBreakdown.audioQualityScore * 0.05 +
          scoreBreakdown.licensingScore * 0.05
      );

      scoreBreakdown.totalScore = totalScore;
      const reasons = this.generateSelectionReasons(brief, track, scoreBreakdown);

      const scoredTrack: MusicTrack = {
        ...track,
        rankingScore: totalScore,
        rankingReason: reasons.join('; '),
        scoreBreakdown,
      };

      scoredList.push(scoredTrack);
    }

    // Sort descending by totalScore
    const rankedCandidates = scoredList.sort(
      (a, b) => (b.rankingScore || 0) - (a.rankingScore || 0)
    );

    const eligibleCount = rankedCandidates.length;

    if (eligibleCount === 0) {
      return {
        bestCandidate: candidates[0] || ({} as MusicTrack),
        candidates: [],
        brief,
        selectionReason: 'No candidate satisfied all mandatory licensing and vocal constraints.',
        evaluatedCount,
        eligibleCount: 0,
      };
    }

    const bestCandidate = rankedCandidates[0];

    return {
      bestCandidate,
      candidates: rankedCandidates,
      brief,
      selectionReason: bestCandidate.rankingReason || 'Highest ranked score based on mood, tempo, and licensing compliance.',
      evaluatedCount,
      eligibleCount,
    };
  }

  private calculateMoodScore(brief: MusicBrief, track: MusicTrack): number {
    const briefMoods = (brief.emotionalTone || []).map((m) => m.toLowerCase());
    const trackMoods = (track.moods || []).map((m) => m.toLowerCase());

    if (briefMoods.length === 0 || trackMoods.length === 0) return 70;

    let matchCount = 0;
    for (const bm of briefMoods) {
      if (trackMoods.some((tm) => tm.includes(bm) || bm.includes(tm))) {
        matchCount++;
      }
    }

    const ratio = matchCount / Math.max(1, briefMoods.length);
    return Math.min(100, Math.round(55 + ratio * 45));
  }

  private calculateGenreScore(brief: MusicBrief, track: MusicTrack): number {
    const briefGenre = (brief.musicGenre || '').toLowerCase().replace(/[-_]/g, ' ');
    const trackGenre = `${track.genre} ${(track.subgenres || []).join(' ')}`.toLowerCase();

    if (trackGenre.includes(briefGenre) || briefGenre.includes(track.genre.toLowerCase())) {
      return 100;
    }

    const briefWords = briefGenre.split(/\s+/).filter(Boolean);
    const matches = briefWords.filter((w) => trackGenre.includes(w));
    if (matches.length > 0) {
      return Math.min(95, 60 + matches.length * 20);
    }

    return 55;
  }

  private calculateSubjectScore(brief: MusicBrief, track: MusicTrack): number {
    const subject = `${brief.videoSubject} ${brief.videoCategory} ${brief.videoTitle}`.toLowerCase();
    const tags = (track.tags || []).map((t) => t.toLowerCase());

    if (tags.length === 0) return 70;

    const matchedTags = tags.filter((t) => subject.includes(t));
    if (matchedTags.length >= 2) return 100;
    if (matchedTags.length === 1) return 85;

    return 65;
  }

  private calculateEnergyScore(brief: MusicBrief, track: MusicTrack): number {
    const energyMap: Record<string, number> = {
      serene: 3,
      low: 4,
      medium: 6,
      building: 7,
      high: 8,
      epic: 9,
    };

    const targetEnergy = energyMap[brief.energyLevel] || 6;
    const trackEnergy = track.energyLevel || 6;
    const diff = Math.abs(targetEnergy - trackEnergy);

    if (diff === 0) return 100;
    if (diff === 1) return 88;
    if (diff === 2) return 72;
    return Math.max(40, 60 - diff * 10);
  }

  private calculateDurationScore(brief: MusicBrief, track: MusicTrack): number {
    const videoDur = brief.musicDurationSeconds || 30;
    const trackDur = track.durationSeconds || 60;

    // Ideal: track is at least as long as video
    if (trackDur >= videoDur) {
      return 100;
    }

    // If shorter, loopability matters
    if (track.isLoopable) {
      return 85;
    }

    // Shorter and non-loopable: penalized
    const ratio = trackDur / Math.max(1, videoDur);
    return Math.round(ratio * 70);
  }

  private calculateVocalsScore(brief: MusicBrief, track: MusicTrack): number {
    if (brief.vocalPreference === 'instrumental_only') {
      return track.isInstrumental && !track.hasVocals ? 100 : 0;
    }
    if (brief.vocalPreference === 'subtle_textures') {
      return track.isInstrumental ? 95 : 80;
    }
    return 90;
  }

  private generateSelectionReasons(
    brief: MusicBrief,
    track: MusicTrack,
    scores: Record<string, number>
  ): string[] {
    const reasons: string[] = [];

    if (scores.moodScore >= 80) {
      reasons.push(`High mood resonance (${track.moods.slice(0, 3).join(', ')})`);
    }
    if (scores.genreScore >= 85) {
      reasons.push(`Direct genre alignment with ${track.genre}`);
    }
    if (scores.subjectSynergyScore >= 80) {
      reasons.push(`Visual subject compatibility`);
    }
    if (scores.durationSuitabilityScore >= 90) {
      reasons.push(`Covers target video length (${track.durationSeconds}s vs ${brief.musicDurationSeconds}s)`);
    }
    if (track.licenseInfo?.name) {
      reasons.push(`Verified license: ${track.licenseInfo.name}`);
    } else {
      reasons.push(`Commercial royalty-free verified`);
    }

    return reasons;
  }
}
