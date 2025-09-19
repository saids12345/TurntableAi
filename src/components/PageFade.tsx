"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PageFade({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [path]);

  return (
    <div className={`transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
      {children}
    </div>
  );
}
