import type { Session } from "../../core/session";

export interface VoiceCommandResponse {
  success: boolean;
  message: string;
  transcript: string;
  matchedType?: 'DEVICE' | 'SCENE' | 'QUERY' | 'UNKNOWN';
  deviceName?: string;
  action?: string;
  angle?: number;
  data?: Record<string, unknown>;
}

export async function executeVoiceCommand(
  session: Session,
  householdId: string,
  text: string,
): Promise<VoiceCommandResponse> {
  const data = await session.post(`/households/${householdId}/voice/command`, {
    text,
  });
  return data as VoiceCommandResponse;
}
