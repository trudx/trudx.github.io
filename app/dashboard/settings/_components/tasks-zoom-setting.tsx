"use client";

//* Components Imports
import Label from "@/components/ui/label";
import Select from "@/components/ui/select";
import { PanelsTopLeft } from "lucide-react";
import { SettingsSection } from "./settings-section";

//* Hooks Imports
import { TASKS_ZOOM_DEFAULT, TASKS_ZOOM_OPTIONS, useTasksZoom } from "@/hooks/use-tasks-zoom";

export function TasksZoomSetting() {
  const { zoom, setZoom } = useTasksZoom();

  return (
    <SettingsSection
      title="Visualização de tarefas"
      description="Ajuste a densidade do Kanban no computador."
      icon={PanelsTopLeft}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label htmlFor="settings-tasks-zoom" className="text-[0.72rem] font-semibold">
            Zoom da aba Tarefas
          </Label>
          <p className="text-xs text-muted-foreground">
            Reduz a escala do Kanban no computador para caber mais colunas. Padrão: {TASKS_ZOOM_DEFAULT}%. Fica salvo
            neste dispositivo.
          </p>
        </div>

        <Select.SelectRoot value={String(zoom)} onValueChange={(value) => setZoom(Number(value))}>
          <Select.SelectTrigger id="settings-tasks-zoom" className="h-9 w-full bg-background sm:w-32">
            <Select.SelectValue>{`${zoom}%`}</Select.SelectValue>
          </Select.SelectTrigger>
          <Select.SelectContent>
            {TASKS_ZOOM_OPTIONS.map((option) => (
              <Select.SelectItem key={option} value={String(option)}>
                {option}%
              </Select.SelectItem>
            ))}
          </Select.SelectContent>
        </Select.SelectRoot>
      </div>
    </SettingsSection>
  );
}
