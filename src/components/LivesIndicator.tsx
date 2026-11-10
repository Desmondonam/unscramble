import React, { useEffect, useState } from 'react';
import { useContent } from '@/store/contentStore';
import { useProgress } from '@/store/progressStore';
import { Pill } from './ui';

/** Lives with a live countdown to the next refill. */
export function useLives() {
  const lives = useProgress((s) => s.lives);
  const updatedAt = useProgress((s) => s.livesUpdatedAt);
  const config = useContent((s) => s.config);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lives >= config.maxLives) return;
    const id = setInterval(() => {
      setNow(Date.now());
      useProgress.getState().regenerateLives(useContent.getState().config);
    }, 1000);
    return () => clearInterval(id);
  }, [lives, config.maxLives]);

  const period = config.lifeRegenMinutes * 60_000;
  const msLeft = lives >= config.maxLives ? 0 : Math.max(0, updatedAt + period - now);
  const mm = Math.floor(msLeft / 60_000);
  const ss = Math.floor((msLeft % 60_000) / 1000);
  return { lives, max: config.maxLives, refillIn: lives >= config.maxLives ? null : `${mm}:${String(ss).padStart(2, '0')}` };
}

export function LivesPill() {
  const { lives, max, refillIn } = useLives();
  return <Pill icon="❤️" text={refillIn && lives < max ? `${lives} · ${refillIn}` : `${lives}/${max}`} />;
}
