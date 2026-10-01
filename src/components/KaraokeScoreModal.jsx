import React, { useState, useEffect, useMemo, useRef } from 'react';
import './KaraokeScoreModal.css';

/**
 * Witty Karaoke Phrases & Scoring Tiers
 */
export const EASTER_EGG_SCORES = {
  1: { emoji: '🥇', quote: 'Number one! Wait, no, out of 100. Yikes.' },
  69: { emoji: '😏', quote: 'Nice. 🎸' },
  99: { emoji: '😤', quote: 'One point away. The algorithm is just being petty.' },
  100: { emoji: '🛑', quote: "HACKER DETECTED. (Just kidding, you're a legend)." }
};

export const SAVAGE_TIER = [
  { emoji: '💀', quote: 'Even the autotune filed a grievance.' },
  { emoji: '🚨', quote: 'The microphone is asking for a restraining order.' },
  { emoji: '📉', quote: 'Score: 404. Melody not found.' },
  { emoji: '🫣', quote: 'Pitch perfect! Assuming the pitch was a completely different song.' },
  { emoji: '🧅', quote: 'That performance had layers. Mostly making us cry.' },
  { emoji: '🕊️', quote: 'A moment of silence for the original artist.' },
  { emoji: '🔌', quote: 'We were this close to pulling the plug.' }
];

export const HYPE_TIER = [
  { emoji: '🔥', quote: 'Beyoncé is currently shaking.' },
  { emoji: '👑', quote: "We're shutting down the app. You just beat karaoke." },
  { emoji: '💸', quote: 'Are you accepting record deals? Asking for a friend.' },
  { emoji: '✨', quote: 'The vocal cords of an angel who just drank 3 Red Bulls.' },
  { emoji: '🏆', quote: 'Grammy pending. Please hold.' },
  { emoji: '🎤', quote: "You didn't just sing the song, you paid its mortgage." }
];

export const META_TIER = [
  { emoji: '🤖', quote: 'The algorithm is confused, but highly entertained.' },
  { emoji: '🎲', quote: "We rolled a dice for this score. You're welcome." },
  { emoji: '🧮', quote: "Math can't explain what just happened on that stage." },
  { emoji: '🛸', quote: 'Vocals so experimental they belong in Area 51.' },
  { emoji: '🤷‍♂️', quote: 'Look, the score is fake, but our love for you is real.' }
];

/**
 * Helper to pick witty phrase based on score value
 */
export function getPhraseForScore(score) {
  const numericScore = Number(score);

  // 1. Check Easter Eggs first
  if (EASTER_EGG_SCORES[numericScore]) {
    return EASTER_EGG_SCORES[numericScore];
  }

  // 2. High scores (>= 85): Hype Tier
  if (numericScore >= 85) {
    const list = HYPE_TIER;
    return list[Math.floor(Math.random() * list.length)];
  }

  // 3. Low scores (< 60): Savage Tier
  if (numericScore < 60) {
    const list = SAVAGE_TIER;
    return list[Math.floor(Math.random() * list.length)];
  }

  // 4. Mid scores (60 - 84): Meta / Algorithm Tier
  const list = Math.random() > 0.4 ? META_TIER : (numericScore >= 75 ? HYPE_TIER : SAVAGE_TIER);
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * KaraokeScoreModal Component
 *
 * @param {Object} props
 * @param {boolean} [props.isOpen=true] - Whether modal is visible
 * @param {number} [props.score] - Target score (1-100). If omitted, picks random score
 * @param {number} [props.targetScore] - Alias for score
 * @param {() => void} [props.onSingAgain] - Callback for 'Sing Again →' button
 * @param {() => void} [props.onBackToQueue] - Callback for 'Back to Queue' button
 * @param {{ emoji: string, quote: string }} [props.customPhrase] - Optional phrase override
 * @param {number} [props.duration=1500] - Duration of counting animation in ms
 */
export default function KaraokeScoreModal({
  isOpen = true,
  score,
  targetScore,
  onSingAgain,
  onBackToQueue,
  customPhrase,
  duration = 1500
}) {
  // Resolve final target score (default to random 40-100 if none provided)
  const finalScore = useMemo(() => {
    const raw = targetScore !== undefined ? targetScore : score;
    if (raw !== undefined && raw !== null) {
      return Math.min(100, Math.max(1, Math.round(Number(raw))));
    }
    // Random score with fun distribution
    const roll = Math.random();
    if (roll < 0.05) return 69;
    if (roll < 0.08) return 99;
    if (roll < 0.10) return 100;
    if (roll < 0.12) return 1;
    return Math.floor(Math.random() * 61) + 40; // 40 - 100
  }, [score, targetScore]);

  // Selected Witty Phrase
  const phrase = useMemo(() => {
    return customPhrase || getPhraseForScore(finalScore);
  }, [finalScore, customPhrase]);

  const [displayScore, setDisplayScore] = useState(0);
  const [isCountingFinished, setIsCountingFinished] = useState(false);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setDisplayScore(0);
      setIsCountingFinished(false);
      return;
    }

    setIsCountingFinished(false);
    setDisplayScore(0);

    const startTime = performance.now();

    const animateScore = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic curve: fast start, slow landing
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(easeProgress * finalScore);

      setDisplayScore(currentVal);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateScore);
      } else {
        setDisplayScore(finalScore);
        setIsCountingFinished(true);
      }
    };

    animFrameRef.current = requestAnimationFrame(animateScore);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, finalScore, duration]);

  if (!isOpen) return null;

  // Format score: if score is 1, show "01" for dramatic effect matching easter egg
  const formattedScore = (finalScore === 1 && displayScore === 1) ? '01' : displayScore;

  return (
    <div className="ksm-overlay" onClick={onBackToQueue}>
      <div 
        className="ksm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ksm-title"
      >
        {/* Glowing Header */}
        <h2 id="ksm-title" className="ksm-header">
          <span>🎤</span> YOUR KARAOKE SCORE
        </h2>

        {/* Massive Gradient Glowing Score Number */}
        <div className="ksm-score-wrapper">
          <div className="ksm-score">
            {formattedScore}
          </div>
        </div>

        {/* Witty Phrase (Fades in when counting ends) */}
        <div className="ksm-phrase-container">
          <div className={`ksm-phrase ${isCountingFinished ? 'visible' : ''}`}>
            <span className="ksm-phrase-emoji">{phrase.emoji}</span>
            <span className="ksm-phrase-quote">"{phrase.quote}"</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="ksm-actions">
          <button
            type="button"
            className="ksm-btn ksm-btn-primary"
            onClick={onSingAgain}
          >
            Sing Again →
          </button>

          <button
            type="button"
            className="ksm-btn ksm-btn-secondary"
            onClick={onBackToQueue}
          >
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  );
}
