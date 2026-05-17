import localFont from "next/font/local";

const fontDir = "../../public/fonts";

export const vazirmatn = localFont({
	src: [
		{ path: `${fontDir}/Vazirmatn-Light.ttf`, weight: "300", style: "normal" },
		{ path: `${fontDir}/Vazirmatn-Regular.ttf`, weight: "400", style: "normal" },
		{ path: `${fontDir}/Vazirmatn-Medium.ttf`, weight: "500", style: "normal" },
		{
			path: `${fontDir}/Vazirmatn-SemiBold.ttf`,
			weight: "600",
			style: "normal",
		},
		{ path: `${fontDir}/Vazirmatn-Bold.ttf`, weight: "700", style: "normal" },
		{
			path: `${fontDir}/Vazirmatn-ExtraBold.ttf`,
			weight: "800",
			style: "normal",
		},
		{ path: `${fontDir}/Vazirmatn-Black.ttf`, weight: "900", style: "normal" },
	],
	variable: "--font-vazir",
	display: "swap",
});

export const dmSans = localFont({
	src: [
		{ path: `${fontDir}/DMSans-Light.ttf`, weight: "300", style: "normal" },
		{ path: `${fontDir}/DMSans-Regular.ttf`, weight: "400", style: "normal" },
		{ path: `${fontDir}/DMSans-Medium.ttf`, weight: "500", style: "normal" },
		{ path: `${fontDir}/DMSans-SemiBold.ttf`, weight: "600", style: "normal" },
		{ path: `${fontDir}/DMSans-Bold.ttf`, weight: "700", style: "normal" },
	],
	variable: "--font-dm-sans",
	display: "swap",
});

export const dmMono = localFont({
	src: [
		{ path: `${fontDir}/DMMono-Regular.ttf`, weight: "400", style: "normal" },
		{ path: `${fontDir}/DMMono-Medium.ttf`, weight: "500", style: "normal" },
	],
	variable: "--font-dm-mono",
	display: "swap",
});
