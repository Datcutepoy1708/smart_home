import type { Session } from "../../core/session";

export interface SceneActionItem {
  id: string;
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  action: string;
  params: Record<string, unknown>;
  orderIndex: number;
}

export interface SceneItem {
  id: string;
  householdId: string;
  name: string;
  icon: string;
  actions: SceneActionItem[];
  createdAt: string;
}

export async function fetchScenes(
  session: Session,
  householdId: string,
): Promise<SceneItem[]> {
  const data = await session.get(`/households/${householdId}/scenes`);
  return Array.isArray(data) ? (data as SceneItem[]) : [];
}

export async function triggerSceneApi(
  session: Session,
  householdId: string,
  sceneId: string,
): Promise<{ sceneId: string; name: string; results: any[] }> {
  const res = await session.post(
    `/households/${householdId}/scenes/${sceneId}/trigger`,
  );
  return res as { sceneId: string; name: string; results: any[] };
}
