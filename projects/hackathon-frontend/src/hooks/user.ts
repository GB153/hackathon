import { useEffect, useState } from "react";

type Me = { email: string; name?: string; picture?: string } | null;

export function useMe() {
  const backend = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const [user, setUser] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${backend}/users/me`, { credentials: "include" });
        const j = await r.json();
        if (alive) setUser(j?.ok ? j.user : null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [backend]);

  return { user, loading, backend };
}
