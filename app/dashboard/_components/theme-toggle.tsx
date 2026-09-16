"use client";

//* Components Imports
import Switch from "@/components/ui/switch";

//* Libraries Imports
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Deferring to a mounted flag avoids a hydration mismatch, since the server can't know the stored theme.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1">
      <div className="flex items-center gap-2 text-foreground/80">
        {isDark ? (
          <Moon className="size-3.5 text-muted-foreground" />
        ) : (
          <Sun className="size-3.5 text-muted-foreground" />
        )}
        <span className="text-xs">Tema escuro</span>
      </div>
      <Switch
        size="sm"
        checked={isDark}
        disabled={!mounted}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Alternar tema escuro"
      />
    </div>
  );
}
