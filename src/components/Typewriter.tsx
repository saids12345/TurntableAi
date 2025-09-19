"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  words: string[];
  typeSpeedMs?: number;   // default 40
  deleteSpeedMs?: number; // default 20
  pauseMs?: number;       // default 1200
  loop?: boolean;         // default true
  className?: string;
};

export default function Typewriter({
  words,
  typeSpeedMs = 40,
  deleteSpeedMs = 20,
  pauseMs = 1200,
  loop = true,
  className = "",
}: Props) {
  // keep a stable copy so we don’t retrigger effects if parent re-renders
  const stableWords = useMemo(() => words.slice(), [words]);

  const [index, setIndex] = useState(0);      // which word
  const [sub, setSub] = useState("");         // current substring
  const [deleting, setDeleting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const word = stableWords[index % stableWords.length];

    if (!deleting) {
      // typing forward
      if (sub.length < word.length) {
        const t = setTimeout(() => mounted.current && setSub(word.slice(0, sub.length + 1)), typeSpeedMs);
        return () => clearTimeout(t);
      }
      // full word shown — pause, then start deleting
      const t = setTimeout(() => mounted.current && setDeleting(true), pauseMs);
      return () => clearTimeout(t);
    } else {
      // deleting
      if (sub.length > 0) {
        const t = setTimeout(() => mounted.current && setSub(word.slice(0, sub.length - 1)), deleteSpeedMs);
        return () => clearTimeout(t);
      }
      // word fully deleted — move to next
      const next = index + 1;
      if (!loop && next >= stableWords.length) return;
      const t = setTimeout(() => {
        if (!mounted.current) return;
        setIndex(next % stableWords.length);
        setDeleting(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [sub, deleting, index, stableWords, typeSpeedMs, deleteSpeedMs, pauseMs, loop]);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-live="polite">
      <span>{sub}</span>
      <span className="type-caret" aria-hidden="true">|</span>
    </span>
  );
}
