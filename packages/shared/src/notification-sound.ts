export const NOTIFICATION_SOUND_IDS = ["default", "chime", "soft"] as const;

export type NotificationSoundId = (typeof NOTIFICATION_SOUND_IDS)[number];

export function normalizeSoundId(id: unknown): NotificationSoundId {
	if (id === "chime" || id === "soft") return id;
	return "default";
}

export function shouldPlayNotificationSound(opts: {
	soundEnabled: boolean;
	tabVisible: boolean;
	playWhenTabHidden: boolean;
}): boolean {
	if (!opts.soundEnabled) return false;
	if (opts.tabVisible) return true;
	return opts.playWhenTabHidden;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === "undefined") return null;
	try {
		audioCtx ??= new AudioContext();
		void audioCtx.resume();
		return audioCtx;
	} catch {
		return null;
	}
}

function playTone(
	ctx: AudioContext,
	freq: number,
	start: number,
	duration: number,
	gain = 0.12,
) {
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = "sine";
	osc.frequency.value = freq;
	g.gain.setValueAtTime(0, start);
	g.gain.linearRampToValueAtTime(gain, start + 0.01);
	g.gain.exponentialRampToValueAtTime(0.001, start + duration);
	osc.connect(g);
	g.connect(ctx.destination);
	osc.start(start);
	osc.stop(start + duration + 0.05);
}

/** Short notification tone via Web Audio (no asset files). */
export function playNotificationSound(soundId: NotificationSoundId): void {
	const ctx = getAudioContext();
	if (!ctx) return;
	const t = ctx.currentTime;
	switch (soundId) {
		case "chime":
			playTone(ctx, 880, t, 0.1);
			playTone(ctx, 1175, t + 0.09, 0.14);
			break;
		case "soft":
			playTone(ctx, 520, t, 0.2, 0.07);
			break;
		default:
			playTone(ctx, 660, t, 0.11);
			break;
	}
}
